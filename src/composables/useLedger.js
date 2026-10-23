import { computed, ref } from 'vue';
import { showToast } from 'vant';
import {
  getAll,
  getSetting,
  setSetting,
  putRecord,
  putMany,
  deleteRecord,
  deleteMany
} from '../lib/db';
import { PRESET_CATEGORIES, DEFAULT_CATEGORY } from '../lib/parser';
import { dayKey, dayLabel, sumAmounts, uid } from '../utils/format';

const stages = ref([]);
const expenses = ref([]);
const categories = ref([...PRESET_CATEGORIES]);
const currentStageId = ref(null);
const ready = ref(false);
const loading = ref(false);

let initPromise = null;

const sortedStages = computed(() =>
  [...stages.value].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
);

const activeStages = computed(() => sortedStages.value.filter((stage) => !stage.archived));
const archivedStages = computed(() => sortedStages.value.filter((stage) => stage.archived));

const currentStage = computed(() =>
  stages.value.find((stage) => stage.id === currentStageId.value && !stage.archived) || null
);

const currentExpenses = computed(() =>
  expenses.value
    .filter((expense) => expense.stageId === currentStage.value?.id)
    .sort((a, b) => new Date(b.spentAt) - new Date(a.spentAt))
);

const total = computed(() => sumAmounts(currentExpenses.value));

const categoryGroups = computed(() => {
  const groups = new Map();
  for (const expense of currentExpenses.value) {
    const category = expense.category || DEFAULT_CATEGORY;
    groups.set(category, (groups.get(category) || 0) + (Number(expense.amount) || 0));
  }
  return [...groups.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
});

const groupedExpenses = computed(() => {
  const groups = new Map();
  for (const expense of currentExpenses.value) {
    const key = dayKey(new Date(expense.spentAt));
    if (!groups.has(key)) {
      groups.set(key, { key, label: dayLabel(key), total: 0, items: [] });
    }
    const group = groups.get(key);
    group.items.push(expense);
    group.total += Number(expense.amount) || 0;
  }
  return [...groups.values()];
});

function stageExpenses(stageId) {
  return expenses.value
    .filter((expense) => expense.stageId === stageId)
    .sort((a, b) => new Date(b.spentAt) - new Date(a.spentAt));
}

function stageStats(stageId) {
  const items = stageExpenses(stageId);
  return { count: items.length, total: sumAmounts(items) };
}

async function refreshExpenses() {
  expenses.value = (await getAll('expenses')).sort(
    (a, b) => new Date(b.spentAt) - new Date(a.spentAt)
  );
}

async function ensureCurrentStage() {
  const active = activeStages.value;
  if (!active.some((stage) => stage.id === currentStageId.value)) {
    currentStageId.value = active[0]?.id || null;
    await setSetting('currentStageId', currentStageId.value);
  }
}

async function reload() {
  stages.value = await getAll('stages');
  await ensureCurrentStage();
  await refreshExpenses();
}

async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    loading.value = true;
    try {
      const stored = await getSetting('categories', null);
      if (Array.isArray(stored) && stored.length) {
        categories.value = stored.includes(DEFAULT_CATEGORY)
          ? [...stored]
          : [...stored, DEFAULT_CATEGORY];
      } else {
        await setSetting('categories', categories.value);
      }

      stages.value = await getAll('stages');
      currentStageId.value = await getSetting('currentStageId', null);
      await ensureCurrentStage();
      await refreshExpenses();
    } catch (err) {
      console.error(err);
      showToast('本地数据加载失败，请刷新重试');
    } finally {
      loading.value = false;
      ready.value = true;
    }
  })();
  return initPromise;
}

async function switchStage(stageId) {
  currentStageId.value = stageId;
  await setSetting('currentStageId', stageId);
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
  await reload();
  currentStageId.value = record.id;
  await setSetting('currentStageId', record.id);
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
  await reload();
  return record;
}

async function archiveStage(stage) {
  if (stage.archived) return;
  await putRecord('stages', { ...stage, archived: true, updatedAt: Date.now() });
  await reload();
}

async function restoreStage(stage) {
  await putRecord('stages', { ...stage, archived: false, updatedAt: Date.now() });
  await reload();
}

async function deleteStage(stage) {
  const items = stageExpenses(stage.id);
  await deleteMany('expenses', items.map((expense) => expense.id));
  await deleteRecord('stages', stage.id);
  await reload();
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
  await putMany('expenses', records);
  await refreshExpenses();
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
  await putRecord('expenses', record);
  await refreshExpenses();
  return record;
}

async function updateExpense(expense, patch) {
  const record = { ...expense, ...patch, updatedAt: Date.now() };
  await putRecord('expenses', record);
  await refreshExpenses();
  return record;
}

async function deleteExpense(expenseId) {
  await deleteRecord('expenses', expenseId);
  await refreshExpenses();
}

async function clearStageExpenses(stageId) {
  const items = stageExpenses(stageId);
  await deleteMany('expenses', items.map((expense) => expense.id));
  await refreshExpenses();
}

async function setCategories(next) {
  let list = next.filter(Boolean);
  if (!list.includes(DEFAULT_CATEGORY)) list = [...list, DEFAULT_CATEGORY];
  categories.value = list;
  await setSetting('categories', list);
}

export function useLedger() {
  return {
    stages,
    expenses,
    categories,
    currentStageId,
    ready,
    loading,
    activeStages,
    archivedStages,
    currentStage,
    currentExpenses,
    total,
    categoryGroups,
    groupedExpenses,
    stageExpenses,
    stageStats,
    init,
    reload,
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
