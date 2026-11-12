import { hideAmount } from '../lib/privacy.js';
import { formatMoney } from './format.js';

export function displayMoney(value) {
  return hideAmount.value ? '•••' : formatMoney(value);
}
