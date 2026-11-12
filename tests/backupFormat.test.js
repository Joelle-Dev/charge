import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKUP_APP,
  BACKUP_KIND,
  BACKUP_SCHEMA_VERSION,
  backupFilename,
  detectImportFileKind,
  isBackupFile,
  isBackupManifest,
  validateBackupExpense,
  validateBackupManifest
} from '../src/lib/backupFormat.js';

const manifest = {
  app: BACKUP_APP,
  kind: BACKUP_KIND,
  schemaVersion: BACKUP_SCHEMA_VERSION,
  stages: [{ id: 's1', name: '阶段一' }],
  categories: ['餐饮'],
  currentStageId: 's1',
  achievementUnlocked: [],
  profile: { name: '小果', avatar: { type: 'preset', value: 'cat' } },
  counts: { stages: 1, expenses: 1 }
};

test('backup manifest validation accepts a valid manifest', () => {
  assert.equal(validateBackupManifest(manifest), null);
  assert.equal(isBackupManifest(manifest), true);
  assert.equal(isBackupFile('守财小果-完整备份-20261028.scbackup'), true);
  assert.equal(isBackupFile('data.csv'), false);
});

test('backup manifest validation rejects wrong files and versions', () => {
  assert.ok(validateBackupManifest({ ...manifest, app: 'other' }));
  assert.ok(validateBackupManifest({ ...manifest, kind: 'other' }));
  assert.ok(validateBackupManifest({ ...manifest, schemaVersion: 99 }));
  assert.ok(validateBackupManifest({
    ...manifest,
    stages: [{ id: 's1', name: '一' }, { id: 's1', name: '二' }]
  }));
  assert.ok(validateBackupManifest({ ...manifest, counts: {} }));
  assert.ok(validateBackupManifest({ ...manifest, profile: { avatar: { type: 'preset', value: 'unknown' } } }));
  assert.ok(validateBackupManifest({ ...manifest, profile: { name: 'x'.repeat(13) } }));
  assert.ok(validateBackupManifest({ ...manifest, profile: { avatar: { type: 'image', value: 'https://x.test/a.png' } } }));
});

test('backup expense validation checks stage, amount and date', () => {
  const stageIds = new Set(['s1']);
  const expense = {
    id: 'e1',
    stageId: 's1',
    amount: 12.34,
    category: '餐饮',
    note: '午饭',
    spentAt: new Date('2026-10-28T04:00:00.000Z').toISOString()
  };

  assert.equal(validateBackupExpense(expense, stageIds), null);
  assert.ok(validateBackupExpense({ ...expense, stageId: 'missing' }, stageIds));
  assert.ok(validateBackupExpense({ ...expense, amount: 0 }, stageIds));
  assert.ok(validateBackupExpense({ ...expense, spentAt: 'bad' }, stageIds));
  assert.ok(validateBackupExpense({ ...expense, id: '' }, stageIds));
});

test('backup filename is dated', () => {
  const name = backupFilename(new Date(2026, 9, 28));
  assert.equal(name, '守财小果-完整备份-20261028.scbackup');
});

function backupFile({ name, avatarSize = 0 }) {
  const avatar = avatarSize
    ? { type: 'image', value: `data:image/png;base64,${'A'.repeat(avatarSize)}` }
    : { type: 'preset', value: 'cat' };
  const line = JSON.stringify({ ...manifest, profile: { name: '小果', avatar } });
  return new File([`${line}\n{"id":"e1"}\n`], name);
}

test('detectImportFileKind trusts a .scbackup extension', async () => {
  assert.equal(await detectImportFileKind(backupFile({ name: '备份.scbackup' })), 'backup');
});

test('detectImportFileKind reads a long manifest even without an extension', async () => {
  const file = backupFile({ name: '备份文件', avatarSize: 20000 });
  assert.ok(file.size > 8192);
  assert.equal(await detectImportFileKind(file), 'backup');
});

test('detectImportFileKind recognizes a manifest longer than the read window', async () => {
  const file = backupFile({ name: '备份文件', avatarSize: 2 * 1024 * 1024 });
  assert.equal(await detectImportFileKind(file), 'backup');
});

test('detectImportFileKind separates csv, json and unknown files', async () => {
  const csv = ['日期,时间,分类,备注,金额', '2026-10-23,12:00,餐饮,午饭,35.00'].join('\n');
  assert.equal(await detectImportFileKind(new File([csv], 'data.csv')), 'csv');
  assert.equal(await detectImportFileKind(new File([csv], 'data')), 'csv');
  assert.equal(await detectImportFileKind(new File(['{"foo":1}'], 'data.json')), 'json');
  assert.equal(await detectImportFileKind(new File(['hello world'], 'notes')), 'unknown');
});
