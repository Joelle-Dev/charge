import {
  openDB,
  getAll,
  getRecord,
  putRecord,
  putMany,
  getAllByIndex,
  countRange,
  clearStores,
  scanAll,
  getSetting,
  setSetting
} from '../lib/db.js';
import { parseStageCsv } from '../utils/csv.js';
import { DEFAULT_CATEGORY } from '../lib/parser.js';
import { formatTime, toDateInput, uid } from '../utils/format.js';
import { monthLabel } from '../utils/months.js';
import { rebuildDerivedData, STATS_VERSION } from '../lib/stats.js';
import {
  BACKUP_APP,
  BACKUP_KIND,
  BACKUP_SCHEMA_VERSION,
  backupFilename,
  validateBackupExpense,
  validateBackupManifest
} from '../lib/backupFormat.js';

let parsedCsv = null;
let pendingBackup = null;

function toMessage(error) {
  return String(error?.message || error || '未知错误');
}

function monthBounds(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return [
    new Date(year, monthNumber - 1, 1).toISOString(),
    new Date(year, monthNumber, 1).toISOString()
  ];
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(expense) {
  return [
    toDateInput(new Date(expense.spentAt)),
    formatTime(expense.spentAt),
    expense.category || DEFAULT_CATEGORY,
    expense.note || '',
    Number(expense.amount).toFixed(2)
  ].map(csvCell).join(',');
}

function csvHeader(stage, month, count, total, now = new Date()) {
  const budget = Number(stage.budget) || 0;
  const rows = [
    ['阶段', stage.name],
    ...(month ? [['月份', monthLabel(month)]] : []),
    ['导出时间', `${toDateInput(now)} ${formatTime(now)}`],
    ['支出笔数', String(count)],
    ['总支出', total.toFixed(2)],
    ['预算', budget > 0 ? budget.toFixed(2) : '未设置'],
    ['剩余', budget > 0 ? (budget - total).toFixed(2) : '未设置'],
    [],
    ['日期', '时间', '分类', '备注', '金额']
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

async function exportCsv({ stage, month }) {
  if (!stage?.id) throw new Error('没有可导出的阶段');
  const db = await openDB();
  const tx = db.transaction('expenses', 'readonly');
  const index = tx.objectStore('expenses').index('stageId_spentAt');
  const range = month
    ? (() => {
      const [start, end] = monthBounds(month);
      return IDBKeyRange.bound([stage.id, start], [stage.id, end], false, true);
    })()
    : IDBKeyRange.bound([stage.id, ''], [stage.id, '\uffff']);

  const rows = [];
  let count = 0;
  let total = 0;

  await new Promise((resolve, reject) => {
    const request = index.openCursor(range, 'prev');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      const expense = cursor.value;
      count += 1;
      total += Number(expense.amount) || 0;
      rows.push(csvRow(expense));
      if (count % 2000 === 0) {
        self.postMessage({ type: 'exportProgress', count });
      }
      cursor.continue();
    };
  });

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('导出失败'));
  });

  if (!count) {
    self.postMessage({ type: 'exportDone', empty: true });
    return;
  }

  const text = `\ufeff${csvHeader(stage, month, count, total)}\r\n${rows.join('\r\n')}`;
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const filename = `${String(stage.name || '支出').replace(/[\\/:*?"<>|]/g, '_')}-支出.csv`;
  self.postMessage({ type: 'exportDone', blob, filename, count });
}

async function parseCsv({ file }) {
  parsedCsv = null;
  const text = await file.text();
  const result = parseStageCsv(text);
  if (result.error) {
    self.postMessage({ type: 'parseError', error: result.error });
    return;
  }

  parsedCsv = result;
  const expenses = result.expenses;
  let total = 0;
  let minTime = Infinity;
  let maxTime = -Infinity;
  const categories = new Set();

  for (const expense of expenses) {
    total += Number(expense.amount) || 0;
    const time = new Date(expense.spentAt).getTime();
    if (Number.isFinite(time)) {
      if (time < minTime) minTime = time;
      if (time > maxTime) maxTime = time;
    }
    categories.add(expense.category);
  }

  self.postMessage({
    type: 'parseDone',
    stageName: result.stageName || '',
    budget: result.budget ?? null,
    count: expenses.length,
    total,
    from: Number.isFinite(minTime) ? toDateInput(new Date(minTime)) : '',
    to: Number.isFinite(maxTime) ? toDateInput(new Date(maxTime)) : '',
    categories: [...categories],
    errors: result.errors.slice(0, 20),
    errorCount: result.errors.length
  });
}

