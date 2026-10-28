import { computed, reactive, ref } from 'vue';
import { showToast } from 'vant';
import {
  getAll,
  getRecord,
  putRecord,
  putMany,
  deleteRecord,
  deleteMany,
  deleteByIndexRange,
  getSetting,
  setSetting,
  getAllByIndex,
  getPageByIndex,
  getMany,
  countRange
} from '../lib/db';
import { PRESET_CATEGORIES, DEFAULT_CATEGORY } from '../lib/parser';
import { toDateInput, uid } from '../utils/format';
import { currentMonthKey } from '../utils/months';
import { catTitleForCategory } from '../utils/titles';
import { buildTemplates, mergeTemplates } from '../utils/templates';
import {
  SEARCH_VERSION,
  applySearchChunkChanges,
  compactSearchEntry,
  searchChunkKey,
  searchChunkMonth
} from '../lib/searchIndex';
import {
  rebuildSearchIndex,
  rebuildDerivedDataInWorker,
  searchExpenses as runWorkerSearch
} from '../lib/searchClient';
import {
  STATS_VERSION,
  createStatsState,
  loadHomeStats,
  loadStageMonths,
  loadDays,
  backfillRecordDays,
  applyRuntimeExpenseDelta,
  recomputeBoundsFromExpenses,
  buildAchievementStatsFromState,
  buildStageSummaryFromState,
  availableYearsFromState
} from '../lib/stats';

const stages = ref([]);
const categories = ref([...PRESET_CATEGORIES]);
const currentStageId = ref(null);
const ready = ref(false);
const loadingHint = ref('正在读取本地账本…');
const dataVersion = ref(0);
const statsState = reactive(createStatsState());
const recentExpenses = ref([]);
const recentTemplates = ref([]);

let initPromise = null;
let statsRebuildPromise = null;

const REBUILD_PERCENT = {
  start: 1,
  clear: 3,
  read: 60,
  stats: 65,
  writeStats: 80,
  buildSearch: 90,
  writeSearch: 100
};

const EMPTY_STAGE_STATS = { count: 0, total: 0, categories: {}, minDate: '', maxDate: '' };

const sortedStages = computed(() =>
  [...stages.value].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
);

const activeStages = computed(() => sortedStages.value.filter((stage) => !stage.archived));
const archivedStages = computed(() => sortedStages.value.filter((stage) => stage.archived));

const currentStage = computed(() =>
  stages.value.find((stage) => stage.id === currentStageId.value && !stage.archived) || null
);

const currentStageStats = computed(() => (
  currentStage.value ? statsState.stages.get(currentStage.value.id) || EMPTY_STAGE_STATS : EMPTY_STAGE_STATS
));

const total = computed(() => currentStageStats.value.total || 0);

const globalStats = computed(() => statsState.global);

const categoryGroups = computed(() => (
  Object.entries(currentStageStats.value.categories || {})
    .map(([category, value]) => ({ category, amount: value.amount || 0 }))
    .sort((a, b) => b.amount - a.amount)
));

const currentCatTitle = computed(() => catTitleForCategory(categoryGroups.value[0]?.category || ''));

const todayStats = ref({ count: 0, total: 0 });

const achievementStats = computed(() => (
  buildAchievementStatsFromState(statsState, stages.value)
));

const dataYears = computed(() => availableYearsFromState(statsState));

const currentStageMonthStats = computed(() => {
  const stageId = currentStage.value?.id;
  const result = new Map();
  if (!stageId) return result;
  const prefix = `${stageId}|`;
  for (const [key, bucket] of statsState.months) {
    if (key.startsWith(prefix)) result.set(key.slice(prefix.length), bucket);
  }
  return result;
});

function setStatsState(state) {
  statsState.global = state.global;
  statsState.stages = state.stages;
  statsState.days = state.days;
  statsState.months = state.months;
  statsState.monthsStageId = state.monthsStageId ?? null;
  statsState.daysLoaded = Boolean(state.daysLoaded);
}

