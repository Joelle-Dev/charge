import { monthKey } from '../utils/months.js';
import { formatMoney } from '../utils/format.js';

export const SEARCH_VERSION = 2;
export const SEARCH_BUILDING_VERSION = -1;

export function searchTextForExpense(expense) {
  return [
    expense.note || '',
    expense.category || '',
    String(expense.amount ?? ''),
    formatMoney(expense.amount)
  ].join('\u0001').toLowerCase();
}

export function compactSearchEntry(expense) {
  return {
    id: expense.id,
    s: expense.spentAt,
    c: expense.category || '',
    t: searchTextForExpense(expense)
  };
}

export function searchChunkKey(stageId, month) {
  return `${stageId}|${month}`;
}

export function searchChunkMonth(expense) {
  return monthKey(new Date(expense.spentAt));
}

export function buildSearchChunks(expenses = []) {
  const chunks = new Map();

  for (const expense of expenses) {
    const month = searchChunkMonth(expense);
    const key = searchChunkKey(expense.stageId, month);
    let chunk = chunks.get(key);
    if (!chunk) {
      chunk = {
        key,
        stageId: expense.stageId,
        month,
        rows: []
      };
      chunks.set(key, chunk);
    }
    chunk.rows.push(compactSearchEntry(expense));
  }

  for (const chunk of chunks.values()) {
    chunk.rows.sort((a, b) => (b.s || '').localeCompare(a.s || ''));
  }

  return [...chunks.values()];
}

export function searchEntryTime(row) {
  return row.s || row.spentAt || '';
}

export function searchEntryCategory(row) {
  return row.c ?? row.category ?? '';
}

export function searchEntryText(row) {
  if (typeof row.t === 'string') return row.t;
  return searchTextForExpense({
    note: row.note,
    category: searchEntryCategory(row),
    amount: row.amount
  });
}

export function applySearchChunkChanges(chunk, { removeIds = [], addRows = [] } = {}) {
  const rows = new Map();
  for (const row of chunk?.rows || []) rows.set(row.id, row);
  for (const id of removeIds) rows.delete(id);
  for (const row of addRows) rows.set(row.id, row);
  return [...rows.values()].sort((a, b) => searchEntryTime(b).localeCompare(searchEntryTime(a)));
}

export function matchesSearchEntry(row, keyword = '', category = '') {
  if (category && searchEntryCategory(row) !== category) return false;
  if (!keyword) return true;
  return searchEntryText(row).includes(keyword);
}
