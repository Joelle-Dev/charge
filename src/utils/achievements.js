import { toDateInput } from './format.js';

export const ACHIEVEMENTS = [
  {
    id: 'first-paw',
    name: '第一枚爪印',
    description: '记下第一笔支出',
    icon: 'paw',
    target: 1,
    value: (stats) => stats.totalCount
  },
  {
    id: 'ten-records',
    name: '十笔小账',
    description: '累计记录 10 笔支出',
    icon: 'paw',
    target: 10,
    value: (stats) => stats.totalCount
  },
  {
    id: 'fifty-records',
    name: '五十笔小账',
    description: '累计记录 50 笔支出',
    icon: 'paw',
    target: 50,
    value: (stats) => stats.totalCount
  },
  {
    id: 'hundred-records',
    name: '百笔小账',
    description: '累计记录 100 笔支出',
    icon: 'crown',
    target: 100,
    value: (stats) => stats.totalCount
  },
  {
    id: 'streak-3',
    name: '连续三天',
    description: '连续 3 天有记账',
    icon: 'paw',
    target: 3,
    value: (stats) => stats.streak
  },
  {
    id: 'streak-7',
    name: '一周猫爪',
    description: '连续 7 天有记账',
    icon: 'paw',
    target: 7,
    value: (stats) => stats.streak
  },
  {
    id: 'streak-30',
    name: '月度守护',
    description: '连续 30 天有记账',
    icon: 'crown',
    target: 30,
    value: (stats) => stats.streak
  },
  {
    id: 'no-spend-7',
    name: '空碗勋章',
    description: '累计 7 天没有支出',
    icon: 'bowl',
    target: 7,
    value: (stats) => stats.noSpendDays
  },
  {
    id: 'budget-keeper',
    name: '猫粮守护者',
    description: '有预算的阶段没有超支',
    icon: 'bowl',
    target: 1,
    value: (stats) => stats.budgetKeptStages
  },
  {
    id: 'stage-master',
    name: '阶段收藏家',
    description: '创建过 3 个阶段',
    icon: 'star',
    target: 3,
    value: (stats) => stats.stageCount
  }
];

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function buildAchievementStats(expenses, stages, now = new Date()) {
  const days = new Set();
  let totalAmount = 0;
  let firstDate = null;

  for (const expense of expenses) {
    const date = startOfDay(expense.spentAt);
    const key = toDateInput(date);
    days.add(key);
    totalAmount += Number(expense.amount) || 0;
    if (!firstDate || date < firstDate) firstDate = date;
  }

  let cursor = startOfDay(now);
  if (!days.has(toDateInput(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(toDateInput(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  let noSpendDays = 0;
  if (firstDate) {
    const end = startOfDay(now);
    end.setDate(end.getDate() - 1);
    const scan = new Date(firstDate);
    scan.setDate(scan.getDate() + 1);
    let guard = 0;
    while (scan <= end && guard < 3660) {
      if (!days.has(toDateInput(scan))) noSpendDays += 1;
      scan.setDate(scan.getDate() + 1);
      guard += 1;
    }
  }

  const stageExpenses = new Map();
  for (const expense of expenses) {
    const list = stageExpenses.get(expense.stageId) || [];
    list.push(expense);
    stageExpenses.set(expense.stageId, list);
  }

  let budgetKeptStages = 0;
  for (const stage of stages) {
    const items = stageExpenses.get(stage.id) || [];
    const budget = Number(stage.budget) || 0;
    if (budget <= 0 || !items.length) continue;
    const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    if (total <= budget) budgetKeptStages += 1;
  }

  return {
    totalCount: expenses.length,
    totalAmount,
    recordDays: days.size,
    streak,
    noSpendDays,
    stageCount: stages.length,
    budgetKeptStages
  };
}

export function getAchievementState(stats) {
  return ACHIEVEMENTS.map((achievement) => {
    const value = Math.min(achievement.value(stats), achievement.target);
    return {
      ...achievement,
      value,
      progress: Math.min(1, value / achievement.target),
      unlocked: value >= achievement.target
    };
  });
}
