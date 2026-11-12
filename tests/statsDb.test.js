import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

const { clearStores, putMany } = await import('../src/lib/db.js');
const {
  applyRuntimeExpenseDeltas,
  buildStatsFromExpenses,
  loadDayStats,
  loadHomeStats,
  statsEntriesFromState
} = await import('../src/lib/stats.js');

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

test('per-stage day stats are written on rebuild and kept in sync by deltas', async () => {
  await clearStores(['stats', 'expenses']);

  const day = new Date(2026, 0, 2, 12);
  const expenses = [
    expense('a', 's1', 35, '餐饮', day),
    expense('b', 's1', 65, '交通', day),
    expense('c', 's2', 30, '购物', day)
  ];

  const built = buildStatsFromExpenses(expenses);
  await putMany('stats', statsEntriesFromState(built));

  const initial = await loadDayStats({ stageId: 's1' });
  assert.equal(initial.days.get('2026-01-02').count, 2);
  assert.equal(initial.days.get('2026-01-02').total, 100);

  const state = await loadHomeStats();
  const added = expense('d', 's1', 25, '餐饮', new Date(2026, 0, 2, 20));
  await applyRuntimeExpenseDeltas(state, [{ expense: added, sign: 1 }]);

  const afterAdd = await loadDayStats({ stageId: 's1' });
  assert.equal(afterAdd.days.get('2026-01-02').total, 125);

  await applyRuntimeExpenseDeltas(state, [{ expense: added, sign: -1 }]);
  const afterRemove = await loadDayStats({ stageId: 's1' });
  assert.equal(afterRemove.days.get('2026-01-02').total, 100);

  const otherStage = await loadDayStats({ stageId: 's2' });
  assert.equal(otherStage.days.get('2026-01-02').total, 30);
});
