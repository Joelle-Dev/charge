import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureAnchor,
  computeOffsets,
  computeWindow,
  findStartIndex,
  restoreAnchor
} from '../src/utils/virtualList.js';

const rows = [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }];
const estimate = () => 100;

test('computeOffsets stacks measured and estimated heights', () => {
  const heights = new Map([['b', 150]]);
  const { tops, total } = computeOffsets(rows, heights, estimate);
  assert.deepEqual(tops, [0, 100, 250, 350]);
  assert.equal(total, 450);
});

test('computeOffsets ignores invalid measurements', () => {
  const heights = new Map([['b', 0], ['c', NaN], ['d', -20]]);
  const { tops, total } = computeOffsets(rows, heights, estimate);
  assert.deepEqual(tops, [0, 100, 200, 300]);
  assert.equal(total, 400);
});

test('findStartIndex locates the row containing a scroll offset', () => {
  const tops = [0, 100, 250, 350];
  assert.equal(findStartIndex(tops, 0), 0);
  assert.equal(findStartIndex(tops, 99.5), 0);
  assert.equal(findStartIndex(tops, 100), 1);
  assert.equal(findStartIndex(tops, 260), 2);
  assert.equal(findStartIndex(tops, 9999), 3);
  assert.equal(findStartIndex(tops, -50), 0);
  assert.equal(findStartIndex([], 10), 0);
});

test('computeWindow keeps spacers consistent with the rendered slice', () => {
  const heights = new Map();
  const { tops, total } = computeOffsets(rows, heights, estimate);

  const mid = computeWindow({
    rows, tops, total, scrollTop: 220, viewportHeight: 100, overscan: 50
  });
  assert.equal(mid.start, 1);
  assert.equal(mid.end, 4);
  assert.equal(mid.topSpace, 100);
  assert.equal(mid.bottomSpace, 0);

  const head = computeWindow({
    rows, tops, total, scrollTop: 0, viewportHeight: 150, overscan: 0
  });
  assert.equal(head.start, 0);
  assert.equal(head.end, 2);
  assert.equal(head.topSpace, 0);
  assert.equal(head.bottomSpace, 200);
});

test('computeWindow clamps negative scroll and empty rows', () => {
  const heights = new Map();
  const { tops, total } = computeOffsets(rows, heights, estimate);
  const bounced = computeWindow({
    rows, tops, total, scrollTop: -80, viewportHeight: 150, overscan: 0
  });
  assert.equal(bounced.start, 0);
  assert.equal(bounced.topSpace, 0);

  const empty = computeWindow({
    rows: [], tops: [], total: 0, scrollTop: 10, viewportHeight: 100, overscan: 0
  });
  assert.deepEqual(empty, { start: 0, end: 0, topSpace: 0, bottomSpace: 0 });
});

test('anchor round-trip keeps the same row at the same viewport offset', () => {
  const heights = new Map([['b', 150]]);
  const { tops } = computeOffsets(rows, heights, estimate);
  const anchor = captureAnchor(rows, tops, 120);
  assert.equal(anchor.key, 'b');
  assert.equal(anchor.offset, 20);

  // a 由 100 变高到 130 后，b 的绝对位置后移 30
  const heights2 = new Map([['a', 130], ['b', 150]]);
  const { tops: tops2 } = computeOffsets(rows, heights2, estimate);
  assert.equal(restoreAnchor(anchor, rows, tops2), 150);
});

test('anchor survives rows changing around it', () => {
  const heights = new Map();
  const { tops } = computeOffsets(rows, heights, estimate);
  const anchor = captureAnchor(rows, tops, 150); // 落在 b，偏移 50

  // 前面插入两行、后面删掉一行：b 从 100 移到 300
  const next = [{ key: 'x' }, { key: 'y' }, ...rows.slice(0, 3)];
  const { tops: tops2 } = computeOffsets(next, heights, estimate);
  assert.equal(restoreAnchor(anchor, next, tops2), 350);
});

test('restoreAnchor returns null when the anchor row is gone', () => {
  assert.equal(restoreAnchor({ key: 'zz', offset: 10 }, rows, [0, 100, 250, 350]), null);
  assert.equal(restoreAnchor(null, rows, [0, 100, 250, 350]), null);
});
