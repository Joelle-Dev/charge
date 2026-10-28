import test from 'node:test';
import assert from 'node:assert/strict';
import { availableYears, buildAnnualSummary } from '../src/utils/annualSummary.js';

const stages = [
  { id: 's1', name: '一月', archived: false },
  { id: 's2', name: '二月', archived: true }
];

function expense(id, stageId, amount, category, date) {
  return {
    id,
    stageId,
    amount,
    category,
    note: id,
    spentAt: date.toISOString()
  };
}

const expenses = [
  expense('a', 's1', 35, '餐饮', new Date(2026, 0, 15, 12)),
  expense('b', 's1', 65, '交通', new Date(2026, 1, 2, 8)),
  expense('c', 's2', 100, '餐饮', new Date(2025, 11, 31, 23)),
  expense('d', 'missing', 20, '其他', new Date(2027, 0, 1, 9))
];

test('buildAnnualSummary aggregates months, categories and stages', () => {
  const summary = buildAnnualSummary(2026, expenses, stages);

  assert.equal(summary.year, 2026);
  assert.equal(summary.total, 100);
  assert.equal(summary.count, 2);
  assert.equal(summary.monthsWithData, 2);
  assert.equal(summary.months[0].amount, 35);
  assert.equal(summary.months[0].count, 1);
  assert.equal(summary.months[1].amount, 65);
  assert.equal(summary.months[11].amount, 0);
  assert.equal(summary.averagePerMonth, 100 / 12);
  assert.equal(summary.averagePerActiveMonth, 50);
  assert.equal(summary.maxMonthAmount, 65);
  assert.equal(summary.topCategory.category, '交通');
  assert.equal(summary.categories[0].amount, 65);
  assert.equal(summary.categories[1].percent, 35);
  assert.equal(summary.stages[0].name, '一月');
  assert.equal(summary.stages[0].amount, 100);
  assert.equal(summary.stages[0].count, 2);
  assert.equal(summary.largest.amount, 65);
  assert.equal(summary.largest.expense.id, 'b');
});

test('buildAnnualSummary handles empty years and unknown stages', () => {
  const empty = buildAnnualSummary(2030, expenses, stages);
  assert.equal(empty.total, 0);
  assert.equal(empty.count, 0);
  assert.equal(empty.months.length, 12);
  assert.equal(empty.monthsWithData, 0);
  assert.equal(empty.topCategory, null);
  assert.equal(empty.largest, null);
  assert.equal(empty.maxMonthAmount, 0);

  const unknown = buildAnnualSummary(2027, expenses, stages);
  assert.equal(unknown.stages[0].name, '未知阶段');
  assert.equal(unknown.total, 20);
});

test('annual summary uses the local calendar year', () => {
  const boundary = [
    expense('dec', 's1', 10, '餐饮', new Date(2026, 11, 31, 23, 30)),
    expense('jan', 's1', 20, '餐饮', new Date(2027, 0, 1, 0, 30))
  ];

  assert.equal(buildAnnualSummary(2026, boundary, stages).total, 10);
  assert.equal(buildAnnualSummary(2027, boundary, stages).total, 20);
});

test('availableYears returns data years in descending order', () => {
  assert.deepEqual(availableYears(expenses, new Date(2026, 5, 1)), [2027, 2026, 2025]);
  assert.deepEqual(availableYears([], new Date(2026, 5, 1)), [2026]);
});
