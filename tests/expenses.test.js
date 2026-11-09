import test from 'node:test';
import assert from 'node:assert/strict';
import { groupExpensesByDay, collapseCategoryTotals, summarizeCategoryTotals } from '../src/utils/expenses.js';

function expense(id, amount, date) {
  return {
    id,
    amount,
    category: '餐饮',
    note: id,
    spentAt: date.toISOString()
  };
}

test('groupExpensesByDay groups items by local day and sums amounts', () => {
  const groups = groupExpensesByDay([
    expense('a', 12.5, new Date(2026, 4, 2, 12)),
    expense('b', 7.5, new Date(2026, 4, 2, 18)),
    expense('c', 20, new Date(2026, 4, 1, 9))
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].key, '2026-05-02');
  assert.equal(groups[0].total, 20);
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[1].key, '2026-05-01');
  assert.equal(groups[1].total, 20);
});

test('groupExpensesByDay handles empty input and numeric strings', () => {
  assert.deepEqual(groupExpensesByDay(), []);

  const groups = groupExpensesByDay([
    expense('a', '10.5', new Date(2026, 0, 1, 12))
  ]);

  assert.equal(groups[0].total, 10.5);
});

test('summarizeCategoryTotals sorts by amount and computes percentages', () => {
  const result = summarizeCategoryTotals([
    { amount: 30, category: '餐饮' },
    { amount: 10, category: '交通' },
    { amount: 10, category: '餐饮' },
    { amount: 0, category: '其他' }
  ]);

  assert.equal(result.total, 50);
  assert.deepEqual(result.items.map((item) => item.category), ['餐饮', '交通']);
  assert.equal(result.items[0].count, 2);
  assert.equal(result.items[0].amount, 40);
  assert.equal(result.items[0].percent, 80);
  assert.equal(result.items[1].percent, 20);
});

test('summarizeCategoryTotals falls back to the default category and empty input', () => {
  const result = summarizeCategoryTotals([{ amount: 4 }]);
  assert.equal(result.items[0].category, '其他');
  assert.equal(result.items[0].percent, 100);
  assert.deepEqual(summarizeCategoryTotals(), { total: 0, items: [] });
});

test('collapseCategoryTotals keeps short lists unchanged', () => {
  const items = [
    { category: '餐饮', amount: 30, percent: 60, count: 2 },
    { category: '交通', amount: 20, percent: 40, count: 1 }
  ];
  const result = collapseCategoryTotals(items, 5);
  assert.equal(result.collapsed, false);
  assert.deepEqual(result.items, items);
});

test('collapseCategoryTotals does not collapse a list of limit + 1 items', () => {
  const items = Array.from({ length: 6 }, (_, index) => ({
    category: `分类${index}`,
    amount: 10,
    percent: 10,
    count: 1
  }));
  const result = collapseCategoryTotals(items, 5);
  assert.equal(result.collapsed, false);
  assert.equal(result.items.length, 6);
});

test('collapseCategoryTotals merges the tail into a rest row', () => {
  const items = Array.from({ length: 8 }, (_, index) => ({
    category: `分类${index}`,
    amount: (8 - index) * 10,
    percent: (8 - index) * 2,
    count: index + 1
  }));
  const result = collapseCategoryTotals(items, 5);

  assert.equal(result.collapsed, true);
  assert.equal(result.hiddenCount, 3);
  assert.equal(result.items.length, 6);
  assert.deepEqual(result.items.slice(0, 5).map((item) => item.category), [
    '分类0', '分类1', '分类2', '分类3', '分类4'
  ]);

  const rest = result.items[5];
  assert.equal(rest.isRest, true);
  assert.equal(rest.category, '其余 3 类');
  assert.equal(rest.amount, 30 + 20 + 10);
  assert.equal(rest.percent, 6 + 4 + 2);
  assert.equal(rest.count, 6 + 7 + 8);
});
