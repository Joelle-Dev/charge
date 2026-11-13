import test from 'node:test';
import assert from 'node:assert/strict';
import { isIgnorableError, toMessage } from '../src/lib/errors.js';

test('isIgnorableError ignores user cancels and aborts', () => {
  assert.equal(isIgnorableError(null), true);
  assert.equal(isIgnorableError(undefined), true);
  assert.equal(isIgnorableError({ name: 'AbortError' }), true);
  assert.equal(isIgnorableError('cancel'), true);
  assert.equal(isIgnorableError('close'), true);
  assert.equal(isIgnorableError(new Error('The operation was aborted')), true);
});

test('isIgnorableError keeps real errors', () => {
  assert.equal(isIgnorableError(new Error('boom')), false);
  assert.equal(isIgnorableError('oops'), false);
});

test('toMessage falls back for empty errors', () => {
  assert.equal(toMessage(new Error('boom')), 'boom');
  assert.equal(toMessage('oops'), 'oops');
  assert.equal(toMessage(null), '未知错误');
});
