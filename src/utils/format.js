const CATEGORY_COLORS = {
  餐饮: '#d9825b',
  交通: '#6f8fb8',
  住宿: '#a78bc4',
  购物: '#db7c9b',
  娱乐: '#d9a84e',
  门票: '#c68a5f',
  其他: '#9a8c80'
};

const PALETTE = ['#6f8fb8', '#d9825b', '#a78bc4', '#db7c9b', '#d9a84e', '#c68a5f', '#8f9bb3'];
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const moneyFormatters = new Map();

function moneyFormatter(maximumFractionDigits) {
  let formatter = moneyFormatters.get(maximumFractionDigits);
  if (!formatter) {
    formatter = new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits
    });
    moneyFormatters.set(maximumFractionDigits, formatter);
  }
  return formatter;
}

export function uid(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function formatMoney(value, maximumFractionDigits = 2) {
  return moneyFormatter(maximumFractionDigits).format(Number(value) || 0);
}

export function pad2(value) {
  return String(value).padStart(2, '0');
}

export function toDateInput(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function toTimeInput(date) {
  const d = new Date(date);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function combineLocal(dateStr, timeStr) {
  const value = new Date(`${dateStr}T${timeStr || '12:00'}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function applyDateToIso(iso, dateStr) {
  const original = new Date(iso);
  const time = `${pad2(original.getHours())}:${pad2(original.getMinutes())}`;
  const next = combineLocal(dateStr, time);
  return next ? next.toISOString() : iso;
}

export function formatTime(iso) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function dayKey(date) {
  return toDateInput(date);
}

export function dayLabel(key) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === toDateInput(today)) return '今天';
  if (key === toDateInput(yesterday)) return '昨天';
  const d = combineLocal(key, '12:00');
  if (!d) return key;
  const prefix = d.getFullYear() === today.getFullYear() ? '' : `${d.getFullYear()}年`;
  return `${prefix}${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]}`;
}

export function categoryColor(name) {
  if (CATEGORY_COLORS[name]) return CATEGORY_COLORS[name];
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function sumAmounts(expenses) {
  return expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
}
