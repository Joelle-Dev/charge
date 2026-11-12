import { validateProfile } from '../utils/profile.js';

export const BACKUP_APP = 'shoucai-xiaoguo';
export const BACKUP_KIND = 'full';
export const BACKUP_SCHEMA_VERSION = 2;
export const BACKUP_EXTENSION = '.scbackup';
export const BACKUP_MAX_SIZE = 300 * 1024 * 1024;

// The manifest is the first line of a backup and can embed a photo avatar
// (base64 up to ~320k chars), so a fixed small prefix is not enough to parse it.
const IMPORT_HEAD_BYTES = 1024 * 1024;

export function isBackupFile(fileName = '') {
  return String(fileName).toLowerCase().endsWith(BACKUP_EXTENSION);
}

function fileExtension(fileName = '') {
  const name = String(fileName);
  const index = name.lastIndexOf('.');
  if (index <= 0 || index === name.length - 1) return '';
  return name.slice(index + 1).toLowerCase();
}

function readBlobText(blob) {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
    reader.readAsText(blob);
  });
}

async function readHead(file, limit) {
  if (!file || typeof file.slice !== 'function') return '';
  const size = Number(file.size) || 0;
  const end = size > 0 ? Math.min(size, limit) : limit;
  return readBlobText(file.slice(0, end));
}

function firstLineOf(text) {
  const index = text.indexOf('\n');
  const line = index >= 0 ? text.slice(0, index) : text;
  return line.replace(/^\uFEFF/, '').replace(/\r$/, '');
}

function looksLikeBackupManifest(text) {
  // Marker sniffing works even when the manifest line is longer than what we read.
  const compact = text.replace(/\s+/g, '');
  return compact.includes(`"app":"${BACKUP_APP}"`) &&
    compact.includes(`"kind":"${BACKUP_KIND}"`);
}

/**
 * Detect the kind of an imported file: 'backup' | 'csv' | 'json' | 'unknown'.
 * Never trusts the file extension alone, because iOS home-screen web apps can
 * drop or rename the picked file.
 */
export async function detectImportFileKind(file) {
  const name = String(file?.name || '');
  if (isBackupFile(name)) return 'backup';

  let head = '';
  try {
    head = await readHead(file, IMPORT_HEAD_BYTES);
  } catch (err) {
    return 'unknown';
  }

  const firstLine = firstLineOf(head).trim();
  if (firstLine) {
    try {
      const parsed = JSON.parse(firstLine);
      if (isBackupManifest(parsed)) return 'backup';
    } catch (err) {
      // Manifest can be truncated; fall through to marker sniffing.
    }
    if (looksLikeBackupManifest(firstLine)) return 'backup';
  }

  const extension = fileExtension(name);
  if (extension === 'csv') return 'csv';
  if (head.includes('日期') && head.includes('金额')) return 'csv';
  if (extension === 'json') return 'json';
  return 'unknown';
}

export function isBackupManifest(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    value.app === BACKUP_APP &&
    value.kind === BACKUP_KIND
  );
}

export function validateBackupManifest(manifest) {
  if (!isBackupManifest(manifest)) {
    return '不是守财小果的完整备份文件';
  }

  const version = Number(manifest.schemaVersion);
  if (!Number.isFinite(version)) {
    return '备份缺少格式版本';
  }
  if (version > BACKUP_SCHEMA_VERSION) {
    return '备份来自更新版本的应用，请升级后再导入';
  }

  if (!Array.isArray(manifest.stages)) {
    return '备份缺少账本数据';
  }

  const stageIds = new Set();
  for (const stage of manifest.stages) {
    if (!stage || typeof stage !== 'object') return '备份里的账本格式不正确';
    const id = String(stage.id || '').trim();
    const name = String(stage.name || '').trim();
    if (!id || !name) return '备份里的账本缺少 ID 或名称';
    if (stageIds.has(id)) return `备份里的账本 ID 重复：${name}`;
    stageIds.add(id);
  }

  const count = Number(manifest.counts?.expenses);
  if (!Number.isFinite(count) || count < 0) {
    return '备份缺少支出笔数';
  }

  if (manifest.categories !== undefined && !Array.isArray(manifest.categories)) {
    return '备份里的分类格式不正确';
  }
  if (
    manifest.categoryIcons !== undefined &&
    (typeof manifest.categoryIcons !== 'object' ||
      manifest.categoryIcons === null ||
      Array.isArray(manifest.categoryIcons))
  ) {
    return '备份里的分类图标格式不正确';
  }
  const profileError = validateProfile(manifest.profile);
  if (profileError) return profileError;
  if (manifest.achievementUnlocked !== undefined && !Array.isArray(manifest.achievementUnlocked)) {
    return '备份里的成就数据格式不正确';
  }

  return null;
}

export function backupFilename(now = new Date()) {
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('');
  return `守财小果-完整备份-${date}${BACKUP_EXTENSION}`;
}

export function validateBackupExpense(expense, stageIds) {
  if (!expense || typeof expense !== 'object' || Array.isArray(expense)) {
    return '支出格式不正确';
  }
  const id = String(expense.id || '').trim();
  if (!id) return '支出缺少 ID';

  const stageId = String(expense.stageId || '').trim();
  if (!stageId || !stageIds.has(stageId)) return '支出找不到所属账本';

  const amount = Number(expense.amount);
  if (!Number.isFinite(amount) || amount <= 0) return '支出金额无效';

  const spent = new Date(expense.spentAt);
  if (Number.isNaN(spent.getTime())) return '支出日期无效';

  return null;
}