async function refreshTodayStats() {
  const stage = currentStage.value;
  if (!stage) {
    todayStats.value = { count: 0, total: 0 };
    return;
  }
  const today = toDateInput(new Date());
  const startDate = new Date(`${today}T00:00:00`);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  const items = await getAllByIndex(
    'expenses',
    'stageId_spentAt',
    IDBKeyRange.bound([stage.id, startDate.toISOString()], [stage.id, endDate.toISOString()], false, true)
  );
  todayStats.value = {
    count: items.length,
    total: items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  };
}

async function ensureDaysLoaded() {
  if (statsState.daysLoaded) return;
  await loadDays(statsState);
}

function monthBounds(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return [
    new Date(year, monthNumber - 1, 1).toISOString(),
    new Date(year, monthNumber, 1).toISOString()
  ];
}

function yearBounds(year) {
  return [
    new Date(year, 0, 1).toISOString(),
    new Date(year + 1, 0, 1).toISOString()
  ];
}


async function loadMonthExpenses(stageId, month) {
  if (!stageId || !month) return [];
  const [start, end] = monthBounds(month);
  const items = await getAllByIndex(
    'expenses',
    'stageId_spentAt',
    IDBKeyRange.bound([stageId, start], [stageId, end], false, true)
  );
  return items.sort((a, b) => new Date(b.spentAt) - new Date(a.spentAt));
}

async function loadYearExpenses(year) {
  const [start, end] = yearBounds(year);
  const items = await getAllByIndex(
    'expenses',
    'spentAt',
    IDBKeyRange.bound(start, end, false, true)
  );
  return items.sort((a, b) => new Date(b.spentAt) - new Date(a.spentAt));
}

async function loadRecentExpenses(stageId, limit = 3) {
  if (!stageId) return [];
  return getPageByIndex(
    'expenses',
    'stageId_spentAt',
    IDBKeyRange.bound([stageId, ''], [stageId, '\uffff']),
    { direction: 'prev', limit }
  );
}

async function loadRecentAllExpenses(limit = 200) {
  return getPageByIndex('expenses', 'spentAt', null, { direction: 'prev', limit });
}

let searchIndexPromise = null;

async function ensureSearchIndex(force = false) {
  if (!force && searchIndexPromise) return searchIndexPromise;

  const storedVersion = force ? null : await getSetting('searchVersion', null);
  if (!force && storedVersion === SEARCH_VERSION) {
    searchIndexPromise = Promise.resolve();
    return searchIndexPromise;
  }

  if (!force && storedVersion === null) {
    const existing = await countRange('searchChunks', IDBKeyRange.lowerBound(''));
    if (existing > 0) {
      await setSetting('searchVersion', SEARCH_VERSION);
      searchIndexPromise = Promise.resolve();
      return searchIndexPromise;
    }
  }

  searchIndexPromise = rebuildSearchIndex().catch((err) => {
    searchIndexPromise = null;
    throw err;
  });
  return searchIndexPromise;
}

async function loadExpensesByIds(ids) {
  if (!ids?.length) return [];
  const items = await getMany('expenses', ids);
  return items.filter(Boolean);
}

async function searchExpenses(options) {
  await ensureSearchIndex();
  const result = await runWorkerSearch(options);
  return result;
}

async function refreshStageViews() {
  const stage = currentStage.value;
  if (!stage) {
    recentExpenses.value = [];
    recentTemplates.value = [];
    todayStats.value = { count: 0, total: 0 };
    return;
  }

  if (statsState.monthsStageId !== '*' && statsState.monthsStageId !== stage.id) {
    await loadStageMonths(statsState, stage.id);
  }

  const [recent, currentRecent, allRecent] = await Promise.all([
    loadRecentExpenses(stage.id, 3),
    loadRecentExpenses(stage.id, 200),
    loadRecentAllExpenses(200)
  ]);

  await refreshTodayStats();
  recentExpenses.value = recent;
  recentTemplates.value = mergeTemplates(
    buildTemplates(currentRecent, 3),
    buildTemplates(allRecent, 3),
    3
  );
}

