import { getAll, clearStores, putMany } from './db.js';
import { DEFAULT_CATEGORY } from './parser.js';
import { dayKey } from '../utils/format.js';
import { monthKey } from '../utils/months.js';
import { catTitleForCategory } from '../utils/titles.js';
import { buildSearchChunks } from './searchIndex.js';

export const STATS_VERSION = 2;

function emptyGlobal() {
  return { key: 'global', count: 0, total: 0, minDate: '', maxDate: '' };
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
    stageDays: new Map()
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
    } else if (entry.key.startsWith('stageDay:')) {
      const rest = entry.key.slice(9);
      const split = rest.lastIndexOf(':');
      state.stageDays.set(`${rest.slice(0, split)}|${rest.slice(split + 1)}`, entry);
    }
  }

  return state;
}

export function statsEntriesFromState(state) {
  return [
    state.global,
    ...state.stages.values(),
    ...state.days.values(),
    ...state.months.values(),
    ...state.stageDays.values()
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
    `month:${stageId}:${month}`,
    `stageDay:${stageId}:${day}`
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

function recomputeStageBounds(state, stageId) {
  let minDate = '';
  let maxDate = '';
  const prefix = `${stageId}|`;
  for (const key of state.stageDays.keys()) {
    if (!key.startsWith(prefix)) continue;
    const day = key.slice(prefix.length);
    if (!minDate || day < minDate) minDate = day;
    if (!maxDate || day > maxDate) maxDate = day;
  }
  const stage = state.stages.get(stageId);
  if (stage) {
    stage.minDate = minDate;
    stage.maxDate = maxDate;
  }
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

  const stageDayBucket = ensureBucket(state.stageDays, `${stageId}|${day}`);
  stageDayBucket.count += sign;
  stageDayBucket.total += sign * amount;

  if (sign < 0) {
    dropBucketIfEmpty(state.days, day);
    dropBucketIfEmpty(state.months, `${stageId}|${month}`);
    dropBucketIfEmpty(state.stageDays, `${stageId}|${day}`);

    if (state.global.minDate === day || state.global.maxDate === day) recomputeGlobalBounds(state);
    if (stage.minDate === day || stage.maxDate === day) recomputeStageBounds(state, stageId);

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
    } else if (key.startsWith('stageDay:')) {
      const rest = key.slice(9);
      const split = rest.lastIndexOf(':');
      const bucket = state.stageDays.get(`${rest.slice(0, split)}|${rest.slice(split + 1)}`);
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

export async function rebuildDerivedData() {
  await clearStores(['stats', 'searchChunks']);
  const expenses = await getAll('expenses');
  const state = buildStatsFromExpenses(expenses);

  const entries = statsEntriesFromState(state);
  const chunkSize = 1000;
  for (let index = 0; index < entries.length; index += chunkSize) {
    await putMany('stats', entries.slice(index, index + chunkSize));
  }

  const searchChunks = buildSearchChunks(expenses);
  for (let index = 0; index < searchChunks.length; index += chunkSize) {
    await putMany('searchChunks', searchChunks.slice(index, index + chunkSize));
  }

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

export function stageDayStatsFromState(state, stageId, day) {
  return state.stageDays.get(`${stageId}|${day}`) || null;
}

export function globalStatsFromState(state) {
  return state.global;
}

export function availableYearsFromState(state) {
  const years = new Set();
  for (const day of state.days.keys()) {
    const year = Number(day.slice(0, 4));
    if (Number.isFinite(year)) years.add(year);
  }
  if (!years.size) years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
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
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end.setDate(end.getDate() - 1);
    const scan = new Date(`${firstDate}T12:00:00`);
    scan.setDate(scan.getDate() + 1);
    let guard = 0;
    while (scan <= end && guard < 3660) {
      if (!days.has(dayKey(scan))) noSpendDays += 1;
      scan.setDate(scan.getDate() + 1);
      guard += 1;
    }
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
