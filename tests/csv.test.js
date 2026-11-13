import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStageCsv, parseCsv, parseStageCsv } from '../src/utils/csv.js';

const stage = { name: '国庆旅行', budget: 1000 };
const expenses = [
  {
    amount: 35,
    category: '餐饮',
    note: '午饭',
    spentAt: '2026-10-23T12:00:00+08:00'
  }
];

test('CSV includes stage title and summary rows', () => {
  const csv = buildStageCsv(stage, expenses, {
    now: new Date('2026-10-23T16:30:00+08:00')
  });

  assert.ok(csv.startsWith('\ufeff'));
  assert.match(csv, /^﻿账本,国庆旅行/m);
  assert.match(csv, /^导出时间,2026-10-23 16:30/m);
  assert.match(csv, /^支出笔数,1/m);
  assert.match(csv, /^总支出,35\.00/m);
  assert.match(csv, /^预算,1000\.00/m);
  assert.match(csv, /^剩余,965\.00/m);
  assert.match(csv, /日期,时间,分类,备注,金额/);
  assert.match(csv, /2026-10-23,12:00,餐饮,午饭,35\.00/);
});

test('CSV can include a month title', () => {
  const csv = buildStageCsv(stage, expenses, {
    now: new Date('2026-10-23T16:30:00+08:00'),
    month: '2026-10'
  });
  assert.match(csv, /^月份,2026年10月$/m);
});

test('CSV returns empty when there are no expenses', () => {
  assert.equal(buildStageCsv(stage, []), '');
});

test('CSV import rejects impossible calendar dates', () => {
  const csv = [
    '日期,时间,分类,备注,金额',
    '2025-02-29,12:00,餐饮,闰年错,30',
    '2026-02-30,12:00,餐饮,溢出错,40',
    '2026-04-31,12:00,餐饮,溢出错2,50'
  ].join('\n');

  const result = parseStageCsv(csv);
  assert.equal(result.expenses.length, 0);
  assert.equal(result.errors.length, 3);
  for (const error of result.errors) {
    assert.equal(error.message, '日期格式不正确');
  }
});

test('CSV import rejects impossible clock times', () => {
  const csv = [
    '日期,时间,分类,备注,金额',
    '2026-11-13,24:00,餐饮,跨天,30',
    '2026-11-13,25:99,餐饮,坏时间,40'
  ].join('\n');

  const result = parseStageCsv(csv);
  assert.equal(result.expenses.length, 0);
  assert.equal(result.errors.length, 2);
  for (const error of result.errors) {
    assert.equal(error.message, '时间格式不正确');
  }
});

test('CSV import normalizes month metadata to machine key', () => {
  const csv = [
    '账本,国庆旅行',
    '月份,2026年10月',
    '日期,时间,分类,备注,金额',
    '2026-10-23,12:00,餐饮,午饭,35'
  ].join('\n');
  const result = parseStageCsv(csv);
  assert.equal(result.month, '2026-10');
});

test('CSV import accepts valid rows', () => {
  const csv = [
    '日期,时间,分类,备注,金额',
    '2026-10-23,12:00,餐饮,午饭,35',
    '2026/2/28,08:05,交通,打车,25.5'
  ].join('\n');

  const result = parseStageCsv(csv);
  assert.equal(result.errors.length, 0);
  assert.equal(result.expenses.length, 2);
  assert.equal(result.expenses[0].amount, 35);
  assert.equal(result.expenses[1].amount, 25.5);
  assert.equal(result.expenses[1].category, '交通');
});

test('CSV export neutralizes formula cells', () => {
  const csv = buildStageCsv(stage, [
    { amount: 35, category: '餐饮', note: '=cmd|calc', spentAt: '2026-10-23T12:00:00+08:00' },
    { amount: 20, category: '+购物', note: '@SUM(A1)', spentAt: '2026-10-23T12:00:00+08:00' },
    { amount: 10, category: '餐饮', note: '-2+3+cmd', spentAt: '2026-10-23T12:00:00+08:00' },
    { amount: 5, category: '餐饮', note: '-普通备注', spentAt: '2026-10-23T12:00:00+08:00' }
  ], { now: new Date('2026-10-23T16:30:00+08:00') });

  assert.match(csv, /,'=cmd\|calc,35\.00/);
  assert.match(csv, /,'\+购物,/);
  assert.match(csv, /,'@SUM\(A1\),/);
  assert.match(csv, /,'-2\+3\+cmd,/);
  assert.match(csv, /,'-普通备注,/);
});

test('CSV export keeps negative numeric cells untouched', () => {
  const csv = buildStageCsv(stage, [
    { amount: -5, category: '餐饮', note: '退了', spentAt: '2026-10-23T12:00:00+08:00' }
  ], { now: new Date('2026-10-23T16:30:00+08:00') });
  assert.match(csv, /,-5\.00$/m);
});

test('parseCsv keeps stray quotes in unquoted fields literal', () => {
  const rows = parseCsv('a,12" pizza,note\nb,2,x');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], ['a', '12" pizza', 'note']);
  assert.deepEqual(rows[1], ['b', '2', 'x']);
});

test('parseCsv handles quoted fields with commas, newlines and escapes', () => {
  const rows = parseCsv('a,"b,c","line1\nline2","say ""hi""",d');
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], ['a', 'b,c', 'line1\nline2', 'say "hi"', 'd']);
});

test('CSV import rejects malformed amount cells', () => {
  const csv = [
    '日期,时间,分类,备注,金额',
    '2026-10-23,12:00,餐饮,十六进制,0x10',
    '2026-10-23,12:00,餐饮,科学计数,1e3',
    '2026-10-23,12:00,餐饮,欧式小数,"12,34"'
  ].join('\n');

  const result = parseStageCsv(csv);
  assert.equal(result.expenses.length, 0);
  assert.equal(result.errors.length, 3);
  for (const error of result.errors) {
    assert.equal(error.message, '金额无效');
  }
});

test('CSV import accepts grouped thousands in amounts', () => {
  const csv = [
    '日期,时间,分类,备注,金额',
    '2026-10-23,12:00,餐饮,大餐,"1,234.56"'
  ].join('\n');
  const result = parseStageCsv(csv);
  assert.equal(result.errors.length, 0);
  assert.equal(result.expenses[0].amount, 1234.56);
});

test('CSV import rounds amounts to cents safely', () => {
  const csv = [
    '日期,时间,分类,备注,金额',
    '2026-10-23,12:00,餐饮,三分钱,1.005'
  ].join('\n');
  const result = parseStageCsv(csv);
  assert.equal(result.expenses[0].amount, 1.01);
});
