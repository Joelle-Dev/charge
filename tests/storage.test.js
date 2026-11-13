import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, storageUsagePercent } from '../src/lib/storage.js';

test('formatBytes renders readable sizes', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(1024 * 1024), '1.0 MB');
  assert.equal(formatBytes(5.5 * 1024 ** 3), '5.5 GB');
  assert.equal(formatBytes(Number.NaN), '0 B');
});

test('storageUsagePercent clamps between 0 and 100', () => {
  assert.equal(storageUsagePercent(50, 100), 50);
  assert.equal(storageUsagePercent(0, 0), 0);
  assert.equal(storageUsagePercent(150, 100), 100);
  assert.equal(storageUsagePercent(-5, 100), 0);
});
