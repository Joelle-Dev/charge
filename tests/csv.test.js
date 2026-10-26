import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStageCsv } from '../src/utils/csv.js';

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
  assert.match(csv, /^﻿阶段,国庆旅行/m);
  assert.match(csv, /^导出时间,2026-10-23 16:30/m);
  assert.match(csv, /^支出笔数,1/m);
  assert.match(csv, /^总支出,35\.00/m);
  assert.match(csv, /^预算,1000\.00/m);
  assert.match(csv, /^剩余,965\.00/m);
  assert.match(csv, /日期,时间,分类,备注,金额/);
  assert.match(csv, /2026-10-23,12:00,餐饮,午饭,35\.00/);
});

test('CSV returns empty when there are no expenses', () => {
  assert.equal(buildStageCsv(stage, []), '');
});
