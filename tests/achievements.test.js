import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAchievementStats, getAchievementState } from '../src/utils/achievements.js';
import { catTitleForExpenses } from '../src/utils/titles.js';
import { buildStageSummary } from '../src/utils/summary.js';

const now = new Date('2026-10-26T12:00:00+08:00');
const expenses = [
  { amount: 35, category: '餐饮', note: '午饭', spentAt: '2026-10-24T12:00:00+08:00', stageId: 'a' },
  { amount: 20, category: '交通', note: '打车', spentAt: '2026-10-25T12:00:00+08:00', stageId: 'a' },
  { amount: 10, category: '餐饮', note: '咖啡', spentAt: '2026-10-26T12:00:00+08:00', stageId: 'a' }
];
const stages = [{ id: 'a', name: '测试阶段', budget: 100 }];

test('achievement stats and unlock states are derived from history', () => {
  const stats = buildAchievementStats(expenses, stages, now);
  assert.equal(stats.totalCount, 3);
  assert.equal(stats.streak, 3);
  assert.equal(stats.budgetKeptStages, 1);

  const state = getAchievementState(stats);
  assert.equal(state.find((item) => item.id === 'first-paw').unlocked, true);
  assert.equal(state.find((item) => item.id === 'streak-3').unlocked, true);
  assert.equal(state.find((item) => item.id === 'streak-7').unlocked, false);
});

test('cat title follows the top category', () => {
  assert.equal(catTitleForExpenses(expenses), '干饭猫');
  assert.equal(catTitleForExpenses([]), '小财迷');
});

test('stage summary includes range, totals and top categories', () => {
  const summary = buildStageSummary(stages[0], expenses);
  assert.equal(summary.count, 3);
  assert.equal(summary.total, 65);
  assert.equal(summary.remaining, 35);
  assert.equal(summary.from, '2026-10-24');
  assert.equal(summary.to, '2026-10-26');
  assert.equal(summary.topCategories[0].category, '餐饮');
  assert.equal(summary.topCategories[0].amount, 45);
  assert.equal(summary.catTitle, '干饭猫');
});
