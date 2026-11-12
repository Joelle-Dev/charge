import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTrendPeriodOptions,
  buildTrendSeries,
  periodRange,
  shiftTrendAnchor,
  startOfWeek
} from '../src/utils/trend.js';

test('week trend uses Monday as the start and fills the whole week', () => {
  const series = buildTrendSeries({
    days: [
      { key: '2026-11-08', total: 999 },
      { key: '2026-11-09', total: 100, count: 2 },
      { key: '2026-11-10', total: 50, count: 1 }
    ],
    period: 'week',
    anchor: '2026-11-10',
    today: '2026-11-10'
  });

  assert.equal(series.range.from, '2026-11-09');
  assert.equal(series.range.to, '2026-11-15');
  assert.deepEqual(series.points.map((point) => point.label), ['一', '二', '三', '四', '五', '六', '日']);
  assert.equal(series.points.length, 7);
  assert.equal(series.total, 150);
  assert.equal(series.count, 3);
  assert.equal(series.activeCount, 2);
  assert.equal(series.max, 100);
  assert.equal(series.divisor, 2);
  assert.equal(series.average, 75);
  assert.equal(series.previousTotal, 999);
  assert.equal(series.comparison.tone, 'down');
  assert.equal(series.canNext, false);
});

test('month trend fills every day and compares with the previous month', () => {
  const series = buildTrendSeries({
    days: [
      { key: '2026-11-01', total: 10 },
      { key: '2026-11-05', total: 20 },
      { key: '2026-10-31', total: 999 },
      { key: '2026-12-01', total: 999 }
    ],
    period: 'month',
    anchor: '2026-11-10',
    today: '2026-11-10'
  });

  assert.equal(series.range.from, '2026-11-01');
  assert.equal(series.range.to, '2026-11-30');
  assert.equal(series.label, '2026年11月');
  assert.equal(series.points.length, 30);
  assert.equal(series.points[0].fullLabel, '11月1日');
  assert.equal(series.points[29].isFuture, true);
  assert.equal(series.total, 30);
  assert.equal(series.activeCount, 2);
  assert.equal(series.divisor, 10);
  assert.equal(series.average, 3);
  assert.equal(series.previousTotal, 999);
});

test('year trend aggregates by month and compares with last year', () => {
  const series = buildTrendSeries({
    days: [
      { key: '2026-02-10', total: 100 },
      { key: '2026-02-11', total: 50 },
      { key: '2026-12-01', total: 25 },
      { key: '2025-12-31', total: 999 }
    ],
    period: 'year',
    anchor: '2026-06-15',
    today: '2026-06-15'
  });

  assert.equal(series.range.from, '2026-01-01');
  assert.equal(series.range.to, '2026-12-31');
  assert.equal(series.label, '2026年');
  assert.equal(series.points.length, 12);
  assert.equal(series.points[1].amount, 150);
  assert.equal(series.points[11].amount, 25);
  assert.equal(series.total, 175);
  assert.equal(series.activeCount, 2);
  assert.equal(series.divisor, 6);
  assert.ok(Math.abs(series.average - 175 / 6) < 1e-9);
  assert.equal(series.previousTotal, 999);
  assert.equal(series.canNext, false);
});

test('trend navigation clamps at the current period', () => {
  assert.equal(shiftTrendAnchor('2026-11-10', 'week', 1, '2026-11-10'), '2026-11-09');
  assert.equal(shiftTrendAnchor('2026-11-10', 'week', -1, '2026-11-10'), '2026-11-02');
  assert.equal(shiftTrendAnchor('2026-11-10', 'month', -1, '2026-11-10'), '2026-10-01');
  assert.equal(shiftTrendAnchor('2026-11-10', 'month', 1, '2026-11-10'), '2026-11-01');
  assert.equal(shiftTrendAnchor('2026-06-15', 'year', -1, '2026-11-10'), '2025-01-01');
  assert.equal(startOfWeek('2026-11-15'), '2026-11-09');
  assert.deepEqual(periodRange('month', '2026-02-15'), {
    from: '2026-02-01',
    to: '2026-02-28'
  });
});

test('empty trend data is zero filled', () => {
  const series = buildTrendSeries({
    days: [],
    period: 'week',
    anchor: '2026-11-10',
    today: '2026-11-10'
  });

  assert.equal(series.total, 0);
  assert.equal(series.average, 0);
  assert.equal(series.activeCount, 0);
  assert.equal(series.points.every((point) => point.amount === 0), true);
  assert.equal(series.comparison.text, '—');
});

test('period options are scrollable, chronological and include totals', () => {
  const weekly = buildTrendPeriodOptions({
    days: [
      { key: '2026-10-27', total: 10 },
      { key: '2026-11-09', total: 20 }
    ],
    period: 'week',
    today: '2026-11-10'
  });
  assert.equal(weekly[0].key, '2026-10-26');
  assert.equal(weekly[weekly.length - 1].key, '2026-11-09');
  assert.equal(weekly[0].total, 10);
  assert.equal(weekly[weekly.length - 1].total, 20);
  assert.equal(weekly[weekly.length - 1].isCurrent, true);

  const monthly = buildTrendPeriodOptions({
    days: [
      { key: '2025-12-20', total: 5 },
      { key: '2026-01-03', total: 7 }
    ],
    period: 'month',
    today: '2026-01-10'
  });
  assert.deepEqual(monthly.map((option) => option.shortLabel), ['25年12月', '26年1月']);
  assert.deepEqual(monthly.map((option) => option.total), [5, 7]);

  const yearly = buildTrendPeriodOptions({
    days: [{ key: '2024-06-01', total: 3 }],
    period: 'year',
    today: '2026-11-10'
  });
  assert.deepEqual(yearly.map((option) => option.shortLabel), ['2024年', '2025年', '2026年']);
  assert.equal(yearly[0].total, 3);
});
