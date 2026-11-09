import { DEFAULT_CATEGORY } from '../lib/parser.js';
import { dayKey, dayLabel } from './format.js';

export function groupExpensesByDay(expenses = []) {
  const groups = new Map();

  for (const expense of expenses) {
    const key = dayKey(new Date(expense.spentAt));
    let group = groups.get(key);
    if (!group) {
      group = { key, label: dayLabel(key), total: 0, items: [] };
      groups.set(key, group);
    }
    group.items.push(expense);
    group.total += Number(expense.amount) || 0;
  }

  return [...groups.values()];
}

export function addCategoryTotal(totals, expense) {
  const amount = Number(expense?.amount) || 0;
  if (!amount) return;
  const category = expense.category || DEFAULT_CATEGORY;
  const item = totals.get(category) || { category, amount: 0, count: 0 };
  item.amount += amount;
  item.count += 1;
  totals.set(category, item);
}

export function finalizeCategoryTotals(totals) {
  const items = [...totals.values()].sort((a, b) => b.amount - a.amount);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  for (const item of items) {
    item.percent = total ? (item.amount / total) * 100 : 0;
  }
  return { total, items };
}

export function summarizeCategoryTotals(expenses = []) {
  const totals = new Map();
  for (const expense of expenses) addCategoryTotal(totals, expense);
  return finalizeCategoryTotals(totals);
}

export function collapseCategoryTotals(items = [], limit = 5) {
  const list = Array.isArray(items) ? items : [];
  const max = Math.max(0, Number(limit) || 0);
  if (list.length <= max + 1) {
    return { items: [...list], collapsed: false, hiddenCount: 0 };
  }

  const visible = list.slice(0, max);
  const rest = list.slice(max);
  const amount = rest.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const percent = rest.reduce((sum, item) => sum + (Number(item.percent) || 0), 0);
  const count = rest.reduce((sum, item) => sum + (Number(item.count) || 0), 0);

  return {
    items: [
      ...visible,
      {
        category: `其余 ${rest.length} 类`,
        amount,
        percent,
        count,
        isRest: true
      }
    ],
    collapsed: true,
    hiddenCount: rest.length
  };
}
