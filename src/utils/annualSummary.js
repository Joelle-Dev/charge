import { DEFAULT_CATEGORY } from '../lib/parser.js';
import { dayKey } from './format.js';

export function buildAnnualSummary(year, expenses = [], stages = []) {
  const targetYear = Number(year);
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    amount: 0,
    count: 0,
    items: []
  }));
  const categoryTotals = new Map();
  const stageTotals = new Map();
  const items = [];
  let total = 0;
  let largest = null;

  for (const expense of expenses) {
    const date = new Date(expense.spentAt);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== targetYear) continue;

    const amount = Number(expense.amount) || 0;
    if (amount <= 0) continue;

    items.push(expense);
    total += amount;

    const month = months[date.getMonth()];
    month.amount += amount;
    month.count += 1;
    month.items.push(expense);

    const category = expense.category || DEFAULT_CATEGORY;
    const categoryItem = categoryTotals.get(category) || { amount: 0, count: 0 };
    categoryItem.amount += amount;
    categoryItem.count += 1;
    categoryTotals.set(category, categoryItem);

    const stageId = expense.stageId || '';
    const stageItem = stageTotals.get(stageId) || { amount: 0, count: 0 };
    stageItem.amount += amount;
    stageItem.count += 1;
    stageTotals.set(stageId, stageItem);

    if (!largest || amount > largest.amount) {
      largest = {
        expense,
        amount,
        dateKey: dayKey(date)
      };
    }
  }

  const categories = [...categoryTotals.entries()]
    .map(([category, item]) => ({
      category,
      amount: item.amount,
      count: item.count,
      percent: total > 0 ? (item.amount / total) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  const stageNames = new Map(stages.map((stage) => [stage.id, stage.name]));
  const stageRows = [...stageTotals.entries()]
    .map(([stageId, item]) => ({
      stageId,
      name: stageNames.get(stageId) || '未知阶段',
      amount: item.amount,
      count: item.count,
      percent: total > 0 ? (item.amount / total) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  const monthsWithData = months.filter((month) => month.count > 0).length;

  return {
    year: targetYear,
    total,
    count: items.length,
    months,
    monthsWithData,
    averagePerMonth: total / 12,
    averagePerActiveMonth: monthsWithData ? total / monthsWithData : 0,
    categories,
    stages: stageRows,
    topCategory: categories[0] || null,
    largest,
    maxMonthAmount: Math.max(0, ...months.map((month) => month.amount))
  };
}

export function availableYears(expenses = [], now = new Date()) {
  const years = new Set();
  for (const expense of expenses) {
    const date = new Date(expense.spentAt);
    if (!Number.isNaN(date.getTime())) years.add(date.getFullYear());
  }
  if (!years.size) years.add(now.getFullYear());
  return [...years].sort((a, b) => b - a);
}
