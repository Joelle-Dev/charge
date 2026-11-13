import test from 'node:test';
import assert from 'node:assert/strict';
import { backupReminder } from '../src/utils/backupReminder.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-13T12:00:00Z').getTime();

test('backupReminder asks for the first backup when none exists', () => {
  const info = backupReminder(null, NOW);
  assert.equal(info.never, true);
  assert.equal(info.overdue, true);
  assert.equal(info.text, '还没打包过，导出一份更安心');
});

test('backupReminder shows how long ago the last backup was', () => {
  assert.equal(backupReminder(NOW, NOW).text, '上次打包：今天');
  assert.equal(backupReminder(NOW - DAY, NOW).text, '上次打包：昨天');
  assert.equal(backupReminder(NOW - 3 * DAY, NOW).text, '上次打包：3 天前');
  assert.equal(backupReminder(NOW - 3 * DAY, NOW).overdue, false);
});

test('backupReminder warns when the last backup is stale', () => {
  const info = backupReminder(NOW - 20 * DAY, NOW);
  assert.equal(info.overdue, true);
  assert.equal(info.days, 20);
  assert.equal(info.text, '20 天没打包啦，导出一份更安心');
});

test('backupReminder counts calendar days, not 24-hour blocks', () => {
  const at = new Date('2026-11-10T10:00:00Z').getTime();
  const later = new Date('2026-11-13T09:00:00Z').getTime();
  const info = backupReminder(at, later);
  assert.equal(info.days, 3);
  assert.equal(info.text, '上次打包：3 天前');
});

test('backupReminder treats future timestamps as today', () => {
  const info = backupReminder(NOW + 2 * DAY, NOW);
  assert.equal(info.days, 0);
  assert.equal(info.text, '上次打包：今天');
});
