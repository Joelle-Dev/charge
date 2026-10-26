import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths,
  buildCalendarGrid,
  currentMonthKey,
  fullDayLabel,
  monthKey,
  monthLabel,
  shortMonthLabel
} from '../src/utils/months.js';

const now = new Date('2026-10-23T12:00:00+08:00');

test('month helpers format and navigate months', () => {
  assert.equal(monthKey(now), '2026-10');
  assert.equal(currentMonthKey(now), '2026-10');
  assert.equal(monthLabel('2026-10'), '2026年10月');
  assert.equal(shortMonthLabel('2026-10'), '10月');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(fullDayLabel('2026-10-23'), '10月23日 周五');
});

test('calendar grid starts on Monday and contains the month', () => {
  const cells = buildCalendarGrid('2026-10', now);
  assert.equal(cells.length, 42);
  assert.equal(cells[0].dateKey, '2026-09-28');
  assert.equal(cells[0].inMonth, false);
  assert.equal(cells.filter((cell) => cell.inMonth).length, 31);
  assert.equal(cells.find((cell) => cell.dateKey === '2026-10-23').isToday, true);
  assert.equal(cells.find((cell) => cell.dateKey === '2026-10-01').day, 1);
});
