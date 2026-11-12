import {
  getAll,
  getAllByRange,
  getRecord,
  putMany,
  deleteMany,
  clearStores,
  setSetting
} from '../lib/db.js';
import {
  buildSearchChunks,
  matchesSearchAmount,
  matchesSearchDate,
  matchesSearchEntry,
  searchChunkMonthBounds,
  searchMetaEntry,
  SEARCH_VERSION,
  SEARCH_BUILDING_VERSION,
  sortSearchChunksByRecency
} from '../lib/searchIndex.js';
import { rebuildDerivedData } from '../lib/stats.js';
import { toMessage } from '../lib/errors.js';
import { monthBounds } from '../utils/months.js';

let activeSearchId = 0;

async function rebuildSearchIndex() {
  self.postMessage({ type: 'rebuildProgress', value: 0 });
  await setSetting('searchVersion', SEARCH_BUILDING_VERSION);
  await clearStores(['searchChunks']);
  const oldMetas = await getAllByRange(
    'stats',
    IDBKeyRange.bound('searchmeta:', 'searchmeta:\uffff')
  );
  if (oldMetas.length) await deleteMany('stats', oldMetas.map((entry) => entry.key));

  const expenses = await getAll('expenses');
  const chunks = buildSearchChunks(expenses);
  const batchSize = 50;

  for (let index = 0; index < chunks.length; index += batchSize) {
    await putMany('searchChunks', chunks.slice(index, index + batchSize));
    const done = Math.min(chunks.length, index + batchSize);
    self.postMessage({
      type: 'rebuildProgress',
      value: chunks.length ? Math.round((done / chunks.length) * 100) : 100
    });
  }

  const metaEntries = chunks.map(searchMetaEntry);
  for (let index = 0; index < metaEntries.length; index += batchSize) {
    await putMany('stats', metaEntries.slice(index, index + batchSize));
  }

  await setSetting('searchVersion', SEARCH_VERSION);
  self.postMessage({ type: 'rebuildDone', count: expenses.length });
}

