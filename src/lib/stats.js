import {
  getAll,
  getAllByRange,
  countRange,
  getRecord,
  getMany,
  getPageByIndex,
  clearStores,
  putMany,
  deleteMany,
  setSetting,
  scanIndex
} from './db.js';
import { DEFAULT_CATEGORY } from './parser.js';
import { dayKey } from '../utils/format.js';
import { monthKey } from '../utils/months.js';
import { catTitleForCategory } from '../utils/titles.js';
import {
  buildSearchChunks,
  searchMetaEntry,
  SEARCH_VERSION,
  SEARCH_BUILDING_VERSION
} from './searchIndex.js';

export const STATS_VERSION = 4;

function emptyGlobal() {
  return { key: 'global', count: 0, total: 0, minDate: '', maxDate: '', recordDays: 0 };
}

function emptyStage(stageId) {
  return {
    key: `stage:${stageId}`,
    count: 0,
    total: 0,
    minDate: '',
    maxDate: '',
    categories: {}
  };
}

function emptyBucket(key) {
  return { key, count: 0, total: 0 };
}

export function createStatsState() {
  return {
    global: emptyGlobal(),
    stages: new Map(),
    days: new Map(),
    stageDays: new Map(),
    months: new Map(),
    monthsStageId: null,
    daysLoaded: false
  };
}

export function statsEntriesFromState(state) {
  return [
    state.global,
    ...state.stages.values(),
    ...[...state.days.values()].map((bucket) => ({
      ...bucket,
      key: `day:${bucket.key}`
    })),
    ...[...state.stageDays.values()].map((bucket) => {
      const [stageId, day] = bucket.key.split('|');
      return {
        ...bucket,
        key: `stageday:${stageId}:${day}`
      };
    }),
    ...[...state.months.values()].map((bucket) => {
      const [stageId, month] = bucket.key.split('|');
      return {
        ...bucket,
        key: `month:${stageId}:${month}`
      };
    })
  ];
}

function ensureStage(state, stageId) {
  let stage = state.stages.get(stageId);
  if (!stage) {
    stage = emptyStage(stageId);
    state.stages.set(stageId, stage);
  }
  return stage;
}

function ensureBucket(collection, key) {
  let bucket = collection.get(key);
  if (!bucket) {
    bucket = emptyBucket(key);
    collection.set(key, bucket);
  }
  return bucket;
}

function updateDateRange(record, day, sign) {
  if (sign > 0) {
    if (!record.minDate || day < record.minDate) record.minDate = day;
    if (!record.maxDate || day > record.maxDate) record.maxDate = day;
  }
}

function recomputeGlobalBounds(state) {
  let minDate = '';
  let maxDate = '';
  for (const day of state.days.keys()) {
    if (!minDate || day < minDate) minDate = day;
    if (!maxDate || day > maxDate) maxDate = day;
  }
  state.global.minDate = minDate;
  state.global.maxDate = maxDate;
}

function dropBucketIfEmpty(collection, key) {
  const bucket = collection.get(key);
  if (bucket && bucket.count <= 0) collection.delete(key);
}

// 分类名是用户输入，可能是 __proto__/constructor 这类继承键，
// 一律用 hasOwn 读、defineProperty 写，避免污染原型。
function categoryStatsOf(categories, category) {
  return Object.hasOwn(categories, category) ? categories[category] : null;
}

function ensureCategoryStats(categories, category) {
  const existing = categoryStatsOf(categories, category);
  if (existing) return existing;
  const created = { count: 0, amount: 0 };
  Object.defineProperty(categories, category, {
    value: created,
    writable: true,
    enumerable: true,
    configurable: true
  });
  return created;
}

