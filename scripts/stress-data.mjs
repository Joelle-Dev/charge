// Data-layer stress benchmark. Run with: node --expose-gc scripts/stress-data.mjs
// Uses an in-memory IndexedDB implementation so results are comparable, not
// representative of real browser disk latency.
import 'fake-indexeddb/auto';

const {
  getAll,
  getAllByIndex,
  getAllByRange,
  getRecord,
  putMany,
  putRecord,
  countRange
} = await import('../src/lib/db.js');
const {
  rebuildDerivedData,
  loadHomeStats,
  loadStageMonths,
  loadDays,
  loadDayStats,
  createStatsState
} = await import('../src/lib/stats.js');
const {
  matchesSearchEntry,
  matchesSearchAmount,
  matchesSearchDate,
  searchChunkMonthBounds,
  sortSearchChunksByRecency,
  applySearchChunkChanges,
  compactSearchEntry
} = await import('../src/lib/searchIndex.js');
const { monthBounds } = await import('../src/utils/months.js');

const TOTAL = Number(process.env.STRESS_TOTAL || 20000);
const STAGE_COUNT = Number(process.env.STRESS_STAGES || 4);
const MONTH_COUNT = Number(process.env.STRESS_MONTHS || 36);
const BATCH = Number(process.env.STRESS_BATCH || 5000);
const LIMIT = 500;
const CATEGORIES = ['餐饮', '交通', '购物', '娱乐', '房租', '水电', '医疗', '其他'];
const NOTES = [
  '午饭', '晚饭', '打车', '地铁', '咖啡', '奶茶', '超市', '电影',
  '房租', '水电费', '买药', '水果', '午饭团建', '周末聚餐', '',
  '', '', '打车回家'
];

let seed = 20261112;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function pick(list) {
  return list[Math.floor(rand() * list.length)];
}
function nowMonthStart(offset) {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() - offset);
  return date;
}
function isoMonthStart(offset) {
  return nowMonthStart(offset).toISOString();
}

const stages = Array.from({ length: STAGE_COUNT }, (_, index) => ({
  id: `stage_${index}`,
  name: `压测账本${index + 1}`,
  budget: 3000,
  archived: false,
  createdAt: Date.now() - index * 1000,
  updatedAt: Date.now()
}));

function makeExpense(index) {
  const monthOffset = Math.floor(rand() * MONTH_COUNT);
  const start = nowMonthStart(monthOffset);
  const year = start.getFullYear();
  const month = start.getMonth();
  const day = 1 + Math.floor(rand() * 28);
  const hour = 8 + Math.floor(rand() * 14);
  const minute = Math.floor(rand() * 60);
  const spentAt = new Date(year, month, day, hour, minute).toISOString();
  return {
    id: `exp_${index}`,
    stageId: stages[Math.floor(rand() * stages.length)].id,
    amount: Math.round((1 + rand() * 500) * 100) / 100,
    category: pick(CATEGORIES),
    note: pick(NOTES),
    spentAt,
    createdAt: Date.now() - Math.floor(rand() * 1e9)
  };
}

async function time(label, fn) {
  global.gc?.();
  const started = performance.now();
  const result = await fn();
  const ms = performance.now() - started;
  console.log(`${label.padEnd(42)} ${ms.toFixed(1).padStart(9)} ms`);
  return result;
}

function bytes(value) {
  return Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value));
}

async function sumJsonBytes(storeName) {
  const rows = await getAll(storeName);
  let size = 0;
  for (const row of rows) size += bytes(row);
  return { records: rows.length, bytes: size };
}

function scanChunks(chunks, filters) {
  const {
    keyword = '',
    category = '',
    minAmount = null,
    maxAmount = null,
    fromIso = '',
    toIso = '',
    idsLimit = LIMIT
  } = filters;
  let count = 0;
  let sum = 0;
  const ids = [];
  for (const chunk of chunks) {
    for (const row of chunk.rows || []) {
      if (
        matchesSearchEntry(row, keyword, category) &&
        matchesSearchAmount(row, minAmount, maxAmount) &&
        matchesSearchDate(row, fromIso, toIso)
      ) {
        count += 1;
        sum += Number(row.a ?? row.amount) || 0;
        if (ids.length < idsLimit) ids.push(row.id);
      }
    }
  }
  return { count, sum, ids };
}

