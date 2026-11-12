import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney } from '../src/utils/format.js';
import { setActiveScope, setHideAmount } from '../src/lib/privacy.js';
import { displayMoney } from '../src/utils/money.js';

test('amount visibility is independent for each page scope', () => {
  setActiveScope('home');
  setHideAmount(false, 'home');
  setHideAmount(false, 'record');
  assert.equal(displayMoney(12), formatMoney(12));

  setHideAmount(true, 'home');
  assert.equal(displayMoney(12), '•••');

  setActiveScope('record');
  assert.equal(displayMoney(12), formatMoney(12));

  setHideAmount(true, 'record');
  assert.equal(displayMoney(12), formatMoney(12));

  setActiveScope('home');
  assert.equal(displayMoney(12), '•••');

  setHideAmount(false, 'home');
  setHideAmount(false, 'record');
});
