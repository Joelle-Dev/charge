import { roundCents } from './format.js';

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
  return roundCents(number);
}

export function isValidAmount(value) {
  const number = toAmountNumber(value);
  return number > 0 && number <= MAX_AMOUNT;
}

export function formatAmountInput(value) {
  const raw = value || '';
  if (!raw) return '';

  const dotIndex = raw.indexOf('.');
  const integerPart = dotIndex === -1 ? raw : raw.slice(0, dotIndex);
  const decimalPart = dotIndex === -1 ? '' : raw.slice(dotIndex + 1);
  const integer = (integerPart || '0').replace(/^0+(?=\d)/, '');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dotIndex === -1 ? grouped : `${grouped}.${decimalPart}`;
}

function splitLastOperand(value) {
  const index = Math.max(value.lastIndexOf('+'), value.lastIndexOf('-'));
  if (index === -1) return { head: '', operand: value };
  return {
    head: value.slice(0, index + 1),
    operand: value.slice(index + 1)
  };
}

export function appendExpressionDigit(current, digit) {
  if (!/^\d$/.test(digit)) return current;
  const value = current || '';
  const { head, operand } = splitLastOperand(value);
  return `${head}${appendDigit(operand, digit)}`;
}

export function appendExpressionDecimal(current) {
  const value = current || '';
  const { head, operand } = splitLastOperand(value);
  if (operand.includes('.')) return value;
  return `${head}${appendDecimal(operand)}`;
}

export function appendExpressionDoubleZero(current) {
  return appendExpressionDigit(appendExpressionDigit(current, '0'), '0');
}

export function appendExpressionOperator(current, operator) {
  if (operator !== '+' && operator !== '-') return current;
  let value = current || '';
  if (!value) return '';
  if (value.endsWith('.')) value = value.slice(0, -1);
  if (!value) return '';
  if (/[+-]$/.test(value)) return `${value.slice(0, -1)}${operator}`;
  return `${value}${operator}`;
}

export function evaluateExpression(current) {
  const value = String(current || '').trim();
  if (!value || /[+-]$/.test(value)) return { valid: false, value: 0 };

  const parts = value.split(/([+-])/);
  let total = 0;
  let operator = '+';
  let hasOperand = false;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (index % 2 === 0) {
      if (!/^\d+(?:\.\d{0,2})?$/.test(part)) return { valid: false, value: 0 };
      const number = Number(part);
      if (!Number.isFinite(number)) return { valid: false, value: 0 };
      total = operator === '+' ? total + number : total - number;
      hasOperand = true;
    } else {
      if (part !== '+' && part !== '-') return { valid: false, value: 0 };
      operator = part;
    }
  }

  if (!hasOperand) return { valid: false, value: 0 };
  return { valid: true, value: roundCents(total) };
}

export function isValidExpression(current) {
  const result = evaluateExpression(current);
  return result.valid && result.value > 0 && result.value <= MAX_AMOUNT;
}

export function formatExpression(current) {
  const value = String(current || '');
  if (!value) return '';
  return value.replace(/\d+(?:\.\d*)?/g, (part) => formatAmountInput(part));
}
