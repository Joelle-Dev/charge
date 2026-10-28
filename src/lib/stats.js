import {
  getAll,
  getAllByRange,
  countRange,
  getRecord,
  getPageByIndex,
  clearStores,
  putMany,
  deleteMany,
  setSetting
} from './db.js';
import { DEFAULT_CATEGORY } from './parser.js';
import { dayKey } from '../utils/format.js';
import { monthKey } from '../utils/months.js';
import { catTitleForCategory } from '../utils/titles.js';
import { buildSearchChunks, SEARCH_VERSION, SEARCH_BUILDING_VERSION } from './searchIndex.js';

export const STATS_VERSION = 2;

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
    months: new Map(),
    monthsStageId: null,
    daysLoaded: false
  };
}

export function statsStateFromEntries(entries = []) {
  const state = createStatsState();

  for (const entry of entries) {
    if (!entry || !entry.key) continue;
    if (entry.key === 'global') {
      state.global = entry;
    } else if (entry.key.startsWith('stage:')) {
      state.stages.set(entry.key.slice(6), entry);
    } else if (entry.key.startsWith('day:')) {
      state.days.set(entry.key.slice(4), entry);
    } else if (entry.key.startsWith('month:')) {
      const rest = entry.key.slice(6);
      const split = rest.lastIndexOf(':');
      state.months.set(`${rest.slice(0, split)}|${rest.slice(split + 1)}`, entry);
    }
  }

  state.monthsStageId = '*';
  state.daysLoaded = true;
  return state;
}

export function statsEntriesFromState(state) {
  return [
    state.global,
    ...state.stages.values(),
    ...state.days.values(),
    ...state.months.values()
  ];
}

export function statKeysForExpense(expense) {
  if (!expense) return [];
  const date = new Date(expense.spentAt);
  if (Number.isNaN(date.getTime())) return [];
  const day = dayKey(date);
  const month = monthKey(date);
  const stageId = expense.stageId;
  return [
    'global',
    `stage:${stageId}`,
    `day:${day}`,
    `month:${stageId}:${month}`
  ];
}

