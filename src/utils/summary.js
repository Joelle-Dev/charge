import { DEFAULT_CATEGORY } from '../lib/parser.js';
import { toDateInput } from './format.js';
import { catTitleForExpenses } from './titles.js';

export function buildStageSummary(stage, expenses) {
  const items = [...expenses].sort((a, b) => new Date(a.spentAt) - new Date(b.spentAt));
  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const categoryTotals = new Map();

  for (const expense of items) {
    const category = expense.category || DEFAULT_CATEGORY;
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + (Number(expense.amount) || 0));
  }

  const topCategories = [...categoryTotals.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const budget = Number(stage.budget) || 0;
  const first = items[0];
  const last = items[items.length - 1];

  return {
    stage,
    count: items.length,
    total,
    budget,
    remaining: budget > 0 ? budget - total : null,
    from: first ? toDateInput(new Date(first.spentAt)) : '',
    to: last ? toDateInput(new Date(last.spentAt)) : '',
    topCategories,
    catTitle: catTitleForExpenses(items)
  };
}
