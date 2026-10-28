import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CATEGORY } from '../src/lib/parser.js';
import { formatTime, toDateInput } from '../src/utils/format.js';
import { buildStageCsv, parseStageCsv } from '../src/utils/csv.js';
import {
  buildBackup,
  parseBackup,
  prepareBackupImport
} from '../src/utils/backup.js';

const stage = {
  id: 'stage_1',
  name: '十月日常',
  budget: 1000,
  archived: false,
  createdAt: 100,
  updatedAt: 100
};

const expense = {
  id: 'expense_1',
  stageId: 'stage_1',
  amount: 35,
  category: '餐饮',
  note: '午饭',
  spentAt: '2026-10-23T04:00:00.000Z',
  createdAt: 200
};

test('parseStageCsv reads metadata and quoted values', () => {
  const csv = [
    '\ufeff阶段,十月日常',
    '预算,1000',
    '导出时间,2026-10-23 16:30',
    '支出笔数,2',
    '总支出,55.00',
    '预算,1000.00',
    '剩余,945.00',
    '',
    '日期,时间,分类,备注,金额',
    '2026-10-23,12:00,餐饮,"午饭,好吃",35.00',
    '2026/10/24,9:05,交通,打车,20.50'
  ].join('\r\n');

  const result = parseStageCsv(csv);
  assert.equal(result.error, undefined);
  assert.equal(result.stageName, '十月日常');
  assert.equal(result.budget, 1000);
  assert.equal(result.expenses.length, 2);
  assert.equal(result.expenses[0].note, '午饭,好吃');
  assert.equal(result.expenses[1].amount, 20.5);
  assert.equal(toDateInput(new Date(result.expenses[0].spentAt)), '2026-10-23');
  assert.equal(formatTime(result.expenses[1].spentAt), '09:05');
  assert.equal(result.errors.length, 0);
});


test('parseStageCsv can re-import the app CSV export', () => {
  const csv = buildStageCsv(stage, [expense], {
    now: new Date('2026-10-23T16:30:00+08:00')
  });
  const parsed = parseStageCsv(csv);

  assert.equal(parsed.stageName, '十月日常');
  assert.equal(parsed.budget, 1000);
  assert.equal(parsed.expenses.length, 1);
  assert.equal(parsed.expenses[0].amount, 35);
  assert.equal(parsed.expenses[0].category, '餐饮');
  assert.equal(parsed.expenses[0].note, '午饭');
  assert.equal(parsed.errors.length, 0);
});

test('parseStageCsv reports invalid rows and missing headers', () => {
  const csv = [
    '日期,时间,分类,备注,金额',
    '2026-10-23,12:00,餐饮,午饭,35',
    'not-a-date,12:00,餐饮,坏数据,10',
    '2026-10-24,12:00,餐饮,金额错误,0'
  ].join('\n');

  const result = parseStageCsv(csv);
  assert.equal(result.expenses.length, 1);
  assert.equal(result.errors.length, 2);
  assert.equal(result.errors[0].line, 3);

  assert.equal(parseStageCsv('foo,bar').error, '没有找到「日期,时间,分类,备注,金额」表头');
});

test('buildBackup creates a versioned payload', () => {
  const payload = buildBackup({
    stages: [stage],
    expenses: [expense],
    categories: ['餐饮', '交通'],
    currentStageId: 'stage_1',
    achievementUnlocked: ['first-paw', 'first-paw', 'ten-records'],
    now: new Date('2026-10-28T00:00:00.000Z')
  });

  assert.equal(payload.app, 'shoucai-xiaoguo');
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.exportedAt, '2026-10-28T00:00:00.000Z');
  assert.equal(payload.currentStageId, 'stage_1');
  assert.deepEqual(payload.achievementUnlocked, ['first-paw', 'ten-records']);
  assert.equal(payload.stages.length, 1);
  assert.equal(payload.expenses.length, 1);
});

test('parseBackup validates schema and drops invalid records', () => {
  const payload = buildBackup({
    stages: [stage],
    expenses: [expense],
    categories: ['餐饮'],
    currentStageId: 'stage_1',
    achievementUnlocked: ['first-paw']
  });

  const parsed = parseBackup(JSON.stringify(payload));
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.data.stages.length, 1);
  assert.equal(parsed.data.expenses.length, 1);
  assert.ok(parsed.data.categories.includes(DEFAULT_CATEGORY));

  assert.equal(parseBackup('not json').error, '不是有效的 JSON 文件');
  assert.equal(
    parseBackup(JSON.stringify({ ...payload, schemaVersion: 99 })).error,
    '备份来自更新版本的应用，请升级后再导入'
  );
  assert.equal(
    parseBackup(JSON.stringify({ app: 'shoucai-xiaoguo' })).error,
    '备份缺少阶段或支出数据'
  );

  const invalid = parseBackup(JSON.stringify({
    ...payload,
    expenses: [
      { ...expense, id: 'bad_stage', stageId: 'missing' },
      { ...expense, id: 'bad_amount', amount: 0 },
      { ...expense, id: 'bad_date', spentAt: 'nope' }
    ]
  }));
  assert.equal(invalid.data.expenses.length, 0);
  assert.equal(invalid.errors.length, 3);
});

test('prepareBackupImport remaps IDs when merging', () => {
  const payload = buildBackup({
    stages: [stage],
    expenses: [expense],
    categories: ['餐饮'],
    currentStageId: 'stage_1',
    achievementUnlocked: ['first-paw']
  });
  const parsed = parseBackup(JSON.stringify(payload));
  const prepared = prepareBackupImport(parsed.data, {
    mode: 'merge',
    existingStages: [{ id: 'stage_existing', name: '现有', archived: false }],
    existingCategories: ['交通'],
    existingAchievements: ['ten-records'],
    existingCurrentStageId: 'stage_existing'
  });

  assert.notEqual(prepared.stages[0].id, 'stage_1');
  assert.equal(prepared.expenses[0].stageId, prepared.stages[0].id);
  assert.notEqual(prepared.expenses[0].id, 'expense_1');
  assert.equal(prepared.currentStageId, 'stage_existing');
  assert.ok(prepared.categories.includes('交通'));
  assert.ok(prepared.categories.includes('餐饮'));
  assert.deepEqual(
    [...prepared.achievementUnlocked].sort(),
    ['first-paw', 'ten-records']
  );
  assert.deepEqual(prepared.counts, { stages: 1, expenses: 1 });
});

test('prepareBackupImport preserves IDs when replacing', () => {
  const payload = buildBackup({
    stages: [stage],
    expenses: [expense],
    categories: ['餐饮'],
    currentStageId: 'stage_1',
    achievementUnlocked: ['first-paw']
  });
  const parsed = parseBackup(JSON.stringify(payload));
  const prepared = prepareBackupImport(parsed.data, {
    mode: 'replace',
    existingCategories: ['交通'],
    existingAchievements: ['ten-records'],
    existingCurrentStageId: 'stage_old'
  });

  assert.equal(prepared.stages[0].id, 'stage_1');
  assert.equal(prepared.expenses[0].id, 'expense_1');
  assert.equal(prepared.expenses[0].stageId, 'stage_1');
  assert.equal(prepared.currentStageId, 'stage_1');
  assert.deepEqual(prepared.achievementUnlocked, ['first-paw']);
  assert.ok(!prepared.categories.includes('交通'));
});
