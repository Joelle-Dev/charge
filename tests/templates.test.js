import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTemplates, mergeTemplates } from '../src/utils/templates.js';

const stageA = [
  { amount: 35, category: '餐饮', note: '午饭', spentAt: '2026-10-01T12:00:00+08:00' },
  { amount: 35, category: '餐饮', note: '午饭', spentAt: '2026-10-02T12:00:00+08:00' },
  { amount: 18, category: '餐饮', note: '咖啡', spentAt: '2026-10-03T12:00:00+08:00' }
];
const history = [
  { amount: 25, category: '交通', note: '打车', spentAt: '2026-09-01T12:00:00+08:00' },
  { amount: 25, category: '交通', note: '打车', spentAt: '2026-09-02T12:00:00+08:00' },
  { amount: 120, category: '门票', note: '门票', spentAt: '2026-09-03T12:00:00+08:00' },
  { amount: 35, category: '餐饮', note: '午饭', spentAt: '2026-09-04T12:00:00+08:00' }
];

test('current stage templates come first and are filled from history', () => {
  const current = buildTemplates(stageA);
  const merged = mergeTemplates(current, buildTemplates(history), 3);

  assert.deepEqual(merged.map((item) => `${item.note}:${item.amount}`), [
    '午饭:35',
    '咖啡:18',
    '打车:25'
  ]);
});

test('duplicate templates do not repeat when filling history', () => {
  const current = buildTemplates([stageA[0]]);
  const merged = mergeTemplates(current, buildTemplates(history), 3);
  assert.equal(merged.filter((item) => item.note === '午饭').length, 1);
});
