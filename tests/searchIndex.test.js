import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySearchChunkChanges,
  buildSearchChunks,
  searchChunksForStage
} from '../src/lib/searchIndex.js';

function expense(id, stageId, category, date) {
  return {
    id,
    stageId,
    amount: 10,
    category,
    note: id,
    spentAt: date.toISOString(),
    createdAt: 0
  };
}

const expenses = [
  expense('a', 's1', '餐饮', new Date(2026, 0, 2, 12)),
  expense('b', 's1', '交通', new Date(2026, 1, 10, 12)),
  expense('c', 's1', '餐饮', new Date(2026, 1, 20, 12)),
  expense('d', 's2', '购物', new Date(2026, 1, 11, 12))
];

test('buildSearchChunks groups by stage and month with rows newest first', () => {
  const chunks = buildSearchChunks(expenses);
  const s1 = chunks.filter((chunk) => chunk.stageId === 's1');
  assert.deepEqual(s1.map((chunk) => chunk.month).sort(), ['2026-01', '2026-02']);

  const february = s1.find((chunk) => chunk.month === '2026-02');
  assert.deepEqual(february.rows.map((row) => row.id), ['c', 'b']);
});

test('searchChunksForStage returns rows in descending time order', () => {
  const rows = searchChunksForStage(buildSearchChunks(expenses).filter((chunk) => chunk.stageId === 's1'));
  assert.deepEqual(rows.map((row) => row.id), ['c', 'b', 'a']);
});

test('applySearchChunkChanges removes and adds rows while staying sorted', () => {
  const [chunk] = buildSearchChunks(expenses).filter((item) => item.month === '2026-02' && item.stageId === 's1');
  const removed = applySearchChunkChanges(chunk, { removeIds: ['c'] });
  assert.deepEqual(removed.map((row) => row.id), ['b']);

  const added = applySearchChunkChanges(chunk, {
    addRows: [expense('e', 's1', '餐饮', new Date(2026, 1, 25, 12))]
  });
  assert.deepEqual(added.map((row) => row.id), ['e', 'c', 'b']);
});