export function applyExpenseDelta(state, expense, sign = 1) {
  const amount = Number(expense.amount) || 0;
  if (!amount || !expense.stageId) return;
  const date = new Date(expense.spentAt);
  if (Number.isNaN(date.getTime())) return;

  const day = dayKey(date);
  const month = monthKey(date);
  const stageId = expense.stageId;
  const category = expense.category || DEFAULT_CATEGORY;

  state.global.count += sign;
  state.global.total += sign * amount;
  updateDateRange(state.global, day, sign);

  const stage = ensureStage(state, stageId);
  stage.count += sign;
  stage.total += sign * amount;
  updateDateRange(stage, day, sign);
  const categoryStats = ensureCategoryStats(stage.categories, category);
  categoryStats.count += sign;
  categoryStats.amount += sign * amount;

  const dayBucket = ensureBucket(state.days, day);
  dayBucket.count += sign;
  dayBucket.total += sign * amount;

  const monthBucket = ensureBucket(state.months, `${stageId}|${month}`);
  monthBucket.count += sign;
  monthBucket.total += sign * amount;

  const stageDayBucket = ensureBucket(state.stageDays, `${stageId}|${day}`);
  stageDayBucket.count += sign;
  stageDayBucket.total += sign * amount;

  if (sign < 0) {
    dropBucketIfEmpty(state.days, day);
    dropBucketIfEmpty(state.stageDays, `${stageId}|${day}`);
    dropBucketIfEmpty(state.months, `${stageId}|${month}`);

    if (state.global.minDate === day || state.global.maxDate === day) recomputeGlobalBounds(state);

    const currentStage = state.stages.get(stageId);
    if (currentStage && currentStage.count <= 0) {
      state.stages.delete(stageId);
    } else if (currentStage) {
      const categoryStats = categoryStatsOf(currentStage.categories, category);
      if (categoryStats && categoryStats.count <= 0) delete currentStage.categories[category];
    }

    if (state.global.count <= 0) {
      state.global.count = 0;
      state.global.total = 0;
      state.global.minDate = '';
      state.global.maxDate = '';
    }
  }
}

export function buildStatsFromExpenses(expenses = []) {
  const state = createStatsState();
  for (const expense of expenses) applyExpenseDelta(state, expense, 1);
  return state;
}

export async function loadHomeStats() {
  const state = createStatsState();
  const [global, stageEntries] = await Promise.all([
    getRecord('stats', 'global'),
    getAllByRange('stats', IDBKeyRange.bound('stage:', 'stage:\uffff'))
  ]);
  if (global) state.global = global;
  for (const entry of stageEntries) {
    state.stages.set(entry.key.slice(6), entry);
  }
  return state;
}

export async function loadStageMonths(state, stageId) {
  if (!stageId) {
    state.months = new Map();
    state.monthsStageId = null;
    return;
  }
  const prefix = `month:${stageId}:`;
  const entries = await getAllByRange(
    'stats',
    IDBKeyRange.bound(prefix, `${prefix}\uffff`)
  );
  const months = new Map();
  for (const entry of entries) {
    months.set(`${stageId}|${entry.key.slice(prefix.length)}`, entry);
  }
  state.months = months;
  state.monthsStageId = stageId;
}

export async function loadDays(state) {
  const entries = await getAllByRange('stats', IDBKeyRange.bound('day:', 'day:\uffff'));
  const days = new Map();
  for (const entry of entries) days.set(entry.key.slice(4), entry);
  state.days = days;
  state.daysLoaded = true;
}

export async function backfillRecordDays(state) {
  if (state.global.recordDays !== undefined && state.global.recordDays !== null) {
    return false;
  }
  state.global.recordDays = await countRange(
    'stats',
    IDBKeyRange.bound('day:', 'day:\uffff')
  );
  await putMany('stats', [state.global]);
  return true;
}

function monthsLoadedFor(state, stageId) {
  return state.monthsStageId === '*' || state.monthsStageId === stageId;
}

