let worker = null;
let searchRequestId = 0;
const pendingSearches = new Map();

let rebuildPromise = null;
let rebuildResolve = null;
let rebuildReject = null;
let rebuildProgress = null;

let derivedPromise = null;
let derivedResolve = null;
let derivedReject = null;
let derivedProgress = null;

function rejectPending(error) {
  for (const entry of pendingSearches.values()) entry.reject(error);
  pendingSearches.clear();
}

function ensureWorker() {
  if (worker) return worker;

  worker = new Worker(new URL('../workers/searchWorker.js', import.meta.url), {
    type: 'module'
  });

  worker.onmessage = (event) => {
    const message = event.data || {};

    if (message.type === 'rebuildProgress') {
      rebuildProgress?.(message.value);
      return;
    }

    if (message.type === 'rebuildDone') {
      const resolve = rebuildResolve;
      rebuildPromise = null;
      rebuildResolve = null;
      rebuildReject = null;
      rebuildProgress = null;
      resolve?.(message.count);
      return;
    }

    if (message.type === 'rebuildError') {
      const reject = rebuildReject;
      rebuildPromise = null;
      rebuildResolve = null;
      rebuildReject = null;
      rebuildProgress = null;
      reject?.(new Error(message.error || '搜索索引重建失败'));
      return;
    }

    if (message.type === 'rebuildAllProgress') {
      derivedProgress?.(message.phase, message.elapsed);
      return;
    }

    if (message.type === 'rebuildAllDone') {
      const resolve = derivedResolve;
      derivedPromise = null;
      derivedResolve = null;
      derivedReject = null;
      derivedProgress = null;
      resolve?.();
      return;
    }

    if (message.type === 'rebuildAllError') {
      const reject = derivedReject;
      derivedPromise = null;
      derivedResolve = null;
      derivedReject = null;
      derivedProgress = null;
      reject?.(new Error(message.error || '重建数据失败'));
      return;
    }

    if (message.type === 'searchProgress') {
      pendingSearches.get(message.requestId)?.onProgress?.(message);
      return;
    }

    if (message.type === 'searchDone' || message.type === 'searchError') {
      const entry = pendingSearches.get(message.requestId);
      if (!entry) return;
      pendingSearches.delete(message.requestId);
      if (message.type === 'searchDone') entry.resolve(message);
      else entry.reject(new Error(message.error || '搜索失败'));
    }
  };

  worker.onerror = () => {
    const error = new Error('搜索线程启动失败');
    rejectPending(error);
    if (rebuildReject) {
      const reject = rebuildReject;
      rebuildPromise = null;
      rebuildResolve = null;
      rebuildReject = null;
      rebuildProgress = null;
      reject(error);
    }
    if (derivedReject) {
      const reject = derivedReject;
      derivedPromise = null;
      derivedResolve = null;
      derivedReject = null;
      derivedProgress = null;
      reject(error);
    }
  };

  return worker;
}

export async function rebuildSearchIndex({ onProgress } = {}) {
  if (rebuildPromise) return rebuildPromise;

  if (derivedPromise) {
    try {
      await derivedPromise;
      return undefined;
    } catch (err) {
      // Fall through to a dedicated search index rebuild.
    }
  }

  ensureWorker();
  rebuildProgress = onProgress || null;
  rebuildPromise = new Promise((resolve, reject) => {
    rebuildResolve = resolve;
    rebuildReject = reject;
  });
  worker.postMessage({ type: 'rebuild' });
  return rebuildPromise;
}

export async function rebuildDerivedDataInWorker({ onProgress } = {}) {
  if (derivedPromise) return derivedPromise;

  if (rebuildPromise) {
    try {
      await rebuildPromise;
    } catch (err) {
      // The derived rebuild below will recreate the search index anyway.
    }
  }

  if (derivedPromise) return derivedPromise;

  ensureWorker();
  derivedProgress = onProgress || null;
  derivedPromise = new Promise((resolve, reject) => {
    derivedResolve = resolve;
    derivedReject = reject;
  });
  worker.postMessage({ type: 'rebuildAll' });
  return derivedPromise;
}

export async function searchExpenses({ stageId, query = '', category = '', limit = 500, onProgress } = {}) {
  if (!stageId) return { count: 0, ids: [] };

  if (derivedPromise) {
    try {
      await derivedPromise;
    } catch (err) {
      // Keep the old index if the rebuild failed.
    }
  }

  ensureWorker();

  const requestId = ++searchRequestId;
  const cancelError = new Error('搜索已取消');
  cancelError.code = 'SEARCH_CANCELLED';
  rejectPending(cancelError);

  return new Promise((resolve, reject) => {
    pendingSearches.set(requestId, { resolve, reject, onProgress });
    worker.postMessage({
      type: 'search',
      requestId,
      stageId,
      query,
      category,
      limit
    });
  });
}
