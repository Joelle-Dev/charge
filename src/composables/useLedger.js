import { computed, reactive, ref } from 'vue';
import { showToast } from 'vant';
import {
  getAll,
  getRecord,
  putRecord,
  putMany,
  deleteRecord,
  deleteMany,
  clearStores,
  getSetting,
  setSetting,
  getAllByIndex,
  getPageByIndex
} from '../lib/db';
import { PRESET_CATEGORIES, DEFAULT_CATEGORY } from '../lib/parser';
import { toDateInput, uid } from '../utils/format';
import { currentMonthKey } from '../utils/months';
import { catTitleForCategory } from '../utils/titles';
import { buildTemplates, mergeTemplates } from '../utils/templates';
import {
  applySearchChunkChanges,
  compactExpense,
  searchChunkKey,
  searchChunkMonth,
  searchChunksForStage
} from '../lib/searchIndex';
import {
  STATS_VERSION,
  createStatsState,
  loadStatsState,
  rebuildDerivedData,
  applyExpenseDelta,
  statKeysForExpense,
  statsEntriesAndDeletesForKeys,
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

const categoryGroups = computed(() => (
  Object.entries(currentStageStats.value.categories || {})
    .map(([category, value]) => ({ category, amount: value.amount || 0 }))
    .sort((a, b) => b.amount - a.amount)
));

const currentCatTitle = computed(() => catTitleForCategory(categoryGroups.value[0]?.category || ''));

const todayStats = computed(() => {
  const stageId = currentStage.value?.id;
  if (!stageId) return { count: 0, total: 0 };
  return statsState.stageDays.get(`${stageId}|${toDateInput(new Date())}`) || { count: 0, total: 0 };
});

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
  statsState.stageDays = state.stageDays;
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

async function loadStageExpenses(stageId) {
  const items = await getAllByIndex('expenses', 'stageId', stageId);
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

async function loadSearchIndex(stageId) {
  if (!stageId) return [];
  const chunks = await getAllByIndex('searchChunks', 'stageId', stageId);
  return searchChunksForStage(chunks);
}

async function refreshStageViews() {
  const stage = currentStage.value;
  if (!stage) {
    recentExpenses.value = [];
    recentTemplates.value = [];
    return;
  }

  const [recent, currentRecent, allRecent] = await Promise.all([
    loadRecentExpenses(stage.id, 3),
    loadRecentExpenses(stage.id, 200),
    loadRecentAllExpenses(200)
  ]);

  recentExpenses.value = recent;
  recentTemplates.value = mergeTemplates(
    buildTemplates(currentRecent, 3),
    buildTemplates(allRecent, 3),
    3
  );
}

async function persistStatKeys(keys) {
  const { entries, deletes } = statsEntriesAndDeletesForKeys(statsState, keys);
  if (entries.length) await putMany('stats', entries);
  if (deletes.length) await deleteMany('stats', deletes);
}

async function applyStatsChanges(removed = [], added = []) {
  const keys = new Set();
  for (const expense of removed) {
    for (const key of statKeysForExpense(expense)) keys.add(key);
    applyExpenseDelta(statsState, expense, -1);
  }
  for (const expense of added) {
    for (const key of statKeysForExpense(expense)) keys.add(key);
    applyExpenseDelta(statsState, expense, 1);
  }
  await persistStatKeys(keys);
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
  for (const expense of added) ensureGroup(expense).addRows.push(compactExpense(expense));

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
        rows: items.map(compactExpense)
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
  await setSetting('statsDirty', true);

  if (remove.length) {
    await deleteMany('expenses', remove.map((expense) => expense.id));
  }
  if (put.length) {
    await putMany('expenses', put);
  }

  await applyStatsChanges(remove, put);
  await updateSearchChunks(remove, put);
  await setSetting('statsDirty', false);
  await refreshStageViews();
  dataVersion.value += 1;
}

function stageExpenseIds(stageId) {
  return getAllByIndex('expenses', 'stageId', stageId).then((items) => items.map((item) => item.id));
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
  const state = await rebuildDerivedData();
  setStatsState(state);
  await setSetting('statsVersion', STATS_VERSION);
  await setSetting('statsDirty', false);
  return state;
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
        setStatsState(await loadStatsState());
      }

      await refreshStageViews();
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
  const ids = await stageExpenseIds(stage.id);
  if (ids.length) await deleteMany('expenses', ids);
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
  const ids = await stageExpenseIds(stageId);
  if (ids.length) await deleteMany('expenses', ids);
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

async function putManyChunked(storeName, values, chunkSize = 1000) {
  for (let index = 0; index < values.length; index += chunkSize) {
    await putMany(storeName, values.slice(index, index + chunkSize));
  }
}

async function importBackup(prepared, mode = 'merge') {
  await setSetting('statsDirty', true);

  if (mode === 'replace') {
    await clearStores(['stages', 'expenses', 'stats']);
  }

  await putManyChunked('stages', prepared.stages);
  await putManyChunked('expenses', prepared.expenses);

  categories.value = prepared.categories;
  await setSetting('categories', prepared.categories);

  currentStageId.value = prepared.currentStageId;
  await setSetting('currentStageId', prepared.currentStageId);

  await reloadStages();
  await ensureCurrentStage();
  await rebuildAndApplyStats();
  await refreshStageViews();
  dataVersion.value += 1;

  return {
    stages: prepared.stages.length,
    expenses: prepared.expenses.length
  };
}

async function importCsv({
  stageId = null,
  stageName = '',
  budget = null,
  expenses: rows = [],
  categories: incomingCategories = [],
  skipDuplicates = true
} = {}) {
  if (!rows.length) {
    return { imported: 0, skipped: 0, createdStage: false };
  }

  const now = Date.now();
  let stage = stages.value.find((item) => item.id === stageId) || null;
  const createdStage = !stage;
  if (!stage) {
    const name = String(stageName || '').trim() || '导入数据';
    stage = {
      id: uid('stage'),
      name,
      budget: Number(budget) > 0 ? Math.round(Number(budget) * 100) / 100 : null,
      archived: false,
      createdAt: now,
      updatedAt: now
    };
  }

  const existing = createdStage ? [] : await getAllByIndex('expenses', 'stageId', stage.id);
  const signatures = new Set(
    existing.map((expense) => `${expense.spentAt}|${Number(expense.amount).toFixed(2)}|${expense.category}|${expense.note}`)
  );

  const records = [];
  let skipped = 0;
  for (const row of rows) {
    const signature = `${row.spentAt}|${Number(row.amount).toFixed(2)}|${row.category}|${row.note}`;
    if (skipDuplicates && signatures.has(signature)) {
      skipped += 1;
      continue;
    }
    signatures.add(signature);
    records.push({
      id: uid('expense'),
      stageId: stage.id,
      amount: row.amount,
      category: row.category,
      note: row.note,
      spentAt: row.spentAt,
      createdAt: now
    });
  }

  if (!records.length) {
    return { imported: 0, skipped, createdStage: false, stageName: stage.name };
  }

  await setSetting('statsDirty', true);
  if (createdStage) await putRecord('stages', stage);
  await putManyChunked('expenses', records);

  const nextCategories = [...new Set([
    ...categories.value,
    ...incomingCategories,
    DEFAULT_CATEGORY
  ])];
  categories.value = nextCategories;
  await setSetting('categories', nextCategories);

  await reloadStages();
  await ensureCurrentStage();
  await rebuildAndApplyStats();
  await refreshStageViews();
  dataVersion.value += 1;

  return {
    imported: records.length,
    skipped,
    createdStage,
    stageName: stage.name,
    stageId: stage.id
  };
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
    loadStageExpenses,
    loadRecentExpenses,
    loadRecentAllExpenses,
    loadSearchIndex,
    init,
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
    setCategories,
    importBackup,
    importCsv
  };
}
