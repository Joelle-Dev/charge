import test from 'node:test';
import assert from 'node:assert/strict';
import { groupExpensesByDay } from '../src/utils/expenses.js';

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
