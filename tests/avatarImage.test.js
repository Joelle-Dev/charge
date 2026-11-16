import test from 'node:test';
import assert from 'node:assert/strict';
import {
  avatarBaseScale,
  avatarCropRect,
  clampAvatarOffset
} from '../src/utils/avatarImage.js';

test('avatarBaseScale covers the square stage', () => {
  assert.equal(avatarBaseScale(1000, 1000, 200), 0.2);
  assert.equal(avatarBaseScale(1000, 500, 200), 0.4);
  assert.equal(avatarBaseScale(500, 1000, 200), 0.4);
  assert.equal(avatarBaseScale(0, 1000, 200), 0);
});

test('clampAvatarOffset keeps the crop inside the image', () => {
  // 1000x500 image covering a 200 stage at scale 0.4 => rendered 400x200
  const clamped = clampAvatarOffset(1000, 500, 200, 1, 9999, -9999);
  assert.equal(clamped.x, 100);
  assert.equal(clamped.y, 0);

  const centered = clampAvatarOffset(1000, 500, 200, 1, 0, 0);
  assert.equal(centered.x, 0);
  assert.equal(centered.y, 0);
});

test('avatarCropRect is square and stays in bounds', () => {
  const wide = avatarCropRect(1000, 500, { stageSize: 200, zoom: 1 });
  assert.equal(Number(wide.sw.toFixed(6)), Number(wide.sh.toFixed(6)));
  assert.ok(wide.sx >= 0 && wide.sx + wide.sw <= 1000 + 1e-6);
  assert.ok(wide.sy >= 0 && wide.sy + wide.sh <= 500 + 1e-6);
  assert.equal(wide.sh, 500);

  const zoomed = avatarCropRect(1000, 500, { stageSize: 200, zoom: 2 });
  assert.ok(zoomed.sw < wide.sw);
});

test('avatarCropRect moves opposite to the drag offset', () => {
  const base = avatarCropRect(1000, 500, { stageSize: 200, zoom: 1, offsetX: 0, offsetY: 0 });
  const moved = avatarCropRect(1000, 500, { stageSize: 200, zoom: 1, offsetX: 50, offsetY: 0 });
  assert.ok(moved.sx < base.sx);

  const clamped = avatarCropRect(1000, 500, { stageSize: 200, zoom: 1, offsetX: 9999, offsetY: 9999 });
  assert.ok(clamped.sx >= 0);
  assert.ok(clamped.sy >= 0);
});
