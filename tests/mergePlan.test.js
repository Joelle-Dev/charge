import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMergePlan, mergeStageTotals } from '../src/utils/mergePlan.js';

const stages = [
  { id: 'daily', name: '本月日常', budget: 3000 },
  { id: 'travel', name: '国庆旅行', budget: 5000 },
  { id: 'home', name: '装修 2025', budget: null }
];

const stats = new Map([
  ['daily', {
    count: 23,
    total: 1280,
    categories: { 餐饮: { count: 20, amount: 1100 } },
    minDate: '2026-11-01',
    maxDate: '2026-11-03'
  }],
  ['travel', {
    count: 12,
    total: 4200,
    categories: { 交通: { count: 8, amount: 3200 } },
    minDate: '2026-10-01',
    maxDate: '2026-10-07'
  }]
]);

function getStats(id) {
  return stats.get(id);
}

test('mergeStageTotals sums counts, amounts and categories', () => {
  const result = mergeStageTotals(stages.slice(0, 2), getStats);

  assert.equal(result.count, 35);
  assert.equal(result.total, 5480);
  assert.equal(result.budget, 8000);
  assert.equal(result.budgetedStages, 2);
  assert.equal(result.stageCount, 2);
  assert.equal(result.categories['餐饮'].amount, 1100);
  assert.equal(result.categories['交通'].amount, 3200);
  assert.equal(result.minDate, '2026-10-01');
  assert.equal(result.maxDate, '2026-11-03');
});

test('mergeStageTotals only counts stages with a positive budget', () => {
  const result = mergeStageTotals(stages, getStats);

  assert.equal(result.budget, 8000);
  assert.equal(result.budgetedStages, 2);
  assert.equal(result.stageCount, 3);
});

test('buildMergePlan keeps the selected target and lists the rest as sources', () => {
  const plan = buildMergePlan({
    stages,
    selectedIds: ['daily', 'travel', 'home'],
    targetId: 'daily',
    getStats
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.target.id, 'daily');
  assert.deepEqual(plan.sources.map((stage) => stage.id), ['travel', 'home']);
  assert.equal(plan.totals.count, 35);
  assert.equal(plan.totals.total, 5480);
});

test('buildMergePlan rejects fewer than two selected stages', () => {
  const plan = buildMergePlan({
    stages,
    selectedIds: ['daily'],
    targetId: 'daily',
    getStats
  });

  assert.equal(plan.ok, false);
  assert.match(plan.error, /两个账本/);
});

test('buildMergePlan rejects a target outside the selection', () => {
  const plan = buildMergePlan({
    stages,
    selectedIds: ['daily', 'travel'],
    targetId: 'home',
    getStats
  });

  assert.equal(plan.ok, false);
  assert.match(plan.error, /目标/);
});

test('buildMergePlan rejects an archived target', () => {
  const plan = buildMergePlan({
    stages: [
      { id: 'daily', name: '本月日常', budget: 3000 },
      { id: 'travel', name: '国庆旅行', budget: 5000, archived: true }
    ],
    selectedIds: ['daily', 'travel'],
    targetId: 'travel',
    getStats
  });

  assert.equal(plan.ok, false);
  assert.match(plan.error, /归档/);
});
