import { DEFAULT_CATEGORY } from '../lib/parser.js';

const TITLES = {
  餐饮: '干饭猫',
  交通: '出行猫',
  住宿: '旅居猫',
  购物: '剁手猫',
  娱乐: '快乐猫',
  门票: '旅行猫',
  其他: '神秘猫'
};

export function catTitleForCategory(category) {
  if (!category) return '小财迷';
  return TITLES[category] || `${category}猫`;
}

export function topCategoryFromExpenses(expenses) {
  const totals = new Map();
  for (const expense of expenses) {
    const category = expense.category || DEFAULT_CATEGORY;
    totals.set(category, (totals.get(category) || 0) + (Number(expense.amount) || 0));
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

export function catTitleForExpenses(expenses) {
  return catTitleForCategory(topCategoryFromExpenses(expenses));
}
