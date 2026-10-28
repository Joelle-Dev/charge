let worker = null;
let active = null;

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/dataWorker.js', import.meta.url), {
    type: 'module'
  });
  worker.onmessage = (event) => {
    const message = event.data || {};
    if (!active) return;

    if (
      message.type === 'exportProgress' ||
      message.type === 'importProgress' ||
      message.type === 'backupProgress'
    ) {
      active.onProgress?.(message);
      return;
    }

    const entry = active;
    active = null;

    if (message.type === 'exportDone') {
      if (message.empty) entry.resolve({ empty: true });
      else entry.resolve({ blob: message.blob, filename: message.filename, count: message.count });
      return;
    }
    if (message.type === 'parseDone' || message.type === 'importDone') {
      entry.resolve(message);
      return;
    }
    if (
      message.type === 'backupExportDone' ||
      message.type === 'backupParseDone' ||
      message.type === 'backupImportDone'
    ) {
      entry.resolve(message);
      return;
    }

    entry.reject(new Error(message.error || '数据处理失败'));
  };
  worker.onerror = () => {
    const entry = active;
    active = null;
    entry?.reject(new Error('数据处理线程启动失败'));
  };
  return worker;
}

function begin(kind, { onProgress, resolve, reject }) {
  if (active) {
    reject(new Error('另一个数据操作正在进行'));
    return false;
  }
  active = { kind, onProgress, resolve, reject };
  return true;
}

export function parseCsvFile(file, { onProgress } = {}) {
  ensureWorker();
  return new Promise((resolve, reject) => {
    if (!begin('parse', { onProgress, resolve, reject })) return;
    worker.postMessage({ type: 'parseCsv', file });
  });
}

export function importParsedCsv(options, { onProgress } = {}) {
  ensureWorker();
  const payload = {
    stageId: options.stageId || null,
    stageName: String(options.stageName || ''),
    budget: options.budget ?? null,
    categories: Array.isArray(options.categories) ? [...options.categories] : [],
    skipDuplicates: Boolean(options.skipDuplicates)
  };
  return new Promise((resolve, reject) => {
    if (!begin('import', { onProgress, resolve, reject })) return;
    worker.postMessage({ type: 'importCsv', ...payload });
  });
}

export function exportStageCsvInWorker(stage, { month = null, onProgress } = {}) {
  ensureWorker();
  const payload = {
    id: stage?.id,
    name: String(stage?.name || ''),
    budget: stage?.budget ?? null
  };
  return new Promise((resolve, reject) => {
    if (!begin('export', { onProgress, resolve, reject })) return;
    worker.postMessage({ type: 'export', stage: payload, month });
  });
}

export function clearParsedCsv() {
  if (!worker) return;
  worker.postMessage({ type: 'clearCsv' });
}

export function exportBackupInWorker({ onProgress } = {}) {
  ensureWorker();
  return new Promise((resolve, reject) => {
    if (!begin('backupExport', { onProgress, resolve, reject })) return;
    worker.postMessage({ type: 'exportBackup' });
  });
}

export function parseBackupFile(file, { onProgress } = {}) {
  ensureWorker();
  return new Promise((resolve, reject) => {
    if (!begin('backupParse', { onProgress, resolve, reject })) return;
    worker.postMessage({ type: 'parseBackup', file });
  });
}

export function importBackupFile(options = {}, { onProgress } = {}) {
  ensureWorker();
  const mode = options.mode === 'merge' ? 'merge' : 'replace';
  return new Promise((resolve, reject) => {
    if (!begin('backupImport', { onProgress, resolve, reject })) return;
    worker.postMessage({ type: 'importBackup', mode });
  });
}

export function clearPendingBackup() {
  if (!worker) return;
  worker.postMessage({ type: 'clearBackup' });
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
