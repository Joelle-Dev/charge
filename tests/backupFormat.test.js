import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKUP_APP,
  BACKUP_KIND,
  BACKUP_SCHEMA_VERSION,
  backupFilename,
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