export async function applyRuntimeExpenseDeltas(state, ops = []) {
  const items = [];
  for (const op of ops) {
    const expense = op?.expense;
    const sign = op?.sign || 1;
    const amount = Number(expense?.amount) || 0;
    if (!amount || !expense.stageId) continue;
    const date = new Date(expense.spentAt);
    if (Number.isNaN(date.getTime())) continue;
    items.push({
      expense,
      sign,
      amount,
      day: dayKey(date),
      month: monthKey(date),
      stageId: expense.stageId,
      category: expense.category || DEFAULT_CATEGORY
    });
  }
  if (!items.length) return;

  const dayKeys = new Set();
  const stageDayKeys = new Set();
  const monthKeys = new Set();
  for (const item of items) {
    dayKeys.add(`day:${item.day}`);
    stageDayKeys.add(`stageday:${item.stageId}:${item.day}`);
    monthKeys.add(`month:${item.stageId}:${item.month}`);
  }

  const allKeys = [...dayKeys, ...stageDayKeys, ...monthKeys];
  const records = await getMany('stats', allKeys);
  const buckets = new Map();
  allKeys.forEach((key, index) => {
    const record = records[index];
    buckets.set(key, record
      ? { ...record, count: record.count || 0, total: record.total || 0 }
      : { key, count: 0, total: 0 });
  });

  for (const item of items) {
    const { sign, amount, day, month, stageId, category } = item;
    const dayBucket = buckets.get(`day:${day}`);
    const stageDayBucket = buckets.get(`stageday:${stageId}:${day}`);
    const monthBucket = buckets.get(`month:${stageId}:${month}`);
    const dayWasEmpty = dayBucket.count <= 0;

    dayBucket.count += sign;
    dayBucket.total += sign * amount;
    stageDayBucket.count += sign;
    stageDayBucket.total += sign * amount;
    monthBucket.count += sign;
    monthBucket.total += sign * amount;

    state.global.count += sign;
    state.global.total += sign * amount;
    updateDateRange(state.global, day, sign);

    const stage = ensureStage(state, stageId);
    stage.count += sign;
    stage.total += sign * amount;
    updateDateRange(stage, day, sign);
    const categoryStats = ensureCategoryStats(stage.categories, category);
    categoryStats.count += sign;
    categoryStats.amount += sign * amount;

    if (sign > 0) {
      if (dayWasEmpty) state.global.recordDays = (state.global.recordDays || 0) + 1;
    } else if (dayBucket.count <= 0) {
      state.global.recordDays = Math.max(0, (state.global.recordDays || 0) - 1);
    }

    if (monthsLoadedFor(state, stageId)) {
      state.months.set(`${stageId}|${month}`, monthBucket);
    }
    if (state.daysLoaded) {
      state.days.set(day, dayBucket);
    }

    if (sign < 0) {
      const stageStats = state.stages.get(stageId);
      if (stageStats && stageStats.count <= 0) {
        state.stages.delete(stageId);
      } else if (categoryStats.count <= 0 && stageStats) {
        delete stageStats.categories[category];
      }
      if (state.global.count <= 0) {
        state.global.count = 0;
        state.global.total = 0;
        state.global.minDate = '';
        state.global.maxDate = '';
      }
    }
  }

  const puts = [state.global];
  const deletes = [];
  const touchedStages = new Set(items.map((item) => item.stageId));

  for (const stageId of touchedStages) {
    const stage = state.stages.get(stageId);
    if (stage && stage.count > 0) puts.push(stage);
    else deletes.push(`stage:${stageId}`);
  }

  for (const key of dayKeys) {
    const bucket = buckets.get(key);
    const day = key.slice(4);
    if (bucket.count > 0) {
      puts.push(bucket);
      if (state.daysLoaded) state.days.set(day, bucket);
    } else {
      deletes.push(key);
      state.days.delete(day);
    }
  }

  for (const key of stageDayKeys) {
    const bucket = buckets.get(key);
    const rest = key.slice(9);
    const split = rest.lastIndexOf(':');
    const mapKey = `${rest.slice(0, split)}|${rest.slice(split + 1)}`;
    if (bucket.count > 0) {
      puts.push(bucket);
      state.stageDays.set(mapKey, bucket);
    } else {
      deletes.push(key);
      state.stageDays.delete(mapKey);
    }
  }

  for (const key of monthKeys) {
    const bucket = buckets.get(key);
    const rest = key.slice(6);
    const split = rest.lastIndexOf(':');
    const mapKey = `${rest.slice(0, split)}|${rest.slice(split + 1)}`;
    if (bucket.count > 0) {
      puts.push(bucket);
      if (monthsLoadedFor(state, rest.slice(0, split))) state.months.set(mapKey, bucket);
    } else {
      deletes.push(key);
      state.months.delete(mapKey);
    }
  }

  await putMany('stats', puts);
  if (deletes.length) await deleteMany('stats', deletes);
}

