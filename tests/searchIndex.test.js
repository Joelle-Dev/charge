import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySearchChunkChanges,
  buildSearchChunks,
  matchesSearchEntry,
  searchTextForExpense
} from '../src/lib/searchIndex.js';

function expense(id, stageId, amount, category, note, date) {
  return {
    id,
    stageId,
    amount,
    category,
    note,
    spentAt: date.toISOString(),
    createdAt: 0
  };
}

const expenses = [
  expense('a', 's1', 12, '餐饮', '午饭', new Date(2026, 0, 2, 12)),
  expense('b', 's1', 8, '交通', '打车', new Date(2026, 1, 10, 12)),
  expense('c', 's1', 30, '餐饮', '晚饭', new Date(2026, 1, 20, 12)),
  expense('d', 's2', 5, '购物', '纸巾', new Date(2026, 1, 11, 12))
];

test('buildSearchChunks groups by stage and month with rows newest first', () => {
  const chunks = buildSearchChunks(expenses);
  const s1 = chunks.filter((chunk) => chunk.stageId === 's1');
  assert.deepEqual(s1.map((chunk) => chunk.month).sort(), ['2026-01', '2026-02']);

  const february = s1.find((chunk) => chunk.month === '2026-02');
  assert.deepEqual(february.rows.map((row) => row.id), ['c', 'b']);
  assert.equal(february.rows[0].c, '餐饮');
  assert.ok(february.rows[0].t.includes('晚饭'));
});

test('search text contains note, category and amount', () => {
  const text = searchTextForExpense(expenses[0]);
  assert.ok(text.includes('午饭'));
  assert.ok(text.includes('餐饮'));
  assert.ok(text.includes('12'));
});

test('matchesSearchEntry filters by keyword and category', () => {
  const [chunk] = buildSearchChunks(expenses).filter((item) => item.month === '2026-02' && item.stageId === 's1');
  assert.equal(matchesSearchEntry(chunk.rows[0], '晚饭'), true);
  assert.equal(matchesSearchEntry(chunk.rows[0], '打车'), false);
  assert.equal(matchesSearchEntry(chunk.rows[1], '', '交通'), true);
  assert.equal(matchesSearchEntry(chunk.rows[1], '', '餐饮'), false);
});

test('matchesSearchEntry supports legacy search rows', () => {
  const legacy = {
    id: 'legacy',
    note: '旧版午饭',
    category: '餐饮',
    amount: 9.5,
    spentAt: new Date(2026, 0, 3, 12).toISOString()
  };
  assert.equal(matchesSearchEntry(legacy, '午饭'), true);
  assert.equal(matchesSearchEntry(legacy, '', '餐饮'), true);
  assert.equal(matchesSearchEntry(legacy, '', '交通'), false);
});

test('applySearchChunkChanges removes and adds rows while staying sorted', () => {
  const [chunk] = buildSearchChunks(expenses).filter((item) => item.month === '2026-02' && item.stageId === 's1');
  const removed = applySearchChunkChanges(chunk, { removeIds: ['c'] });
  assert.deepEqual(removed.map((row) => row.id), ['b']);

  const added = applySearchChunkChanges(chunk, {
    addRows: [{ id: 'e', s: new Date(2026, 1, 25, 12).toISOString(), c: '餐饮', t: '宵夜' }]
  });
  assert.deepEqual(added.map((row) => row.id), ['e', 'c', 'b']);
});