export function statKeysForExpenses(expenses = []) {
  const keys = new Set();
  for (const expense of expenses) {
    for (const key of statKeysForExpense(expense)) keys.add(key);
  }
  return keys;
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
  const categoryStats = stage.categories[category] || { count: 0, amount: 0 };
  categoryStats.count += sign;
  categoryStats.amount += sign * amount;
  stage.categories[category] = categoryStats;

  const dayBucket = ensureBucket(state.days, day);
  dayBucket.count += sign;
  dayBucket.total += sign * amount;

  const monthBucket = ensureBucket(state.months, `${stageId}|${month}`);
  monthBucket.count += sign;
  monthBucket.total += sign * amount;

  if (sign < 0) {
    dropBucketIfEmpty(state.days, day);
    dropBucketIfEmpty(state.months, `${stageId}|${month}`);

    if (state.global.minDate === day || state.global.maxDate === day) recomputeGlobalBounds(state);

    const currentStage = state.stages.get(stageId);
    if (currentStage && currentStage.count <= 0) {
      state.stages.delete(stageId);
    } else if (currentStage) {
      const categoryStats = currentStage.categories[category];
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

export function statsEntriesAndDeletesForKeys(state, keys) {
  const entries = [];
  const deletes = [];

  for (const key of keys) {
    if (key === 'global') {
      if (state.global.count > 0) entries.push(state.global);
      else deletes.push(key);
    } else if (key.startsWith('stage:')) {
      const stage = state.stages.get(key.slice(6));
      if (stage) entries.push(stage);
      else deletes.push(key);
    } else if (key.startsWith('day:')) {
      const bucket = state.days.get(key.slice(4));
      if (bucket) entries.push(bucket);
      else deletes.push(key);
    } else if (key.startsWith('month:')) {
      const rest = key.slice(6);
      const split = rest.lastIndexOf(':');
      const bucket = state.months.get(`${rest.slice(0, split)}|${rest.slice(split + 1)}`);
      if (bucket) entries.push(bucket);
      else deletes.push(key);
    }
  }

  return { entries, deletes };
}

export function buildStatsFromExpenses(expenses = []) {
  const state = createStatsState();
  for (const expense of expenses) applyExpenseDelta(state, expense, 1);
  return state;
}

export async function loadStatsState() {
  const entries = await getAll('stats');
  return statsStateFromEntries(entries);
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

export async function applyRuntimeExpenseDelta(state, expense, sign = 1) {
  const amount = Number(expense.amount) || 0;
  if (!amount || !expense.stageId) return;
  const date = new Date(expense.spentAt);
  if (Number.isNaN(date.getTime())) return;

  const day = dayKey(date);
  const month = monthKey(date);
  const stageId = expense.stageId;
  const category = expense.category || DEFAULT_CATEGORY;
  const dayStatsKey = `day:${day}`;
  const monthStatsKey = `month:${stageId}:${month}`;
  const monthMapKey = `${stageId}|${month}`;

  const [dayRecord, monthRecord] = await Promise.all([
    getRecord('stats', dayStatsKey),
    getRecord('stats', monthStatsKey)
  ]);
  const dayBucket = dayRecord || { key: dayStatsKey, count: 0, total: 0 };
  const monthBucket = monthRecord || { key: monthStatsKey, count: 0, total: 0 };
  const dayWasEmpty = (dayBucket.count || 0) <= 0;

  const nextDay = {
    ...dayBucket,
    count: (dayBucket.count || 0) + sign,
    total: (dayBucket.total || 0) + sign * amount
  };
  const nextMonth = {
    ...monthBucket,
    count: (monthBucket.count || 0) + sign,
    total: (monthBucket.total || 0) + sign * amount
  };

  state.global.count += sign;
  state.global.total += sign * amount;
  updateDateRange(state.global, day, sign);

  const stage = ensureStage(state, stageId);
  stage.count += sign;
  stage.total += sign * amount;
  updateDateRange(stage, day, sign);
  const categoryStats = stage.categories[category] || { count: 0, amount: 0 };
  categoryStats.count += sign;
  categoryStats.amount += sign * amount;
  stage.categories[category] = categoryStats;

  if (sign > 0) {
    if (dayWasEmpty) state.global.recordDays = (state.global.recordDays || 0) + 1;
  } else if (nextDay.count <= 0) {
    state.global.recordDays = Math.max(0, (state.global.recordDays || 0) - 1);
  }

  if (monthsLoadedFor(state, stageId)) {
    state.months.set(monthMapKey, nextMonth);
  }
  if (state.daysLoaded) {
    state.days.set(day, nextDay);
  }

  if (sign < 0) {
    if (nextDay.count <= 0) state.days.delete(day);
    if (nextMonth.count <= 0) state.months.delete(monthMapKey);
    if (stage.count <= 0) {
      state.stages.delete(stageId);
    } else if (categoryStats.count <= 0) {
      delete stage.categories[category];
    }
    if (state.global.count <= 0) {
      state.global.count = 0;
      state.global.total = 0;
      state.global.minDate = '';
      state.global.maxDate = '';
    }
  }

  const puts = [state.global];
  const deletes = [];
  if (stage.count > 0) puts.push(stage);
  else deletes.push(`stage:${stageId}`);
  if (nextMonth.count > 0) puts.push(nextMonth);
  else deletes.push(monthStatsKey);
  if (nextDay.count > 0) puts.push(nextDay);
  else deletes.push(dayStatsKey);

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
  mark('writeSearch');

  await setSetting('searchVersion', SEARCH_VERSION);
  return state;
}

export async function rebuildStats() {
  return rebuildDerivedData();
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

export function globalStatsFromState(state) {
  return state.global;
}

export function availableYearsFromState(state) {
  const years = new Set();
  const min = state.global?.minDate;
  const max = state.global?.maxDate;
  if (min && max) {
    const start = Number(min.slice(0, 4));
    const end = Number(max.slice(0, 4));
    if (Number.isFinite(start) && Number.isFinite(end)) {
      for (let year = end; year >= start; year -= 1) years.add(year);
    }
  } else if (state.daysLoaded) {
    for (const day of state.days.keys()) {
      const year = Number(day.slice(0, 4));
      if (Number.isFinite(year)) years.add(year);
    }
  }
  if (!years.size) years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
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
    const todayKey = dayKey(now);
    const span = Math.max(0, dayDiff(firstDate, dayKey(yesterday)));
    const todayRecorded = days.has(todayKey) ? 1 : 0;
    const recordedInSpan = Math.max(0, days.size - 1 - todayRecorded);
    noSpendDays = Math.max(0, span - recordedInSpan);
  }

  let budgetKeptStages = 0;
  for (const stage of stages) {
    const stats = state.stages.get(stage.id);
    const budget = Number(stage.budget) || 0;
    if (!stats || budget <= 0 || !stats.count) continue;
    if (stats.total <= budget) budgetKeptStages += 1;
  }

  return {
    totalCount: global.count,
    totalAmount: global.total,
    recordDays: days.size,
    streak,
    noSpendDays,
    stageCount: stages.length,
    budgetKeptStages
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
