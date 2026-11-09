import { computed, reactive, ref } from 'vue';
import { showToast } from 'vant';
import {
  getAll,
  getRecord,
  putRecord,
  deleteRecord,
  deleteByIndexRange,
  getSetting,
  setSetting,
  getAllByIndex,
  getPageByIndex,
  getMany,
  scanIndex,
  writeExpenses
} from '../lib/db';
import { DEFAULT_CATEGORY } from '../lib/parser';
import {
  DEFAULT_CATEGORY_ICONS,
  iconForCategory,
  moveCategoryInList,
  normalizeCategories,
  reorderCategoryList,
  seedCategories
} from '../utils/categories';
import { combineLocal, toDateInput, uid } from '../utils/format';
import { addCategoryTotal, finalizeCategoryTotals } from '../utils/expenses';
import { currentMonthKey, monthBounds } from '../utils/months';
import { catTitleForCategory } from '../utils/titles';
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
import { mergeStagesInWorker, undoMergeInWorker } from '../lib/dataClient';
import { buildMergePlan, mergeStageTotals } from '../utils/mergePlan';
import {
  STATS_VERSION,
  createStatsState,
  loadHomeStats,
  loadStageMonths,
  loadDays,
  backfillRecordDays,
  applyRuntimeExpenseDeltas,
  recomputeBoundsFromExpenses,
  buildAchievementStatsFromState,
  buildStageSummaryFromState,
  stageStatsFromState,
  monthStatsFromState
} from '../lib/stats';

const stages = ref([]);
const categories = ref(seedCategories());
const categoryIcons = ref({});
const currentStageId = ref(null);
const ready = ref(false);
const loadingHint = ref('果冻在翻小账本…');
const dataVersion = ref(0);
const mergeMode = ref(false);
const mergedStageIds = ref([]);
const mergeBusy = ref(false);
const statsState = reactive(createStatsState());

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

function emptyStageStats() {
  return { count: 0, total: 0, categories: {}, minDate: '', maxDate: '' };
}

const sortedStages = computed(() =>
  [...stages.value].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
);

const activeStages = computed(() => sortedStages.value.filter((stage) => !stage.archived));
const archivedStages = computed(() => sortedStages.value.filter((stage) => stage.archived));

const currentStage = computed(() =>
  stages.value.find((stage) => stage.id === currentStageId.value && !stage.archived) || null
);

const currentStageStats = computed(() => (
  currentStage.value ? stageStatsFromState(statsState, currentStage.value.id) : emptyStageStats()
));

const total = computed(() => currentStageStats.value.total || 0);

const mergedStages = computed(() => {
  const selected = new Set(mergedStageIds.value);
  return activeStages.value.filter((stage) => selected.has(stage.id));
});

const mergedTotals = computed(() => mergeStageTotals(mergedStages.value, stageStats));

const allLedgerStats = computed(() => mergeStageTotals(activeStages.value, stageStats));

const overviewStats = computed(() => (
  mergeMode.value ? mergedTotals.value : allLedgerStats.value
));

const overviewStageLabel = computed(() => {
  if (mergeMode.value) {
    const names = mergedStages.value.map((stage) => stage.name);
    return names.length ? names.join(' · ') : '还没选账本';
  }
  const n = activeStages.value.length;
  return n ? `${n} 个账本` : '还没有账本';
});

const overviewBudget = computed(() => (
  mergeMode.value ? 0 : allLedgerStats.value.budget
));

const canMerge = computed(() => activeStages.value.length >= 2);

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