function chunkFullyCovered(chunk, fromIso, toIso) {
  const [start, end] = monthBounds(chunk.month);
  if (fromIso && fromIso > start) return false;
  if (toIso && toIso < end) return false;
  return true;
}

async function scanChunksFast(metas, filters, getChunk) {
  const { fromIso = '', toIso = '', idsLimit = LIMIT } = filters;
  let count = 0;
  let sum = 0;
  const ids = [];
  for (const meta of metas) {
    const full = chunkFullyCovered(meta, fromIso, toIso);
    if (full) {
      count += Number(meta.count) || 0;
      sum += Number(meta.sum) || 0;
      if (ids.length < idsLimit) {
        const chunk = await getChunk(meta);
        for (const row of chunk?.rows || []) {
          ids.push(row.id);
          if (ids.length >= idsLimit) break;
        }
      }
    } else {
      const chunk = await getChunk(meta);
      for (const row of chunk?.rows || []) {
        if (!matchesSearchDate(row, fromIso, toIso)) continue;
        count += 1;
        sum += Number(row.a ?? row.amount) || 0;
        if (ids.length < idsLimit) ids.push(row.id);
      }
    }
  }
  return { count, sum, ids };
}

async function searchAllChunks(stageIds, filters) {
  const lists = await Promise.all(
    stageIds.map((id) => getAllByIndex('searchChunks', 'stageId', id))
  );
  const chunks = sortSearchChunksByRecency(lists.flat());
  return { chunks, ...scanChunks(chunks, filters) };
}

async function searchMonthChunks(stageIds, filters) {
  const { fromMonth, toMonth } = searchChunkMonthBounds(filters.fromIso, filters.toIso);
  const lists = await Promise.all(
    stageIds.map((id) => getAllByRange(
      'searchChunks',
      IDBKeyRange.bound(`${id}|${fromMonth}`, `${id}|${toMonth}`)
    ))
  );
  const chunks = sortSearchChunksByRecency(lists.flat());
  return { chunks, ...scanChunks(chunks, filters) };
}

async function searchFastChunks(stageIds, filters) {
  const { fromMonth, toMonth } = searchChunkMonthBounds(filters.fromIso, filters.toIso);
  const lists = await Promise.all(
    stageIds.map((id) => getAllByRange(
      'stats',
      IDBKeyRange.bound(`searchmeta:${id}:${fromMonth}`, `searchmeta:${id}:${toMonth}`)
    ))
  );
  const metas = lists.flat().sort((a, b) => (
    String(b.latest || '').localeCompare(String(a.latest || ''))
  ));
  const cache = new Map();
  const getChunk = async (meta) => {
    const key = `${meta.stageId}|${meta.month}`;
    if (!cache.has(key)) cache.set(key, await getRecord('searchChunks', key));
    return cache.get(key);
  };
  return { metas, ...(await scanChunksFast(metas, filters, getChunk)) };
}

function describe(title) {
  console.log(`\n== ${title} ==`);
}