async function importCsv({ stageId, stageName, budget, categories, skipDuplicates }) {
  if (!parsedCsv) throw new Error('没有可导入的 CSV 数据');
  const rows = parsedCsv.expenses;
  if (!rows.length) {
    self.postMessage({ type: 'importDone', imported: 0, skipped: 0, createdStage: false, stageName });
    return;
  }

  const now = Date.now();
  let stage = stageId ? await getRecord('stages', stageId) : null;
  const createdStage = !stage;
  if (!stage) {
    stage = {
      id: uid('stage'),
      name: String(stageName || '').trim() || '导入数据',
      budget: Number(budget) > 0 ? Math.round(Number(budget) * 100) / 100 : null,
      archived: false,
      createdAt: now,
      updatedAt: now
    };
  }

  const signatureFor = (expense) => (
    `${expense.spentAt}|${Number(expense.amount).toFixed(2)}|${expense.category}|${expense.note}`
  );
  const signatures = new Set();

  if (!createdStage && skipDuplicates) {
    const months = new Set();
    for (const row of rows) {
      const date = new Date(row.spentAt);
      if (!Number.isNaN(date.getTime())) {
        months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
      }
    }
    let checked = 0;
    for (const month of months) {
      const [start, end] = monthBounds(month);
      const items = await getAllByIndex(
        'expenses',
        'stageId_spentAt',
        IDBKeyRange.bound([stage.id, start], [stage.id, end], false, true)
      );
      for (const expense of items) signatures.add(signatureFor(expense));
      checked += 1;
      self.postMessage({ type: 'importProgress', phase: 'dedup', checked, total: months.size });
    }
  }

  const records = [];
  let skipped = 0;
  for (const row of rows) {
    const signature = signatureFor(row);
    if (skipDuplicates && signatures.has(signature)) {
      skipped += 1;
      continue;
    }
    signatures.add(signature);
    records.push({
      id: uid('expense'),
      stageId: stage.id,
      amount: row.amount,
      category: row.category,
      note: row.note,
      spentAt: row.spentAt,
      createdAt: now
    });
  }

  if (!records.length) {
    self.postMessage({
      type: 'importDone',
      imported: 0,
      skipped,
      createdStage: false,
      stageName: stage.name,
      stageId: stage.id
    });
    return;
  }

  await setSetting('statsDirty', true);
  if (createdStage) await putRecord('stages', stage);

  const batchSize = 1000;
  for (let index = 0; index < records.length; index += batchSize) {
    await putMany('expenses', records.slice(index, index + batchSize));
    self.postMessage({
      type: 'importProgress',
      phase: 'write',
      written: Math.min(records.length, index + batchSize),
      total: records.length
    });
  }

  const existingCategories = await getSetting('categories', []);
  const nextCategories = [...new Set([
    ...(Array.isArray(existingCategories) ? existingCategories : []),
    ...categories,
    DEFAULT_CATEGORY
  ])];
  await setSetting('categories', nextCategories);

  await rebuildDerivedData((progress) => {
    self.postMessage({
      type: 'importProgress',
      phase: progress.phase,
      elapsed: progress.elapsed
    });
  });

  await setSetting('statsVersion', STATS_VERSION);
  await setSetting('statsDirty', false);

  parsedCsv = null;
  self.postMessage({
    type: 'importDone',
    imported: records.length,
    skipped,
    createdStage,
    stageName: stage.name,
    stageId: stage.id
  });
}

async function readFirstLine(file) {
  const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const index = buffer.indexOf('\n');
      if (index >= 0) {
        return buffer.slice(0, index).replace(/^\uFEFF/, '').replace(/\r$/, '');
      }
      if (buffer.length > 4 * 1024 * 1024) break;
    }
  } finally {
    try {
      await reader.cancel();
    } catch (err) {
      // ignore
    }
  }
  return buffer.replace(/^\uFEFF/, '').replace(/\r$/, '');
}

async function readLines(file, onLine) {
  const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let lineIndex = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let index = buffer.indexOf('\n');
      while (index >= 0) {
        let line = buffer.slice(0, index).replace(/\r$/, '');
        buffer = buffer.slice(index + 1);
        if (lineIndex === 0) line = line.replace(/^\uFEFF/, '');
        await onLine(line, lineIndex);
        lineIndex += 1;
        index = buffer.indexOf('\n');
      }
    }

    if (buffer.length) {
      let line = buffer.replace(/\r$/, '');
      if (lineIndex === 0) line = line.replace(/^\uFEFF/, '');
      await onLine(line, lineIndex);
    }
  } finally {
    try {
      await reader.cancel();
    } catch (err) {
      // ignore
    }
  }
}

