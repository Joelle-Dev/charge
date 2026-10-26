import { toDateInput } from './format.js';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function monthKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthKey(now = new Date()) {
  return monthKey(now);
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

export function buildCalendarGrid(key, now = new Date()) {
  const [year, month] = key.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const today = toDateInput(now);
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(year, month - 1, 1 - offset + index);
    const dateKey = toDateInput(date);
    cells.push({
      dateKey,
      day: date.getDate(),
      inMonth: date.getMonth() === month - 1,
      isToday: dateKey === today,
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    });
  }

  return cells;
}

export function fullDayLabel(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`;
}