export async function recomputeBoundsFromExpenses(state, stageId) {
  const [globalFirst] = await getPageByIndex('expenses', 'spentAt', null, { direction: 'next', limit: 1 });
  const [globalLast] = await getPageByIndex('expenses', 'spentAt', null, { direction: 'prev', limit: 1 });
  state.global.minDate = globalFirst ? dayKey(new Date(globalFirst.spentAt)) : '';
  state.global.maxDate = globalLast ? dayKey(new Date(globalLast.spentAt)) : '';

  const range = IDBKeyRange.bound([stageId, ''], [stageId, '\uffff']);
  const [stageFirst] = await getPageByIndex('expenses', 'stageId_spentAt', range, { direction: 'next', limit: 1 });
  const [stageLast] = await getPageByIndex('expenses', 'stageId_spentAt', range, { direction: 'prev', limit: 1 });
  const stage = state.stages.get(stageId);
  if (stage) {
    stage.minDate = stageFirst ? dayKey(new Date(stageFirst.spentAt)) : '';
    stage.maxDate = stageLast ? dayKey(new Date(stageLast.spentAt)) : '';
  }

  const puts = [state.global];
  if (stage) puts.push(stage);
  await putMany('stats', puts);
}


export async function loadDayStats({ stageId = null } = {}) {
  if (stageId) {
    const prefix = `stageday:${stageId}:`;
    const entries = await getAllByRange(
      'stats',
      IDBKeyRange.bound(prefix, `${prefix}\uffff`)
    );
    const days = new Map();
    for (const entry of entries) {
      if (!entry?.key) continue;
      const day = entry.key.slice(prefix.length);
      days.set(day, { ...entry, key: day });
    }
    const keys = [...days.keys()].sort();
    return {
      days,
      minDate: keys[0] || '',
      maxDate: keys[keys.length - 1] || ''
    };
  }

  const [global, entries] = await Promise.all([
    getRecord('stats', 'global'),
    getAllByRange('stats', IDBKeyRange.bound('day:', 'day:\uffff'))
  ]);
  const days = new Map();

  for (const entry of entries) {
    if (!entry?.key) continue;
    days.set(entry.key.slice(4), entry);
  }

  return {
    days,
    minDate: global?.minDate || '',
    maxDate: global?.maxDate || ''
  };
}

/**
 * Rebuild daily totals straight from the expenses store. Used as a safety net
 * when the per-stage day stats cache is out of sync (e.g. after older imports),
 * so the trend page never silently drops a month that has spending.
 */
export async function loadDayTotals({ stageIds = [] } = {}) {
  const totals = new Map();
  const add = (expense) => {
    const date = new Date(expense?.spentAt);
    if (Number.isNaN(date.getTime())) return;
    const key = dayKey(date);
    const bucket = totals.get(key) || { key, count: 0, total: 0 };
    bucket.count += 1;
    bucket.total += Number(expense.amount) || 0;
    totals.set(key, bucket);
  };

  const ids = [...new Set((Array.isArray(stageIds) ? stageIds : []).filter(Boolean))];
  for (const stageId of ids) {
    await scanIndex('expenses', 'stageId', IDBKeyRange.only(stageId), add);
  }
  return { days: totals };
}

