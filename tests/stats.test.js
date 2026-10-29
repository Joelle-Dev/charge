import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyExpenseDelta,
  buildAchievementStatsFromState,
  buildStageSummaryFromState,
  buildStatsFromExpenses,
  createStatsState,
  statKeysForExpense,
  statsEntriesAndDeletesForKeys,
  statsEntriesFromState,
  statsStateFromEntries
} from '../src/lib/stats.js';

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

const stage = { id: 's1', name: '测试阶段', budget: 200 };
const otherStage = { id: 's2', name: '其他阶段', budget: 50 };
const expenses = [
  expense('a', 's1', 35, '餐饮', new Date(2026, 0, 2, 12)),
  expense('b', 's1', 65, '交通', new Date(2026, 0, 2, 18)),
  expense('c', 's1', 100, '餐饮', new Date(2026, 1, 10, 12)),
  expense('d', 's2', 30, '购物', new Date(2026, 1, 11, 12))
];

test('stats state aggregates global, stage, month and day buckets', () => {
  const state = buildStatsFromExpenses(expenses);
  assert.equal(state.global.count, 4);
  assert.equal(state.global.total, 230);
  assert.equal(state.global.minDate, '2026-01-02');
  assert.equal(state.global.maxDate, '2026-02-11');

  const stats = state.stages.get('s1');
  assert.equal(stats.count, 3);
  assert.equal(stats.total, 200);
  assert.equal(stats.categories['餐饮'].amount, 135);
  assert.equal(stats.categories['餐饮'].count, 2);
  assert.equal(stats.minDate, '2026-01-02');
  assert.equal(stats.maxDate, '2026-02-10');

  assert.equal(state.days.get('2026-01-02').count, 2);
  assert.equal(state.days.get('2026-01-02').total, 100);
  assert.equal(state.months.get('s1|2026-01').count, 2);
  assert.equal(state.months.get('s1|2026-02').total, 100);
});

test('stats deltas remove records and clean empty buckets', () => {
  const state = createStatsState();
  for (const item of expenses) applyExpenseDelta(state, item, 1);

  applyExpenseDelta(state, expenses[0], -1);
  applyExpenseDelta(state, expenses[1], -1);
  applyExpenseDelta(state, expenses[2], -1);
  applyExpenseDelta(state, expenses[3], -1);

  assert.equal(state.global.count, 0);
  assert.equal(state.global.total, 0);
  assert.equal(state.stages.size, 0);
  assert.equal(state.days.size, 0);
  assert.equal(state.months.size, 0);
});

test('stats keys cover all affected buckets', () => {
  const keys = statKeysForExpense(expenses[0]);
  assert.deepEqual(keys, [
    'global',
    'stage:s1',
    'day:2026-01-02',
    'month:s1:2026-01'
  ]);
});

test('achievement stats are derived from day and stage aggregates', () => {
  const state = buildStatsFromExpenses(expenses);
  const stats = buildAchievementStatsFromState(state, [stage, otherStage], new Date(2026, 1, 12, 12));

  assert.equal(stats.totalCount, 4);
  assert.equal(stats.totalAmount, 230);
  assert.equal(stats.recordDays, 3);
  assert.equal(stats.stageCount, 2);
  assert.equal(stats.budgetKeptStages, 2);
});

test('stage summary is built from stats without expense records', () => {
  const state = buildStatsFromExpenses(expenses);
  const summary = buildStageSummaryFromState(stage, state);

  assert.equal(summary.count, 3);
  assert.equal(summary.total, 200);
  assert.equal(summary.from, '2026-01-02');
  assert.equal(summary.to, '2026-02-10');
  assert.equal(summary.topCategories[0].category, '餐饮');
  assert.equal(summary.catTitle, '干饭猫');
  assert.equal(summary.remaining, 0);
});


test('stats entries use storage key prefixes and round-trip', () => {
  const state = buildStatsFromExpenses(expenses);
  const entries = statsEntriesFromState(state);
  const day = entries.find((entry) => entry.key === 'day:2026-01-02');
  const month = entries.find((entry) => entry.key === 'month:s1:2026-01');

  assert.equal(day.total, 100);
  assert.equal(month.total, 100);

  const restored = statsStateFromEntries(entries);
  assert.equal(restored.days.get('2026-01-02').count, 2);
  assert.equal(restored.months.get('s1|2026-01').total, 100);
});

test('stats delta keys keep storage key prefixes', () => {
  const state = buildStatsFromExpenses(expenses);
  const result = statsEntriesAndDeletesForKeys(state, [
    'day:2026-01-02',
    'month:s1:2026-01',
    'day:2020-01-01'
  ]);

  assert.deepEqual(result.entries.map((entry) => entry.key), [
    'day:2026-01-02',
    'month:s1:2026-01'
  ]);
  assert.deepEqual(result.deletes, ['day:2020-01-01']);
});
