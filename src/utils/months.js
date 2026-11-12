export function monthKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthKey(now = new Date()) {
  return monthKey(now);
}

export function monthBounds(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return [
    new Date(year, monthNumber - 1, 1).toISOString(),
    new Date(year, monthNumber, 1).toISOString()
  ];
}

export function monthLabel(key) {
  const [year, month] = key.split('-');
  return `${year}年${Number(month)}月`;
}

export function shortMonthLabel(key) {
  return `${Number(key.split('-')[1])}月`;
}

export function addMonths(key, delta) {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return monthKey(date);
}