function amountBound(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function chunkFullyCovered(chunk, fromIso, toIso) {
  const [start, end] = monthBounds(chunk.month);
  if (fromIso && fromIso > start) return false;
  if (toIso && toIso < end) return false;
  return true;
}

function chunkHasStats(chunk) {
  return typeof chunk.count === 'number' && typeof chunk.sum === 'number';
}

async function search({ requestId, stageId, stageIds, query, category, limit, minAmount, maxAmount, fromIso, toIso, progress }) {
  activeSearchId = requestId;
  const keyword = String(query || '').trim().toLowerCase();
  const categoryFilter = category || '';
  const maxIds = Number(limit) || 500;
  const min = amountBound(minAmount);
  const max = amountBound(maxAmount);
  const targetStageIds = (Array.isArray(stageIds) ? stageIds : [])
    .map((id) => String(id || ''))
    .filter(Boolean);
  if (!targetStageIds.length && stageId) targetStageIds.push(String(stageId));

  if (!targetStageIds.length) {
    self.postMessage({ type: 'searchDone', requestId, count: 0, sum: 0, ids: [] });
    return;
  }

  const { fromMonth, toMonth } = searchChunkMonthBounds(fromIso, toIso);
  const hasRowFilters = Boolean(keyword || categoryFilter || min !== null || max !== null);
  let count = 0;
  let sum = 0;
  const ids = [];

  if (!hasRowFilters) {
    const metaLists = await Promise.all(
      targetStageIds.map((id) => getAllByRange(
        'stats',
        IDBKeyRange.bound(`searchmeta:${id}:${fromMonth}`, `searchmeta:${id}:${toMonth}`)
      ))
    );
    const metas = metaLists.flat().sort((a, b) => (
      String(b.latest || '').localeCompare(String(a.latest || ''))
    ));

    if (metas.length) {
      const chunkCache = new Map();
      const getChunk = async (meta) => {
        const key = `${meta.stageId}|${meta.month}`;
        if (!chunkCache.has(key)) {
          chunkCache.set(key, await getRecord('searchChunks', key));
        }
        return chunkCache.get(key);
      };

      for (let index = 0; index < metas.length; index += 1) {
        if (activeSearchId !== requestId) return;
        const meta = metas[index];
        const full = chunkFullyCovered(meta, fromIso, toIso);
        if (full) {
          count += Number(meta.count) || 0;
          sum += Number(meta.sum) || 0;
          if (ids.length < maxIds) {
            const chunk = await getChunk(meta);
            for (const row of chunk?.rows || []) {
              ids.push(row.id);
              if (ids.length >= maxIds) break;
            }
          }
        } else {
          const chunk = await getChunk(meta);
          for (const row of chunk?.rows || []) {
            if (!matchesSearchDate(row, fromIso, toIso)) continue;
            count += 1;
            sum += Number(row.a ?? row.amount) || 0;
            if (ids.length < maxIds) ids.push(row.id);
          }
        }

        if (progress && index % 20 === 19) {
          self.postMessage({ type: 'searchProgress', requestId, count, sum, ids: ids.slice() });
          await new Promise((resolve) => setTimeout(resolve, 0));
          if (activeSearchId !== requestId) return;
        }
      }

      self.postMessage({ type: 'searchDone', requestId, count, sum, ids });
      return;
    }
  }

  const chunkLists = await Promise.all(
    targetStageIds.map((id) => getAllByRange(
      'searchChunks',
      IDBKeyRange.bound(`${id}|${fromMonth}`, `${id}|${toMonth}`)
    ))
  );
  const chunks = sortSearchChunksByRecency(chunkLists.flat());

  for (let index = 0; index < chunks.length; index += 1) {
    if (activeSearchId !== requestId) return;
    const chunk = chunks[index];
    const full = chunkFullyCovered(chunk, fromIso, toIso);

    if (!hasRowFilters && chunkHasStats(chunk)) {
      if (full) {
        count += chunk.count;
        sum += chunk.sum;
        if (ids.length < maxIds) {
          for (const row of chunk.rows || []) {
            ids.push(row.id);
            if (ids.length >= maxIds) break;
          }
        }
      } else {
        for (const row of chunk.rows || []) {
          if (!matchesSearchDate(row, fromIso, toIso)) continue;
          count += 1;
          sum += Number(row.a ?? row.amount) || 0;
          if (ids.length < maxIds) ids.push(row.id);
        }
      }
    } else {
      for (const row of chunk.rows || []) {
        if (!full && !matchesSearchDate(row, fromIso, toIso)) continue;
        if (
          matchesSearchEntry(row, keyword, categoryFilter) &&
          matchesSearchAmount(row, min, max)
        ) {
          count += 1;
          sum += Number(row.a ?? row.amount) || 0;
          if (ids.length < maxIds) ids.push(row.id);
        }
      }
    }

    if (progress && index % 20 === 19) {
      self.postMessage({ type: 'searchProgress', requestId, count, sum, ids: ids.slice() });
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (activeSearchId !== requestId) return;
    }
  }

  self.postMessage({ type: 'searchDone', requestId, count, sum, ids });
}

self.onmessage = async (event) => {
  const message = event.data || {};

  if (message.type === 'rebuild') {
    try {
      await rebuildSearchIndex();
    } catch (err) {
      self.postMessage({ type: 'rebuildError', error: toMessage(err) });
    }
    return;
  }

  if (message.type === 'rebuildAll') {
    try {
      self.postMessage({ type: 'rebuildAllProgress', phase: 'start', elapsed: 0 });
      await rebuildDerivedData((progress) => {
        self.postMessage({
          type: 'rebuildAllProgress',
          phase: progress.phase,
          elapsed: progress.elapsed
        });
      });
      self.postMessage({ type: 'rebuildAllDone' });
    } catch (err) {
      self.postMessage({ type: 'rebuildAllError', error: toMessage(err) });
    }
    return;
  }

  if (message.type === 'search') {
    try {
      await search(message);
    } catch (err) {
      self.postMessage({
        type: 'searchError',
        requestId: message.requestId,
        error: toMessage(err)
      });
    }
  }
};