async function maybeRecomputeBounds(removed) {
  const affected = new Set();
  for (const expense of removed) {
    const day = toDateInput(new Date(expense.spentAt));
    const stage = statsState.stages.get(expense.stageId);
    const globalBoundary = day === statsState.global.minDate || day === statsState.global.maxDate;
    const stageBoundary = stage && (day === stage.minDate || day === stage.maxDate);
    if (globalBoundary || stageBoundary) affected.add(expense.stageId);
  }
  for (const stageId of affected) {
    await recomputeBoundsFromExpenses(statsState, stageId);
  }
}

async function applyStatsChanges(removed = [], added = []) {
  for (const expense of removed) {
    await applyRuntimeExpenseDelta(statsState, expense, -1);
  }
  for (const expense of added) {
    await applyRuntimeExpenseDelta(statsState, expense, 1);
  }
  if (removed.length) await maybeRecomputeBounds(removed);
}

async function updateSearchChunks(removed = [], added = []) {
  const groups = new Map();
  const ensureGroup = (expense) => {
    const month = searchChunkMonth(expense);
    const key = searchChunkKey(expense.stageId, month);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        stageId: expense.stageId,
        month,
        removeIds: [],
        addRows: []
      };
      groups.set(key, group);
    }
    return group;
  };

  for (const expense of removed) ensureGroup(expense).removeIds.push(expense.id);
  for (const expense of added) ensureGroup(expense).addRows.push(compactSearchEntry(expense));

  for (const group of groups.values()) {
    let existing = await getRecord('searchChunks', group.key);
    if (!existing) {
      const [start, end] = monthBounds(group.month);
      const items = await getAllByIndex(
        'expenses',
        'stageId_spentAt',
        IDBKeyRange.bound([group.stageId, start], [group.stageId, end], false, true)
      );
      existing = {
        key: group.key,
        stageId: group.stageId,
        month: group.month,
        rows: items.map(compactSearchEntry)
      };
    }

    const rows = applySearchChunkChanges(existing, {
      removeIds: group.removeIds,
      addRows: group.addRows
    });

    if (rows.length) {
      await putRecord('searchChunks', {
        key: group.key,
        stageId: group.stageId,
        month: group.month,
        rows
      });
    } else {
      await deleteRecord('searchChunks', group.key);
    }
  }
}

async function commitExpenseChanges({ put = [], remove = [] } = {}) {
  if (statsRebuildPromise) await statsRebuildPromise;
  await setSetting('statsDirty', true);

  if (remove.length) {
    await deleteMany('expenses', remove.map((expense) => expense.id));
  }
  if (put.length) {
    await putMany('expenses', put);
  }

  await applyStatsChanges(remove, put);
  try {
    await ensureSearchIndex();
  } catch (err) {
    console.error('搜索索引未就绪', err);
  }
  await updateSearchChunks(remove, put);
  await setSetting('statsDirty', false);
  await refreshStageViews();
  dataVersion.value += 1;
}

async function reloadStages() {
  stages.value = await getAll('stages');
}

async function ensureCurrentStage() {
  const active = activeStages.value;
  if (!active.some((stage) => stage.id === currentStageId.value)) {
    currentStageId.value = active[0]?.id || null;
    await setSetting('currentStageId', currentStageId.value);
  }
}

