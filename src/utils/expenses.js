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
