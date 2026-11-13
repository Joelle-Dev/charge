import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_AMOUNT,
  amountToInput,
  appendDecimal,
  appendDigit,
  appendDoubleZero,
  appendExpressionDecimal,
  appendExpressionDigit,
  appendExpressionOperator,
  backspaceAmount,
  clearAmount,
  evaluateExpression,
  formatAmountInput,
  formatExpression,
  isValidAmount,
  isValidExpression,
  toAmountNumber
} from '../src/utils/amountInput.js';

test('digits replace a single leading zero', () => {
  assert.equal(appendDigit('', '0'), '0');
  assert.equal(appendDigit('0', '0'), '0');
  assert.equal(appendDigit('0', '5'), '5');
  assert.equal(appendDigit('12', '3'), '123');
});

test('decimal input only allows two places and one dot', () => {
  assert.equal(appendDecimal(''), '0.');
  assert.equal(appendDecimal('12'), '12.');
  assert.equal(appendDecimal('12.3'), '12.3');
  assert.equal(appendDigit('12.3', '4'), '12.34');
  assert.equal(appendDigit('12.34', '5'), '12.34');
});

test('integer input is capped', () => {
  assert.equal(appendDigit('9999999', '9'), '9999999');
  assert.equal(appendDoubleZero('12'), '1200');
  assert.equal(appendDoubleZero(''), '0');
});

test('backspace and clear behave', () => {
  assert.equal(backspaceAmount('12'), '1');
  assert.equal(backspaceAmount('1'), '');
  assert.equal(backspaceAmount(''), '');
  assert.equal(clearAmount(), '');
});

test('amount display groups thousands and keeps a trailing dot', () => {
  assert.equal(formatAmountInput(''), '');
  assert.equal(formatAmountInput('0'), '0');
  assert.equal(formatAmountInput('0.'), '0.');
  assert.equal(formatAmountInput('1234.5'), '1,234.5');
  assert.equal(formatAmountInput('1234567'), '1,234,567');
});

test('amount conversion and validation', () => {
  assert.equal(amountToInput(35), '35');
  assert.equal(amountToInput(35.5), '35.5');
  assert.equal(amountToInput(35.05), '35.05');
  assert.equal(amountToInput(0), '');
  assert.equal(toAmountNumber('12.345'), 12.35);
  assert.equal(isValidAmount('0'), false);
  assert.equal(isValidAmount('0.01'), true);
  assert.equal(isValidAmount(String(MAX_AMOUNT)), true);
  assert.equal(isValidAmount(String(MAX_AMOUNT + 1)), false);
});

test('expression input supports addition and subtraction', () => {
  let value = '';
  value = appendExpressionDigit(value, '1');
  value = appendExpressionDigit(value, '2');
  value = appendExpressionOperator(value, '+');
  value = appendExpressionDigit(value, '8');
  value = appendExpressionOperator(value, '-');
  value = appendExpressionDigit(value, '3');

  assert.equal(value, '12+8-3');
  assert.equal(evaluateExpression(value).value, 17);
  assert.equal(formatExpression(value), '12+8-3');
  assert.equal(isValidExpression(value), true);
  assert.equal(isValidExpression('5-8'), false);
  assert.equal(isValidExpression('12+'), false);
  assert.equal(appendExpressionOperator('12.', '+'), '12+');
  assert.equal(appendExpressionOperator('12+', '-'), '12-');
  assert.equal(appendExpressionDecimal('12+'), '12+0.');
});

test('formatAmountInput preserves multi-dot and expression input', () => {
  assert.equal(formatAmountInput('1.2.3'), '1.2.3');
  assert.equal(formatAmountInput('1234+56'), '1,234+56');
  assert.equal(formatAmountInput('007'), '7');
});