async function rebuildAndApplyStats() {
  statsRebuildPromise = rebuildDerivedDataInWorker({
    onProgress: (phase) => {
      const percent = REBUILD_PERCENT[phase];
      loadingHint.value = percent
        ? `正在整理账本数据… ${percent}%`
        : '正在整理账本数据…';
    }
  });
  try {
    await statsRebuildPromise;
  } finally {
    statsRebuildPromise = null;
  }

  await setSetting('statsVersion', STATS_VERSION);
  await setSetting('statsDirty', false);
  const hadDays = statsState.daysLoaded;
  setStatsState(await loadHomeStats());
  await backfillRecordDays(statsState);
  if (hadDays) await loadDays(statsState);
  searchIndexPromise = Promise.resolve();
  return statsState;
}

async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const stored = await getSetting('categories', null);
      if (Array.isArray(stored) && stored.length) {
        categories.value = stored.includes(DEFAULT_CATEGORY)
          ? [...stored]
          : [...stored, DEFAULT_CATEGORY];
      } else {
        await setSetting('categories', categories.value);
      }

      await reloadStages();
      currentStageId.value = await getSetting('currentStageId', null);
      await ensureCurrentStage();

      const storedStatsVersion = await getSetting('statsVersion', null);
      const statsDirty = await getSetting('statsDirty', false);
      if (storedStatsVersion !== STATS_VERSION || statsDirty) {
        loadingHint.value = '正在整理账本数据，首次打开可能需要几十秒…';
        await rebuildAndApplyStats();
      } else {
        setStatsState(await loadHomeStats());
        await backfillRecordDays(statsState);
      }

      await refreshStageViews();
      ensureSearchIndex().catch((err) => {
        console.error('搜索索引初始化失败', err);
      });
    } catch (err) {
      console.error(err);
      showToast('本地数据加载失败，请刷新重试');
    } finally {
      ready.value = true;
      loadingHint.value = '正在读取本地账本…';
    }
  })();
  return initPromise;
}

async function reloadAfterImport() {
  const storedCategories = await getSetting('categories', null);
  if (Array.isArray(storedCategories) && storedCategories.length) {
    categories.value = storedCategories.includes(DEFAULT_CATEGORY)
      ? [...storedCategories]
      : [...storedCategories, DEFAULT_CATEGORY];
  }

  await reloadStages();
  currentStageId.value = await getSetting('currentStageId', null);
  await ensureCurrentStage();

  const hadDays = statsState.daysLoaded;
  setStatsState(await loadHomeStats());
  await backfillRecordDays(statsState);
  if (hadDays) await loadDays(statsState);
  searchIndexPromise = Promise.resolve();

  await refreshStageViews();
  dataVersion.value += 1;
}

async function switchStage(stageId) {
  currentStageId.value = stageId;
  await setSetting('currentStageId', stageId);
  await refreshStageViews();
  dataVersion.value += 1;
}

async function createStage({ name, budget }) {
  const now = Date.now();
  const record = {
    id: uid('stage'),
    name,
    budget: budget && budget > 0 ? budget : null,
    archived: false,
    createdAt: now,
    updatedAt: now
  };
  await putRecord('stages', record);
  await reloadStages();
  currentStageId.value = record.id;
  await setSetting('currentStageId', record.id);
  await refreshStageViews();
  dataVersion.value += 1;
  return record;
}

async function updateStage(stage, patch) {
  const record = {
    ...stage,
    ...patch,
    budget: patch.budget && patch.budget > 0 ? patch.budget : null,
    updatedAt: Date.now()
  };
  await putRecord('stages', record);
  await reloadStages();
  await ensureCurrentStage();
  await refreshStageViews();
  dataVersion.value += 1;
  return record;
}

async function archiveStage(stage) {
  if (stage.archived) return;
  await putRecord('stages', { ...stage, archived: true, updatedAt: Date.now() });
  await reloadStages();
  await ensureCurrentStage();
  await refreshStageViews();
  dataVersion.value += 1;
}

async function restoreStage(stage) {
  await putRecord('stages', { ...stage, archived: false, updatedAt: Date.now() });
  await reloadStages();
  await ensureCurrentStage();
  await refreshStageViews();
  dataVersion.value += 1;
}

