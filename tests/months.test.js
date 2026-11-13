import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths,
  currentMonthKey,
  monthBounds,
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
});

test('month bounds cover the whole month in ISO strings', () => {
  const [start, end] = monthBounds('2026-10');
  assert.equal(new Date(start).getFullYear(), 2026);
  assert.equal(new Date(start).getMonth(), 9);
  assert.equal(new Date(start).getDate(), 1);
  assert.equal(new Date(end).getMonth(), 10);
  assert.equal(new Date(end).getDate(), 1);
});

test('monthKey treats date-only strings as local dates', () => {
  assert.equal(monthKey('2026-11-01'), '2026-11');
  assert.equal(monthKey('2026-2-5'), '2026-02');
});
