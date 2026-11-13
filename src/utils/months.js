export function monthKey(value) {
  // 纯日期字符串按本地日期解读，避免被当成 UTC 午夜差一个月
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
    if (match) return `${match[1]}-${match[2].padStart(2, '0')}`;
  }
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
