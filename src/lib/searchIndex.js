import { monthKey } from '../utils/months.js';

export function compactExpense(expense) {
  return {
    id: expense.id,
    stageId: expense.stageId,
    amount: expense.amount,
    category: expense.category,
    note: expense.note,
    spentAt: expense.spentAt,
    createdAt: expense.createdAt
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
    chunk.rows.push(compactExpense(expense));
  }

  for (const chunk of chunks.values()) {
    chunk.rows.sort((a, b) => (b.spentAt || '').localeCompare(a.spentAt || ''));
  }

  return [...chunks.values()];
}

export function applySearchChunkChanges(chunk, { removeIds = [], addRows = [] } = {}) {
  const rows = new Map();
  for (const row of chunk?.rows || []) rows.set(row.id, row);
  for (const id of removeIds) rows.delete(id);
  for (const row of addRows) rows.set(row.id, row);
  return [...rows.values()].sort((a, b) => (b.spentAt || '').localeCompare(a.spentAt || ''));
}

export function searchChunksForStage(chunks = []) {
  return [...chunks]
    .sort((a, b) => (b.month || '').localeCompare(a.month || ''))
    .flatMap((chunk) => chunk.rows || []);
}
