import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CATEGORY } from '../src/lib/parser.js';
import { formatTime, toDateInput } from '../src/utils/format.js';
import { buildStageCsv, parseStageCsv } from '../src/utils/csv.js';

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
