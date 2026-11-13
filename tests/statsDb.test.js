import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

const { clearStores, getAllByRange, putMany } = await import('../src/lib/db.js');
const {
  applyRuntimeExpenseDeltas,
  buildStatsFromExpenses,
  loadDayStats,
  loadDayTotals,
  loadHomeStats,
  rebuildDerivedData,
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

test('loadDayTotals aggregates straight from the expenses store', async () => {
  await clearStores(['stats', 'expenses']);

  await putMany('expenses', [
    expense('o1', 's1', 10, '餐饮', new Date(2026, 9, 3, 12)),
    expense('o2', 's1', 5, '餐饮', new Date(2026, 9, 20, 12)),
    expense('o3', 's2', 7, '交通', new Date(2026, 10, 2, 12))
  ]);

  const { days } = await loadDayTotals({ stageIds: ['s1'] });
  assert.equal(days.get('2026-10-03').total, 10);
  assert.equal(days.get('2026-10-20').total, 5);
  assert.equal(days.has('2026-11-02'), false);
  assert.equal([...days.values()].reduce((sum, bucket) => sum + bucket.count, 0), 2);
});

test('derived rebuild writes search chunk metadata next to the index', async () => {
  await clearStores(['stats', 'expenses', 'searchChunks']);

  const day = new Date(2026, 2, 3, 12);
  await putMany('expenses', [
    expense('m1', 's1', 20, '餐饮', day),
    expense('m2', 's1', 30, '交通', day)
  ]);

  await rebuildDerivedData();
  const metas = await getAllByRange(
    'stats',
    IDBKeyRange.bound('searchmeta:', 'searchmeta:\uffff')
  );
  const meta = metas.find((entry) => entry.key === 'searchmeta:s1:2026-03');
  assert.ok(meta);
  assert.equal(meta.count, 2);
  assert.equal(meta.sum, 50);
});