async function main() {
  const expenses = Array.from({ length: TOTAL }, (_, index) => makeExpense(index));

  await putMany('stages', stages);

  describe(`insert ${TOTAL} expenses (${STAGE_COUNT} stages / ${MONTH_COUNT} months)`);
  await time('bulk insert expenses', async () => {
    for (let index = 0; index < expenses.length; index += BATCH) {
      await putMany('expenses', expenses.slice(index, index + BATCH));
    }
  });
  console.log(`expense rows: ${await countRange('expenses', null)}`);
  console.log(`sample JSON bytes/expense: ${Math.round(bytes(expenses[0]))}`);

  describe('derived data rebuild');
  await time('rebuildDerivedData (stats + chunks)', () => rebuildDerivedData());
  const statsSize = await sumJsonBytes('stats');
  const chunkSize = await sumJsonBytes('searchChunks');
  console.log(`stats: ${statsSize.records} records, ${(statsSize.bytes / 1048576).toFixed(1)} MiB JSON`);
  console.log(`searchChunks: ${chunkSize.records} records, ${(chunkSize.bytes / 1048576).toFixed(1)} MiB JSON`);

  const homeState = await time('loadHomeStats', () => loadHomeStats());
  const stageId = stages[0].id;
  await time('loadStageMonths(stage0)', () => loadStageMonths(homeState, stageId));
  const daysState = createStatsState();
  await time('loadDays (global)', () => loadDays(daysState));
  await time('loadDayStats(stage0) [chart]', () => loadDayStats({ stageId }));

  const stageIds = stages.map((stage) => stage.id);
  const lastYearFrom = isoMonthStart(11);
  const lastYearTo = new Date().toISOString();
  const oneMonthFrom = isoMonthStart(0);
  const oneMonthTo = new Date(
    nowMonthStart(0).getFullYear(),
    nowMonthStart(0).getMonth() + 1,
    1
  ).toISOString();

  describe('search: one month / one stage');
  const oneMonthFilters = {
    fromIso: oneMonthFrom,
    toIso: oneMonthTo,
    keyword: '咖啡'
  };
  const a = await time('current (load every chunk)', () => searchAllChunks([stageId], oneMonthFilters));
  const b = await time('month-range (load relevant chunks)', () => searchMonthChunks([stageId], oneMonthFilters));
  console.log(`result: ${a.count} / ${b.count}, chunks scanned: ${a.chunks.length} -> ${b.chunks.length}`);

  describe('search: last 12 months / all stages');
  const yearFilters = {
    fromIso: lastYearFrom,
    toIso: lastYearTo,
    keyword: ''
  };
  const c = await time('current (load every chunk)', () => searchAllChunks(stageIds, yearFilters));
  const d = await time('month-range (load relevant chunks)', () => searchMonthChunks(stageIds, yearFilters));
  const dFast = await time('month-range + meta store', () => searchFastChunks(stageIds, yearFilters));
  console.log(`result: ${c.count} / ${d.count} / ${dFast.count}, chunks scanned: ${c.chunks.length} -> ${d.chunks.length}, metas: ${dFast.metas.length}`);

  describe('search: all time / all stages / filters');
  const heavyFilters = {
    keyword: '打车',
    category: '交通',
    minAmount: 10,
    maxAmount: 100
  };
  const e = await time('current (load every chunk)', () => searchAllChunks(stageIds, heavyFilters));
  const f = await time('month-range (no date bound)', () => searchMonthChunks(stageIds, heavyFilters));
  console.log(`result: ${e.count} / ${f.count}, chunks scanned: ${e.chunks.length} -> ${f.chunks.length}`);

  describe('single-row search chunk update');
  const allChunks = await getAll('searchChunks');
  const biggest = allChunks.reduce(
    (peak, chunk) => (!peak || chunk.rows.length > peak.rows.length ? chunk : peak),
    null
  );
  if (biggest) {
    const removed = biggest.rows[biggest.rows.length - 1];
    const added = compactSearchEntry(makeExpense('stress_update'));
    console.log(`largest chunk: ${biggest.key} (${biggest.rows.length} rows)`);
    await time('applySearchChunkChanges + putRecord', async () => {
      const rows = applySearchChunkChanges(biggest, {
        removeIds: [removed.id],
        addRows: [added]
      });
      await putRecord('searchChunks', { ...biggest, rows });
      return rows.length;
    });
  }

  global.gc?.();
  const mem = process.memoryUsage();
  console.log(`\nheapUsed: ${(mem.heapUsed / 1048576).toFixed(1)} MiB, rss: ${(mem.rss / 1048576).toFixed(1)} MiB`);
}

await main();
