export const BACKUP_APP = 'shoucai-xiaoguo';
export const BACKUP_KIND = 'full';
export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_EXTENSION = '.scbackup';
export const BACKUP_MAX_SIZE = 300 * 1024 * 1024;

export function isBackupFile(fileName = '') {
  return String(fileName).toLowerCase().endsWith(BACKUP_EXTENSION);
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
    return '备份缺少阶段数据';
  }

  const stageIds = new Set();
  for (const stage of manifest.stages) {
    if (!stage || typeof stage !== 'object') return '备份里的阶段格式不正确';
    const id = String(stage.id || '').trim();
    const name = String(stage.name || '').trim();
    if (!id || !name) return '备份里的阶段缺少 ID 或名称';
    if (stageIds.has(id)) return `备份里的阶段 ID 重复：${name}`;
    stageIds.add(id);
  }

  const count = Number(manifest.counts?.expenses);
  if (!Number.isFinite(count) || count < 0) {
    return '备份缺少支出笔数';
  }

  if (manifest.categories !== undefined && !Array.isArray(manifest.categories)) {
    return '备份里的分类格式不正确';
  }
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
  if (!stageId || !stageIds.has(stageId)) return '支出找不到所属阶段';

  const amount = Number(expense.amount);
  if (!Number.isFinite(amount) || amount <= 0) return '支出金额无效';

  const spent = new Date(expense.spentAt);
  if (Number.isNaN(spent.getTime())) return '支出日期无效';

  return null;
}
