import {
  getAll,
  getAllByIndex,
  putMany,
  clearStores,
  setSetting
} from '../lib/db.js';
import {
  buildSearchChunks,
  matchesSearchEntry,
  SEARCH_VERSION,
  SEARCH_BUILDING_VERSION
} from '../lib/searchIndex.js';
import { rebuildDerivedData } from '../lib/stats.js';

let activeSearchId = 0;

function toMessage(error) {
  return String(error?.message || error || '未知错误');
}

async function rebuildSearchIndex() {
  self.postMessage({ type: 'rebuildProgress', value: 0 });
  await setSetting('searchVersion', SEARCH_BUILDING_VERSION);
  await clearStores(['searchChunks']);

  const expenses = await getAll('expenses');
  const chunks = buildSearchChunks(expenses);
  const batchSize = 50;

  for (let index = 0; index < chunks.length; index += batchSize) {
    await putMany('searchChunks', chunks.slice(index, index + batchSize));
    const done = Math.min(chunks.length, index + batchSize);
    self.postMessage({
      type: 'rebuildProgress',
      value: chunks.length ? Math.round((done / chunks.length) * 100) : 100
    });
  }

  await setSetting('searchVersion', SEARCH_VERSION);
  self.postMessage({ type: 'rebuildDone', count: expenses.length });
}

async function search({ requestId, stageId, query, category, limit }) {
  activeSearchId = requestId;
  const keyword = String(query || '').trim().toLowerCase();
  const categoryFilter = category || '';
  const maxIds = Number(limit) || 500;

  const chunks = await getAllByIndex('searchChunks', 'stageId', stageId);
  chunks.sort((a, b) => (b.month || '').localeCompare(a.month || ''));

  let count = 0;
  const ids = [];

  for (let index = 0; index < chunks.length; index += 1) {
    if (activeSearchId !== requestId) return;
    const chunk = chunks[index];
    for (const row of chunk.rows || []) {
      if (matchesSearchEntry(row, keyword, categoryFilter)) {
        count += 1;
        if (ids.length < maxIds) ids.push(row.id);
      }
    }

    if (index % 20 === 19) {
      self.postMessage({ type: 'searchProgress', requestId, count, ids: ids.slice() });
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (activeSearchId !== requestId) return;
    }
  }

  self.postMessage({ type: 'searchDone', requestId, count, ids });
}

self.onmessage = async (event) => {
  const message = event.data || {};

  if (message.type === 'rebuild') {
    try {
      await rebuildSearchIndex();
    } catch (err) {
      self.postMessage({ type: 'rebuildError', error: toMessage(err) });
    }
    return;
  }

  if (message.type === 'rebuildAll') {
    try {
      self.postMessage({ type: 'rebuildAllProgress', phase: 'start', elapsed: 0 });
      await rebuildDerivedData((progress) => {
        self.postMessage({
          type: 'rebuildAllProgress',
          phase: progress.phase,
          elapsed: progress.elapsed
        });
      });
      self.postMessage({ type: 'rebuildAllDone' });
    } catch (err) {
      self.postMessage({ type: 'rebuildAllError', error: toMessage(err) });
    }
    return;
  }

  if (message.type === 'search') {
    try {
      await search(message);
    } catch (err) {
      self.postMessage({
        type: 'searchError',
        requestId: message.requestId,
        error: toMessage(err)
      });
    }
  }
};