export async function rebuildDerivedData(onProgress) {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;
  const mark = (phase) => {
    if (!onProgress) return;
    onProgress({
      phase,
      elapsed: startedAt ? Math.round(performance.now() - startedAt) : 0
    });
  };

  await setSetting('searchVersion', SEARCH_BUILDING_VERSION);
  await clearStores(['stats', 'searchChunks']);
  mark('clear');

  const expenses = await getAll('expenses');
  mark('read');

  const state = buildStatsFromExpenses(expenses);
  state.global.recordDays = state.days.size;
  mark('stats');

  const entries = statsEntriesFromState(state);
  const chunkSize = 1000;
  for (let index = 0; index < entries.length; index += chunkSize) {
    await putMany('stats', entries.slice(index, index + chunkSize));
  }
  mark('writeStats');

  const searchChunks = buildSearchChunks(expenses);
  mark('buildSearch');

  for (let index = 0; index < searchChunks.length; index += chunkSize) {
    await putMany('searchChunks', searchChunks.slice(index, index + chunkSize));
  }
  const metaEntries = searchChunks.map(searchMetaEntry);
  for (let index = 0; index < metaEntries.length; index += chunkSize) {
    await putMany('stats', metaEntries.slice(index, index + chunkSize));
  }
  mark('writeSearch');

  await setSetting('searchVersion', SEARCH_VERSION);
  return state;
}

export function stageStatsFromState(state, stageId) {
  return state.stages.get(stageId) || emptyStage(stageId);
}

export function monthStatsFromState(state, stageId) {
  const prefix = `${stageId}|`;
  const result = new Map();
  for (const [key, bucket] of state.months) {
    if (!key.startsWith(prefix)) continue;
    result.set(key.slice(prefix.length), bucket);
  }
  return result;
}


function dayDiff(fromKey, toKey) {
  const [fromYear, fromMonth, fromDay] = fromKey.split('-').map(Number);
  const [toYear, toMonth, toDay] = toKey.split('-').map(Number);
  return Math.round(
    (Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86400000
  );
}

export function buildAchievementStatsFromState(state, stages = [], now = new Date()) {
  const days = state.days;
  const global = state.global;
  let firstDate = '';
  for (const day of days.keys()) {
    if (!firstDate || day < firstDate) firstDate = day;
  }

  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  let noSpendDays = 0;
  if (firstDate) {
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = dayKey(yesterday);
    const span = Math.max(0, dayDiff(firstDate, yesterdayKey));
    // 只统计 (firstDate, 昨天] 区间里的记账日，未来日期不能算进来
    let recordedInSpan = 0;
    for (const day of days.keys()) {
      if (day > firstDate && day <= yesterdayKey) recordedInSpan += 1;
    }
    noSpendDays = Math.max(0, span - recordedInSpan);
  }

  let budgetKeptStages = 0;
  for (const stage of stages) {
    const stats = state.stages.get(stage.id);
    const budget = Number(stage.budget) || 0;
    if (!stats || budget <= 0 || !stats.count) continue;
    if (stats.total <= budget) budgetKeptStages += 1;
  }

  // 满整年才算一周年：首记 3-15，到次年 3-15 才算 1 年
  let yearsActive = 0;
  if (firstDate) {
    const [firstYear, firstMonth, firstDay] = firstDate.split('-').map(Number);
    yearsActive = now.getFullYear() - firstYear;
    const month = now.getMonth() + 1;
    const hadAnniversary = month > firstMonth || (month === firstMonth && now.getDate() >= firstDay);
    if (!hadAnniversary) yearsActive -= 1;
    yearsActive = Math.max(0, yearsActive);
  }

  return {
    totalCount: global.count,
    totalAmount: global.total,
    recordDays: days.size,
    streak,
    noSpendDays,
    stageCount: stages.length,
    budgetKeptStages,
    firstDate,
    yearsActive
  };
}

export function buildStageSummaryFromState(stage, state) {
  const stats = state.stages.get(stage.id);
  const items = stats ? stats.categories : {};
  const total = stats?.total || 0;
  const topCategories = Object.entries(items)
    .map(([category, value]) => {
      const amount = value.amount || 0;
      return {
        category,
        amount,
        count: value.count || 0,
        percent: total > 0 ? (amount / total) * 100 : 0
      };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  return {
    stage,
    count: stats?.count || 0,
    total,
    budget: Number(stage.budget) || 0,
    remaining: Number(stage.budget) > 0 ? Number(stage.budget) - total : null,
    from: stats?.minDate || '',
    to: stats?.maxDate || '',
    topCategories,
    catTitle: catTitleForCategory(topCategories[0]?.category || '')
  };
}
