import { pad2, toDateInput } from './format.js';
import { addMonths, monthLabel } from './months.js';

export const TREND_PERIODS = ['week', 'month', 'year'];

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function parseKey(key) {
  return new Date(`${key}T12:00:00`);
}

function addDays(key, delta) {
  const date = parseKey(key);
  date.setDate(date.getDate() + delta);
  return toDateInput(date);
}

function dayDiff(from, to) {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  return Math.round(
    (Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86400000
  );
}

function monthEnd(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${month}-${pad2(new Date(year, monthNumber, 0).getDate())}`;
}

export function startOfWeek(key) {
  const date = parseKey(key);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return toDateInput(date);
}

export function periodRange(period, anchor) {
  if (period === 'week') {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 6) };
  }
  if (period === 'year') {
    const year = anchor.slice(0, 4);
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  const month = anchor.slice(0, 7);
  return { from: `${month}-01`, to: monthEnd(month) };
}

export function shiftTrendAnchor(anchor, period, delta, today) {
  const currentStart = periodRange(period, today).from;
  let next;

  if (period === 'week') {
    next = addDays(startOfWeek(anchor), delta * 7);
  } else if (period === 'year') {
    next = `${Number(anchor.slice(0, 4)) + delta}-01-01`;
  } else {
    next = `${addMonths(anchor.slice(0, 7), delta)}-01`;
  }

  if (next > currentStart) return currentStart;
  return next;
}

function sumRange(days, from, to) {
  if (!from || !to || from > to) return 0;
  let total = 0;
  let key = from;
  while (key <= to) {
    total += days.get(key) || 0;
    key = addDays(key, 1);
  }
  return total;
}

function totalsMap(days) {
  const totals = new Map();
  for (const day of days) {
    if (!day?.key) continue;
    totals.set(day.key, Number(day.total) || 0);
  }
  return totals;
}

function countsMap(days) {
  const counts = new Map();
  for (const day of days) {
    if (!day?.key) continue;
    counts.set(day.key, Number(day.count) || 0);
  }
  return counts;
}

function shortWeekLabel(from, to) {
  const fromYear = from.slice(0, 4);
  const toYear = to.slice(0, 4);
  if (fromYear === toYear) return `${shortDate(from)}-${shortDate(to)}`;
  return `${fromYear}.${shortDate(from)}-${toYear}.${shortDate(to)}`;
}

export function buildTrendPeriodOptions({ days = [], period = 'month', today } = {}) {
  const todayKey = today || toDateInput(new Date());
  const safePeriod = TREND_PERIODS.includes(period) ? period : 'month';
  const totals = totalsMap(days);
  const firstKey = [...totals.keys()].sort()[0] || todayKey;
  const currentStart = periodRange(safePeriod, todayKey).from;
  let anchor = periodRange(safePeriod, firstKey).from;
  if (anchor > currentStart) anchor = currentStart;

  const options = [];
  for (let index = 0; index < 2000 && anchor <= currentStart; index += 1) {
    const range = periodRange(safePeriod, anchor);
    let label;
    let shortLabel;

    if (safePeriod === 'week') {
      label = weekLabel(range.from, range.to);
      shortLabel = shortWeekLabel(range.from, range.to);
    } else if (safePeriod === 'year') {
      label = `${range.from.slice(0, 4)}年`;
      shortLabel = label;
    } else {
      label = monthLabel(range.from);
      shortLabel = `${range.from.slice(2, 4)}年${Number(range.from.slice(5, 7))}月`;
    }

    options.push({
      key: range.from,
      label,
      shortLabel,
      total: sumRange(totals, range.from, range.to),
      isCurrent: range.from === currentStart
    });

    if (safePeriod === 'week') {
      anchor = addDays(anchor, 7);
    } else if (safePeriod === 'year') {
      anchor = `${Number(anchor.slice(0, 4)) + 1}-01-01`;
    } else {
      anchor = `${addMonths(anchor.slice(0, 7), 1)}-01`;
    }
  }

  return options;
}

function compareTotals(current, previous) {
  if (!previous) {
    return {
      text: '—',
      tone: 'flat',
      previous: 0,
      note: current ? '之前没花钱' : ''
    };
  }

  const diff = current - previous;
  const percent = Math.round((diff / previous) * 100);
  return {
    text: `${diff >= 0 ? '+' : ''}${percent}%`,
    tone: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
    previous,
    note: ''
  };
}

function shortDate(key) {
  return `${Number(key.slice(5, 7))}.${Number(key.slice(8))}`;
}

function weekLabel(from, to) {
  const fromYear = from.slice(0, 4);
  const toYear = to.slice(0, 4);
  if (fromYear === toYear) return `${fromYear}.${shortDate(from)} - ${shortDate(to)}`;
  return `${fromYear}.${shortDate(from)} - ${toYear}.${shortDate(to)}`;
}

function elapsedDays(period, range, today) {
  if (range.to < today) return dayDiff(range.from, range.to) + 1;
  if (range.from > today) return 1;
  return dayDiff(range.from, today) + 1;
}

function elapsedMonths(range, today) {
  if (range.to < today) return 12;
  if (range.from > today) return 1;
  return Number(today.slice(5, 7));
}

export function buildTrendSeries({
  days = [],
  period = 'month',
  anchor,
  today
} = {}) {
  const todayKey = today || toDateInput(new Date());
  const anchorKey = anchor || todayKey;
  const safePeriod = TREND_PERIODS.includes(period) ? period : 'month';
  const range = periodRange(safePeriod, anchorKey);
  const currentRange = periodRange(safePeriod, todayKey);
  const totals = totalsMap(days);
  const counts = countsMap(days);

  let points;
  let label;
  let averageLabel;
  let divisor;
  let averageUnit;
  let previousLabel;

  if (safePeriod === 'week') {
    points = WEEKDAY_LABELS.map((weekday, index) => {
      const key = addDays(range.from, index);
      return {
        key,
        label: weekday,
        fullLabel: `${Number(key.slice(5, 7))}月${Number(key.slice(8))}日`,
        amount: totals.get(key) || 0,
        isFuture: key > todayKey
      };
    });
    label = weekLabel(range.from, range.to);
    averageLabel = '日均';
    averageUnit = '天';
    divisor = elapsedDays(safePeriod, range, todayKey);
    previousLabel = '上周';
  } else if (safePeriod === 'year') {
    const year = range.from.slice(0, 4);
    points = Array.from({ length: 12 }, (_, index) => {
      const month = `${year}-${pad2(index + 1)}`;
      return {
        key: month,
        label: `${index + 1}月`,
        fullLabel: monthLabel(month),
        amount: sumRange(totals, `${month}-01`, monthEnd(month)),
        isFuture: month > todayKey.slice(0, 7)
      };
    });
    label = `${year}年`;
    averageLabel = '月均';
    averageUnit = '个月';
    divisor = elapsedMonths(range, todayKey);
    previousLabel = '上年';
  } else {
    const month = range.from.slice(0, 7);
    const dayCount = Number(range.to.slice(8));
    points = Array.from({ length: dayCount }, (_, index) => {
      const day = index + 1;
      const key = `${month}-${pad2(day)}`;
      return {
        key,
        label: String(day),
        fullLabel: `${Number(month.slice(5, 7))}月${day}日`,
        amount: totals.get(key) || 0,
        isFuture: key > todayKey
      };
    });
    label = monthLabel(month);
    averageLabel = '日均';
    averageUnit = '天';
    divisor = elapsedDays(safePeriod, range, todayKey);
    previousLabel = '上月';
  }

  const total = points.reduce((sum, point) => sum + point.amount, 0);
  const count = sumRange(counts, range.from, range.to);
  const activeCount = points.filter((point) => point.amount > 0).length;
  const max = points.reduce((peak, point) => Math.max(peak, point.amount), 0);
  const previousAnchor = shiftTrendAnchor(range.from, safePeriod, -1, todayKey);
  const previousRange = periodRange(safePeriod, previousAnchor);
  const previousTotal = sumRange(totals, previousRange.from, previousRange.to);
  const average = divisor > 0 ? total / divisor : 0;

  return {
    period: safePeriod,
    range,
    label,
    points,
    total,
    count,
    average,
    averageLabel,
    averageUnit,
    divisor,
    averageNote: `按 ${divisor} ${averageUnit}`,
    activeCount,
    max,
    previousTotal,
    previousLabel,
    comparisonLabel: `较${previousLabel}`,
    comparison: compareTotals(total, previousTotal),
    canNext: range.from < currentRange.from,
    isCurrent: range.from === currentRange.from
  };
}
