export const MAX_AMOUNT = 9999999.99;
const MAX_INTEGER_DIGITS = 7;
const MAX_DECIMALS = 2;

function decimalLength(value) {
  const index = value.indexOf('.');
  return index === -1 ? 0 : value.length - index - 1;
}

function integerLength(value) {
  const index = value.indexOf('.');
  return index === -1 ? value.length : index;
}

export function appendDigit(current, digit) {
  if (!/^\d$/.test(digit)) return current;
  const value = current || '';

  if (value.includes('.')) {
    if (decimalLength(value) >= MAX_DECIMALS) return value;
    return `${value}${digit}`;
  }

  if (value === '0') return digit === '0' ? value : digit;
  if (integerLength(value) >= MAX_INTEGER_DIGITS) return value;
  return `${value}${digit}`;
}

export function appendDecimal(current) {
  const value = current || '';
  if (value.includes('.')) return value;
  return value ? `${value}.` : '0.';
}

export function appendDoubleZero(current) {
  return appendDigit(appendDigit(current, '0'), '0');
}

export function backspaceAmount(current) {
  const value = current || '';
  return value.length > 1 ? value.slice(0, -1) : '';
}

export function clearAmount() {
  return '';
}

export function amountToInput(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '';
  return number
    .toFixed(MAX_DECIMALS)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
}

export function toAmountNumber(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.round(number * 100) / 100;
}

export function isValidAmount(value) {
  const number = toAmountNumber(value);
  return number > 0 && number <= MAX_AMOUNT;
}

export function formatAmountInput(value) {
  const raw = value || '';
  if (!raw) return '';

  const [integerPart, decimalPart] = raw.split('.');
  const integer = (integerPart || '0').replace(/^0+(?=\d)/, '');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return raw.includes('.') ? `${grouped}.${decimalPart}` : grouped;
}