const currentStageMonthStats = computed(() => {
  const stageId = currentStage.value?.id;
  if (!stageId) return new Map();
  return monthStatsFromState(statsState, stageId);
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

async function loadCategoryTotals({ stageId = null, from, to } = {}) {
  const start = combineLocal(from, '00:00');
  const end = combineLocal(to, '00:00');
  if (!start || !end) return { total: 0, items: [] };

  const startIso = start.toISOString();
  const endIso = new Date(end.getTime() + 86400000).toISOString();
  const totals = new Map();
  const add = (expense) => addCategoryTotal(totals, expense);

  if (stageId) {
    await scanIndex(
      'expenses',
      'stageId_spentAt',
      IDBKeyRange.bound([stageId, startIso], [stageId, endIso], false, true),
      add
    );
  } else {
    await scanIndex(
      'expenses',
      'spentAt',
      IDBKeyRange.bound(startIso, endIso, false, true),
      add
    );
  }

  return finalizeCategoryTotals(totals);
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

async function loadRecentExpensesForStages(stageIds, limit = 3) {
  const ids = (Array.isArray(stageIds) ? stageIds : [stageIds]).filter(Boolean);
  if (!ids.length) return [];
  const lists = await Promise.all(ids.map((id) => loadRecentExpenses(id, limit)));
  return lists
    .flat()
    .sort((a, b) => new Date(b.spentAt) - new Date(a.spentAt))
    .slice(0, limit);
}

let searchIndexPromise = null;

async function ensureSearchIndex(force = false) {
  if (!force && searchIndexPromise) return searchIndexPromise;

  const storedVersion = force ? null : await getSetting('searchVersion', null);
  if (!force && storedVersion === SEARCH_VERSION) {
    searchIndexPromise = Promise.resolve();
    return searchIndexPromise;
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
    todayStats.value = { count: 0, total: 0 };
    return;
  }

  if (statsState.monthsStageId !== '*' && statsState.monthsStageId !== stage.id) {
    await loadStageMonths(statsState, stage.id);
  }

  await refreshTodayStats();
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
  await applyRuntimeExpenseDeltas(statsState, [
    ...removed.map((expense) => ({ expense, sign: -1 })),
    ...added.map((expense) => ({ expense, sign: 1 }))
  ]);
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

  const putIds = new Set(put.map((expense) => expense.id));
  const deleteIds = remove.map((expense) => expense.id).filter((id) => !putIds.has(id));

  await writeExpenses({
    put,
    deleteIds,
    settings: [{ key: 'statsDirty', value: true }]
  });

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
  if (active.length < 2) {
    mergeMode.value = false;
    mergedStageIds.value = [];
  }
  if (!active.some((stage) => stage.id === currentStageId.value)) {
    currentStageId.value = active[0]?.id || null;
    await setSetting('currentStageId', currentStageId.value);
  }
}

async function loadCategories() {
  const stored = await getSetting('categories', null);
  const list = Array.isArray(stored) && stored.length
    ? normalizeCategories(stored)
    : seedCategories();
  categories.value = list;

  const unchanged = Array.isArray(stored) &&
    stored.length === list.length &&
    stored.every((category, index) => category === list[index]);
  if (!unchanged) await setSetting('categories', list);
  return list;
}

async function loadCategoryIcons() {
  const stored = await getSetting('categoryIcons', null);
  categoryIcons.value = stored && typeof stored === 'object' && !Array.isArray(stored)
    ? { ...stored }
    : {};
}

async function loadStagesAndCurrent() {
  await reloadStages();
  currentStageId.value = await getSetting('currentStageId', null);
  await ensureCurrentStage();
}

async function rebuildAndApplyStats() {
  statsRebuildPromise = rebuildDerivedDataInWorker({
    onProgress: (phase) => {
      const percent = REBUILD_PERCENT[phase];
      loadingHint.value = percent
        ? `果冻在整理账本… ${percent}%`
        : '果冻在整理账本…';
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
      await loadCategories();
      await loadCategoryIcons();
      await loadStagesAndCurrent();

      const storedStatsVersion = await getSetting('statsVersion', null);
      const statsDirty = await getSetting('statsDirty', false);
      if (storedStatsVersion !== STATS_VERSION || statsDirty) {
        loadingHint.value = '果冻在整理账本，第一次打开可能要等一小会儿…';
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
      showToast('账本没打开，刷新再试试吧');
    } finally {
      ready.value = true;
      loadingHint.value = '果冻在翻小账本…';
    }
  })();
  return initPromise;
}

async function reloadAfterImport() {
  await loadCategories();
  await loadCategoryIcons();
  await loadStagesAndCurrent();

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

function enterMergeMode() {
  if (!currentStage.value || !canMerge.value) return false;
  mergeMode.value = true;
  mergedStageIds.value = [currentStage.value.id];
  return true;
}

function exitMergeMode() {
  mergeMode.value = false;
  mergedStageIds.value = [];
}

function isMergingStage(stageId) {
  return mergedStageIds.value.includes(stageId);
}

function toggleMergeStage(stageId) {
  const id = String(stageId || '');
  if (!id || !activeStages.value.some((stage) => stage.id === id)) return;
  const selected = new Set(mergedStageIds.value);
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  mergedStageIds.value = [...selected];
}

function selectAllMergeStages() {
  mergedStageIds.value = activeStages.value.map((stage) => stage.id);
}

function clearMergeStages() {
  mergedStageIds.value = [];
}

async function mergeStages(targetId, { onProgress } = {}) {
  if (mergeBusy.value) throw new Error('果冻还在合并账本，等一下下吧');
  const plan = buildMergePlan({
    stages: stages.value,
    selectedIds: mergedStageIds.value,
    targetId,
    getStats: stageStats
  });
  if (!plan.ok) throw new Error(plan.error);

  const previousCurrentStageId = currentStageId.value;
  const sourceStages = plan.sources.map((stage) => ({ ...stage }));
  mergeBusy.value = true;
  try {
    const result = await mergeStagesInWorker({
      stageIds: mergedStageIds.value,
      targetId,
      onProgress: (progress) => {
        loadingHint.value = `果冻在合并账本… 已搬 ${progress.moved || 0} 笔`;
        onProgress?.(progress);
      }
    });

    await reloadStages();
    currentStageId.value = targetId;
    await setSetting('currentStageId', targetId);
    await rebuildAndApplyStats();
    await refreshStageViews();
    dataVersion.value += 1;
    mergeMode.value = false;
    mergedStageIds.value = [];

    return {
      targetId,
      previousCurrentStageId,
      sourceStages,
      movedExpenses: result.movedExpenses || []
    };
  } finally {
    mergeBusy.value = false;
    loadingHint.value = '果冻在翻小账本…';
  }
}

async function undoMergeStages(snapshot) {
  if (!snapshot || mergeBusy.value) return false;
  mergeBusy.value = true;
  try {
    await undoMergeInWorker({
      sourceStages: snapshot.sourceStages,
      movedExpenses: snapshot.movedExpenses,
      previousCurrentStageId: snapshot.previousCurrentStageId
    });

    await reloadStages();
    currentStageId.value = await getSetting('currentStageId', null);
    await ensureCurrentStage();
    await rebuildAndApplyStats();
    await refreshStageViews();
    dataVersion.value += 1;
    mergeMode.value = false;
    mergedStageIds.value = [];
    return true;
  } finally {
    mergeBusy.value = false;
    loadingHint.value = '果冻在翻小账本…';
  }
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
  mergeMode.value = false;
  mergedStageIds.value = [];
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
  mergedStageIds.value = mergedStageIds.value.filter((id) => id !== stage.id);
  await ensureCurrentStage();
  await refreshStageViews();
  dataVersion.value += 1;
}

async function restoreStage(stage) {
  const record = { ...stage, archived: false, updatedAt: Date.now() };
  delete record.mergedInto;
  delete record.mergedAt;
  await putRecord('stages', record);
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
  mergedStageIds.value = mergedStageIds.value.filter((id) => id !== stage.id);
  await ensureCurrentStage();
  await rebuildAndApplyStats();
  await refreshStageViews();
  dataVersion.value += 1;
}

async function addExpenses(entries) {
  const stage = currentStage.value;
  if (!stage) throw new Error('果冻还没有账本呢');
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
  if (!stage) throw new Error('果冻还没有账本呢');
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

async function restoreExpense(expense) {
  await commitExpenseChanges({ put: [expense] });
  return expense;
}

async function clearStageExpenses(stageId) {
  await setSetting('statsDirty', true);
  await deleteByIndexRange('expenses', 'stageId', stageId);
  await rebuildAndApplyStats();
  await refreshStageViews();
  dataVersion.value += 1;
}

async function setCategories(next) {
  const list = normalizeCategories(next);
  categories.value = list;
  await setSetting('categories', list);
}

function iconFor(name) {
  return iconForCategory(name, categoryIcons.value);
}

async function setCategoryIcon(name, icon) {
  const next = { ...categoryIcons.value };
  if (icon) next[name] = icon;
  else delete next[name];
  categoryIcons.value = next;
  await setSetting('categoryIcons', next);
}

async function moveCategory(name, delta) {
  return setCategories(moveCategoryInList(categories.value, name, delta));
}

async function reorderCategories(from, to) {
  return setCategories(reorderCategoryList(categories.value, from, to));
}

async function renameCategory(from, to) {
  const oldName = String(from || '').trim();
  const newName = String(to || '').trim();
  if (!oldName || !newName || oldName === newName) return false;
  if (oldName === DEFAULT_CATEGORY) throw new Error('「其他」是果冻的默认分类，不能改名哦');
  if (categories.value.includes(newName)) throw new Error('这个分类已经有啦');

  const affected = await getAllByIndex('expenses', 'category', oldName);
  if (affected.length) {
    const updatedAt = Date.now();
    const put = affected.map((expense) => ({ ...expense, category: newName, updatedAt }));
    await commitExpenseChanges({ remove: affected, put });
  }

  await setCategories(categories.value.map((item) => (item === oldName ? newName : item)));
  const carriedIcon = categoryIcons.value[oldName] || DEFAULT_CATEGORY_ICONS[oldName];
  if (carriedIcon) await setCategoryIcon(newName, carriedIcon);
  if (categoryIcons.value[oldName]) await setCategoryIcon(oldName, '');
  return true;
}

function stageStats(stageId) {
  return stageStatsFromState(statsState, stageId);
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
    mergeMode,
    mergedStageIds,
    mergedStages,
    mergedTotals,
    allLedgerStats,
    mergeBusy,
    overviewStats,
    overviewStageLabel,
    overviewBudget,
    canMerge,
    todayStats,
    currentCatTitle,
    categoryGroups,
    achievementStats,
    currentStageMonthStats,
    stageStats,
    stageSummary,
    isCategoryUsed,
    latestMonthForStage,
    loadMonthExpenses,
    loadCategoryTotals,
    loadRecentExpenses,
    loadRecentExpensesForStages,
    ensureSearchIndex,
    searchExpenses,
    loadExpensesByIds,
    ensureDaysLoaded,
    init,
    reloadAfterImport,
    switchStage,
    enterMergeMode,
    exitMergeMode,
    isMergingStage,
    toggleMergeStage,
    selectAllMergeStages,
    clearMergeStages,
    mergeStages,
    undoMergeStages,
    createStage,
    updateStage,
    archiveStage,
    restoreStage,
    deleteStage,
    addExpenses,
    addExpense,
    updateExpense,
    deleteExpense,
    restoreExpense,
    clearStageExpenses,
    setCategories,
    renameCategory,
    moveCategory,
    reorderCategories,
    categoryIcons,
    iconFor,
    setCategoryIcon
  };
}