async function deleteStage(stage) {
  await setSetting('statsDirty', true);
  await deleteByIndexRange('expenses', 'stageId', stage.id);
  await deleteRecord('stages', stage.id);
  await reloadStages();
  await ensureCurrentStage();
  await rebuildAndApplyStats();
  await refreshStageViews();
  dataVersion.value += 1;
}

async function addExpenses(entries) {
  const stage = currentStage.value;
  if (!stage) throw new Error('没有可用阶段');
  const now = Date.now();
  const records = entries.map((entry) => ({
    id: uid('expense'),
    stageId: stage.id,
    amount: Math.round(Number(entry.amount) * 100) / 100,
    category: entry.category || DEFAULT_CATEGORY,
    note: String(entry.note || '').trim(),
    spentAt: entry.spentAt,
    createdAt: now
  }));
  await commitExpenseChanges({ put: records });
  return records;
}

async function addExpense(expense) {
  const stage = currentStage.value;
  if (!stage) throw new Error('没有可用阶段');
  const record = {
    id: uid('expense'),
    stageId: stage.id,
    ...expense,
    createdAt: Date.now()
  };
  await commitExpenseChanges({ put: [record] });
  return record;
}

async function updateExpense(expense, patch) {
  const old = await getRecord('expenses', expense.id) || expense;
  const record = { ...old, ...patch, updatedAt: Date.now() };
  await commitExpenseChanges({ put: [record], remove: [old] });
  return record;
}

async function deleteExpense(expenseId) {
  const old = await getRecord('expenses', expenseId);
  if (!old) return;
  await commitExpenseChanges({ remove: [old] });
}

async function clearStageExpenses(stageId) {
  await setSetting('statsDirty', true);
  await deleteByIndexRange('expenses', 'stageId', stageId);
  await rebuildAndApplyStats();
  await refreshStageViews();
  dataVersion.value += 1;
}

async function setCategories(next) {
  let list = next.filter(Boolean);
  if (!list.includes(DEFAULT_CATEGORY)) list = [...list, DEFAULT_CATEGORY];
  categories.value = list;
  await setSetting('categories', list);
}

function stageStats(stageId) {
  return statsState.stages.get(stageId) || EMPTY_STAGE_STATS;
}

function stageSummary(stage) {
  return buildStageSummaryFromState(stage, statsState);
}

function isCategoryUsed(category) {
  for (const stage of statsState.stages.values()) {
    if (stage.categories?.[category]?.count > 0) return true;
  }
  return false;
}

function latestMonthForStage(stageId) {
  const prefix = `${stageId}|`;
  let latest = '';
  for (const key of statsState.months.keys()) {
    if (!key.startsWith(prefix)) continue;
    const month = key.slice(prefix.length);
    if (!latest || month > latest) latest = month;
  }
  return latest || currentMonthKey();
}

export function useLedger() {
  return {
    stages,
    categories,
    ready,
    loadingHint,
    dataVersion,
    activeStages,
    archivedStages,
    currentStage,
    currentStageStats,
    globalStats,
    total,
    todayStats,
    currentCatTitle,
    recentTemplates,
    recentExpenses,
    categoryGroups,
    achievementStats,
    dataYears,
    currentStageMonthStats,
    stageStats,
    stageSummary,
    isCategoryUsed,
    latestMonthForStage,
    loadMonthExpenses,
    loadYearExpenses,
    loadRecentExpenses,
    loadRecentAllExpenses,
    ensureSearchIndex,
    searchExpenses,
    loadExpensesByIds,
    ensureDaysLoaded,
    init,
    reloadAfterImport,
    switchStage,
    createStage,
    updateStage,
    archiveStage,
    restoreStage,
    deleteStage,
    addExpenses,
    addExpense,
    updateExpense,
    deleteExpense,
    clearStageExpenses,
    setCategories
  };
}
