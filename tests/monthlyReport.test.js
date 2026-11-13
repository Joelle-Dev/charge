import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonths } from '../src/utils/months.js';

// 复刻 MonthlyReportView 里的「上月同期截止日」推导
function previousCutoff(monthKey, elapsedDays) {
  const previousMonth = addMonths(monthKey, -1);
  const [year, monthNumber] = previousMonth.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    day: Math.min(elapsedDays, lastDay),
    // toIso 开区间：取 N+1 天 00:00
    cutoffIso: new Date(year, monthNumber - 1, Math.min(elapsedDays, lastDay) + 1).toISOString()
  };
}

test('上月同期截止日按上月自身天数收敛', () => {
  // 3 月 31 号看本月 → 上月 2 月只有 28 天
  assert.equal(previousCutoff('2026-03', 31).day, 28);
  // 1 月 31 号看本月 → 上月 12 月 31 天
  assert.equal(previousCutoff('2026-01', 31).day, 31);
  // 月中
  assert.equal(previousCutoff('2026-11', 13).day, 13);
});

test('上月同期截止是开区间：当天结束前一刻包含在范围内', () => {
  const { cutoffIso } = previousCutoff('2026-11', 13);
  const cutoff = new Date(cutoffIso);
  // 截止 = 上月 14 号 00:00，所以 13 号 23:59 仍被包含，14 号 00:00 被排除
  const lastIncluded = new Date(2026, 9, 13, 23, 59, 59).getTime();
  const firstExcluded = new Date(2026, 9, 14, 0, 0, 0).getTime();
  assert.ok(lastIncluded < cutoff.getTime());
  assert.equal(firstExcluded, cutoff.getTime());
});

test('跨年时上月是 12 月', () => {
  const { day, cutoffIso } = previousCutoff('2026-01', 10);
  assert.equal(day, 10);
  // 截止落在 12 月 11 号（上月同期），跨年不影响取数
  assert.equal(new Date(cutoffIso).getMonth(), 11);
  assert.equal(new Date(cutoffIso).getDate(), 11);
});