async function exportBackup() {
  const total = await countRange('expenses', null);
  const stages = (await getAll('stages')).sort(
    (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
  );
  const categories = await getSetting('categories', []);
  const currentStageId = await getSetting('currentStageId', null);
  const achievementUnlocked = await getSetting('achievementUnlocked', []);
  const global = await getRecord('stats', 'global');

  const manifest = {
    app: BACKUP_APP,
    kind: BACKUP_KIND,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    stages,
    categories: Array.isArray(categories) ? categories : [],
    currentStageId: currentStageId || null,
    achievementUnlocked: Array.isArray(achievementUnlocked) ? achievementUnlocked : [],
    counts: {
      stages: stages.length,
      expenses: total
    },
    stats: {
      count: Number(global?.count) || 0,
      total: Number(global?.total) || 0,
      minDate: global?.minDate || '',
      maxDate: global?.maxDate || ''
    }
  };

  const lines = [JSON.stringify(manifest)];
  let written = 0;

  await scanAll('expenses', (expense) => {
    lines.push(JSON.stringify(expense));
    written += 1;
    if (written % 5000 === 0) {
      self.postMessage({
        type: 'backupProgress',
        phase: 'export',
        written,
        total
      });
    }
  });

  const blob = new Blob([lines.join('\n') + '\n'], {
    type: 'application/x-ndjson'
  });
  await setSetting('lastBackupAt', Date.now());
  self.postMessage({
    type: 'backupExportDone',
    blob,
    filename: backupFilename(),
    count: written,
    stages: stages.length,
    empty: written === 0 && stages.length === 0
  });
}

async function parseBackup({ file }) {
  pendingBackup = null;
  const firstLine = await readFirstLine(file);
  let manifest;
  try {
    manifest = JSON.parse(firstLine);
  } catch (err) {
    throw new Error('不是有效的完整备份文件');
  }

  const error = validateBackupManifest(manifest);
  if (error) throw new Error(error);

  pendingBackup = { file, manifest };
  self.postMessage({
    type: 'backupParseDone',
    fileName: file.name,
    size: file.size,
    manifest
  });
}

async function importBackup({ mode = 'replace' }) {
  if (!pendingBackup) throw new Error('没有可导入的备份文件');
  const { file, manifest } = pendingBackup;
  const stageIds = new Set(manifest.stages.map((stage) => stage.id));
  const expenseIds = new Set();
  const errors = [];
  let count = 0;

  await readLines(file, (line, index) => {
    if (index === 0 || !line.trim()) return;
    let expense;
    try {
      expense = JSON.parse(line);
    } catch (err) {
      if (errors.length < 20) errors.push(`第 ${index + 1} 行不是有效 JSON`);
      return;
    }

    const error = validateBackupExpense(expense, stageIds);
    if (error) {
      if (errors.length < 20) errors.push(`第 ${index + 1} 行：${error}`);
    } else if (expenseIds.has(expense.id)) {
      if (errors.length < 20) errors.push(`第 ${index + 1} 行：支出 ID 重复`);
    } else {
      expenseIds.add(expense.id);
    }

    count += 1;
    if (count % 5000 === 0) {
      self.postMessage({
        type: 'backupProgress',
        phase: 'validate',
        written: count,
        total: manifest.counts.expenses
      });
    }
  });

  if (errors.length) {
    throw new Error(`${errors.length} 笔数据校验失败：${errors.slice(0, 3).join('；')}`);
  }
  const expectedExpenses = Number(manifest.counts.expenses);
  if (count !== expectedExpenses) {
    throw new Error(`备份笔数不一致：清单 ${expectedExpenses}，实际 ${count}`);
  }

  const replace = mode === 'replace';
  const existingStages = replace ? [] : await getAll('stages');
  const storedCategories = replace ? [] : await getSetting('categories', []);
  const storedAchievements = replace ? [] : await getSetting('achievementUnlocked', []);
  const existingCategories = Array.isArray(storedCategories) ? storedCategories : [];
  const existingAchievements = Array.isArray(storedAchievements) ? storedAchievements : [];
  const existingCurrentStageId = replace ? null : await getSetting('currentStageId', null);

  const now = Date.now();
  const stageMap = new Map();
  const importedStages = manifest.stages.map((stage) => {
    const id = replace ? stage.id : uid('stage');
    stageMap.set(stage.id, id);
    const budget = Number(stage.budget);
    return {
      id,
      name: String(stage.name || '').trim(),
      budget: Number.isFinite(budget) && budget > 0 ? Math.round(budget * 100) / 100 : null,
      archived: Boolean(stage.archived),
      createdAt: Number(stage.createdAt) || now,
      updatedAt: now
    };
  });

  const backupCurrentStageId = manifest.currentStageId
    ? stageMap.get(manifest.currentStageId)
    : null;

  let currentStageId;
  if (replace) {
    currentStageId = importedStages.find(
      (stage) => stage.id === backupCurrentStageId && !stage.archived
    )?.id || importedStages.find((stage) => !stage.archived)?.id || null;
  } else {
    currentStageId = existingStages.find(
      (stage) => stage.id === existingCurrentStageId && !stage.archived
    )?.id || importedStages.find(
      (stage) => stage.id === backupCurrentStageId && !stage.archived
    )?.id || importedStages.find((stage) => !stage.archived)?.id ||
      existingStages.find((stage) => !stage.archived)?.id || null;
  }

  const nextCategories = new Set([
    ...existingCategories,
    ...(Array.isArray(manifest.categories) ? manifest.categories : []),
    DEFAULT_CATEGORY
  ]);
  const nextAchievements = [
    ...new Set([
      ...existingAchievements,
      ...(Array.isArray(manifest.achievementUnlocked) ? manifest.achievementUnlocked : [])
    ])
  ];

  await setSetting('statsDirty', true);
  if (replace) {
    await clearStores(['stages', 'expenses', 'stats', 'searchChunks']);
  }
  if (importedStages.length) {
    await putMany('stages', importedStages);
  }
  self.postMessage({ type: 'backupProgress', phase: 'stages', written: importedStages.length });

  const batch = [];
  let written = 0;

  async function flush() {
    if (!batch.length) return;
    await putMany('expenses', batch.splice(0, batch.length));
  }

  await readLines(file, async (line, index) => {
    if (index === 0 || !line.trim()) return;
    const raw = JSON.parse(line);
    const category = String(raw.category || DEFAULT_CATEGORY);
    const expense = {
      id: replace ? raw.id : uid('expense'),
      stageId: stageMap.get(raw.stageId),
      amount: Math.round((Number(raw.amount) || 0) * 100) / 100,
      category,
      note: String(raw.note || ''),
      spentAt: new Date(raw.spentAt).toISOString(),
      createdAt: Number(raw.createdAt) || now,
      ...(raw.updatedAt ? { updatedAt: Number(raw.updatedAt) } : {})
    };
    nextCategories.add(category);
    batch.push(expense);
    written += 1;

    if (batch.length >= 1000) {
      await flush();
      self.postMessage({
        type: 'backupProgress',
        phase: 'expenses',
        written,
        total: count
      });
    } else if (written % 500 === 0) {
      self.postMessage({
        type: 'backupProgress',
        phase: 'expenses',
        written,
        total: count
      });
    }
  });
  await flush();

  await setSetting('categories', [...nextCategories]);
  await setSetting('achievementUnlocked', nextAchievements);
  await setSetting('currentStageId', currentStageId);

  await rebuildDerivedData((progress) => {
    self.postMessage({
      type: 'backupProgress',
      phase: progress.phase,
      elapsed: progress.elapsed
    });
  });
  await setSetting('statsVersion', STATS_VERSION);
  await setSetting('statsDirty', false);

  pendingBackup = null;
  self.postMessage({
    type: 'backupImportDone',
    mode,
    imported: written,
    stages: importedStages.length,
    currentStageId
  });
}

self.onmessage = async (event) => {
  const message = event.data || {};
  try {
    if (message.type === 'export') {
      await exportCsv(message);
      return;
    }
    if (message.type === 'parseCsv') {
      await parseCsv(message);
      return;
    }
    if (message.type === 'importCsv') {
      await importCsv(message);
      return;
    }
    if (message.type === 'clearCsv') {
      parsedCsv = null;
      return;
    }
    if (message.type === 'exportBackup') {
      await exportBackup();
      return;
    }
    if (message.type === 'parseBackup') {
      await parseBackup(message);
      return;
    }
    if (message.type === 'importBackup') {
      await importBackup(message);
      return;
    }
    if (message.type === 'clearBackup') {
      pendingBackup = null;
    }
  } catch (err) {
    self.postMessage({ type: 'dataError', requestId: message.requestId, error: toMessage(err) });
  }
};
