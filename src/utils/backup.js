import { DEFAULT_CATEGORY } from '../lib/parser.js';
import { uid } from './format.js';

export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_APP_NAME = 'shoucai-xiaoguo';

function cleanText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeTimestamp(value, fallback = Date.now()) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function buildBackup({
  stages = [],
  expenses = [],
  categories = [],
  currentStageId = null,
  achievementUnlocked = [],
  now = new Date()
} = {}) {
  return {
    app: BACKUP_APP_NAME,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    categories: [...categories],
    currentStageId: currentStageId || null,
    achievementUnlocked: [...new Set(achievementUnlocked)],
    stages: stages.map((stage) => ({ ...stage })),
    expenses: expenses.map((expense) => ({ ...expense }))
  };
}

function normalizeBackup(raw) {
  const errors = [];
  const stageIds = new Set();
  const stages = [];

  raw.stages.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`阶段 ${index + 1} 格式不正确`);
      return;
    }

    const name = cleanText(item.name);
    if (!name) {
      errors.push(`阶段 ${index + 1} 缺少名称`);
      return;
    }

    let id = cleanText(item.id);
    if (!id) id = uid('stage');
    if (stageIds.has(id)) {
      errors.push(`阶段「${name}」的 ID 重复，已跳过`);
      return;
    }
    stageIds.add(id);

    const budget = Number(item.budget);
    stages.push({
      id,
      name,
      budget: Number.isFinite(budget) && budget > 0 ? Math.round(budget * 100) / 100 : null,
      archived: Boolean(item.archived),
      createdAt: normalizeTimestamp(item.createdAt),
      updatedAt: normalizeTimestamp(item.updatedAt)
    });
  });

  const expenseIds = new Set();
  const expenses = [];
  const expenseCategories = [];

  raw.expenses.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`第 ${index + 1} 笔支出格式不正确`);
      return;
    }

    const stageId = cleanText(item.stageId);
    if (!stageIds.has(stageId)) {
      errors.push(`第 ${index + 1} 笔支出找不到所属阶段`);
      return;
    }

    const amount = Number(item.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`第 ${index + 1} 笔支出金额无效`);
      return;
    }

    const spent = new Date(item.spentAt);
    if (Number.isNaN(spent.getTime())) {
      errors.push(`第 ${index + 1} 笔支出日期无效`);
      return;
    }

    let id = cleanText(item.id);
    if (!id || expenseIds.has(id)) id = uid('expense');
    expenseIds.add(id);

    const category = cleanText(item.category, DEFAULT_CATEGORY);
    expenseCategories.push(category);

    expenses.push({
      id,
      stageId,
      amount: Math.round(amount * 100) / 100,
      category,
      note: cleanText(item.note),
      spentAt: spent.toISOString(),
      createdAt: normalizeTimestamp(item.createdAt),
      ...(item.updatedAt ? { updatedAt: normalizeTimestamp(item.updatedAt) } : {})
    });
  });

  const rawCategories = Array.isArray(raw.categories)
    ? raw.categories.map((category) => cleanText(category)).filter(Boolean)
    : [];
  const categories = [...new Set([...rawCategories, ...expenseCategories, DEFAULT_CATEGORY])];

  const achievementUnlocked = Array.isArray(raw.achievementUnlocked)
    ? [...new Set(raw.achievementUnlocked.map((id) => cleanText(id)).filter(Boolean))]
    : [];

  return {
    data: {
      stages,
      expenses,
      categories,
      currentStageId: cleanText(raw.currentStageId) || null,
      achievementUnlocked
    },
    errors
  };
}

export function parseBackup(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { error: '不是有效的 JSON 文件' };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: '备份文件格式不正确' };
  }

  if (raw.app && raw.app !== BACKUP_APP_NAME) {
    return { error: '这不是守财小果的备份文件' };
  }

  const version = Number(raw.schemaVersion);
  if (Number.isFinite(version) && version > BACKUP_SCHEMA_VERSION) {
    return { error: '备份来自更新版本的应用，请升级后再导入' };
  }

  if (!Array.isArray(raw.stages) || !Array.isArray(raw.expenses)) {
    return { error: '备份缺少阶段或支出数据' };
  }

  return normalizeBackup(raw);
}

export function prepareBackupImport(data, options = {}) {
  const {
    mode = 'merge',
    existingStages = [],
    existingCategories = [],
    existingAchievements = [],
    existingCurrentStageId = null,
    mergeIntoStageId = null
  } = options;
  const merge = mode === 'merge';
  const now = Date.now();

  const categories = [...new Set([
    ...(merge ? existingCategories : []),
    ...data.categories,
    DEFAULT_CATEGORY
  ])];

  const achievementUnlocked = [...new Set([
    ...(merge ? existingAchievements : []),
    ...data.achievementUnlocked
  ])];

  if (merge && mergeIntoStageId) {
    const expenses = data.expenses.map((expense) => ({
      ...expense,
      id: uid('expense'),
      stageId: mergeIntoStageId,
      createdAt: expense.createdAt || now
    }));
    return {
      stages: [],
      expenses,
      categories,
      currentStageId: mergeIntoStageId,
      achievementUnlocked,
      counts: {
        stages: 0,
        expenses: expenses.length
      }
    };
  }

  const stageIdMap = new Map();

  const stages = data.stages.map((stage) => {
    const id = merge ? uid('stage') : stage.id;
    stageIdMap.set(stage.id, id);
    return { ...stage, id, updatedAt: now };
  });

  const expenses = data.expenses
    .filter((expense) => stageIdMap.has(expense.stageId))
    .map((expense) => ({
      ...expense,
      id: merge ? uid('expense') : expense.id,
      stageId: stageIdMap.get(expense.stageId),
      createdAt: expense.createdAt || now
    }));

  const firstActive = stages.find((stage) => !stage.archived)?.id || null;
  let currentStageId = firstActive;

  if (merge) {
    const existing = existingStages.find((stage) => (
      stage.id === existingCurrentStageId && !stage.archived
    ));
    currentStageId = existing?.id || firstActive ||
      existingStages.find((stage) => !stage.archived)?.id || null;
  } else {
    const selected = stages.find((stage) => (
      stage.id === data.currentStageId && !stage.archived
    ));
    currentStageId = selected?.id || firstActive;
  }

  return {
    stages,
    expenses,
    categories,
    currentStageId,
    achievementUnlocked,
    counts: {
      stages: stages.length,
      expenses: expenses.length
    }
  };
}

export function backupFilename(now = new Date()) {
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `守财小果-完整备份-${date}.json`;
}

export function downloadTextFile(text, filename, type = 'application/json;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
