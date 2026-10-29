import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PULL_OPEN_THRESHOLD,
  clampPull,
  curtainVisibleHeight,
  isDownwardPull,
  isHorizontalGesture,
  pullProgress,
  shouldOpenCurtain
} from '../src/utils/pullGesture.js';

test('pull progress grows with downward distance and caps at one', () => {
  assert.equal(pullProgress(100, 90, 800), 0);
  assert.equal(pullProgress(100, 100, 800), 0);
  assert.ok(Math.abs(pullProgress(100, 320, 800) - 0.55) < 1e-9);
  assert.equal(pullProgress(100, 900, 800), 1);
});

test('pull progress handles invalid heights', () => {
  assert.equal(pullProgress(0, 100, 0), 0);
  assert.equal(pullProgress(0, 100, Number.NaN), 0);
});

test('downward pull beats horizontal movement', () => {
  assert.equal(isDownwardPull(100, 100, 102, 120), true);
  assert.equal(isDownwardPull(100, 100, 150, 120), false);
  assert.equal(isDownwardPull(100, 100, 100, 95), false);
  assert.equal(isHorizontalGesture(100, 100, 160, 110), true);
  assert.equal(isHorizontalGesture(100, 100, 120, 160), false);
});

test('open decision uses distance and velocity', () => {
  assert.equal(shouldOpenCurtain(PULL_OPEN_THRESHOLD, 0), true);
  assert.equal(shouldOpenCurtain(PULL_OPEN_THRESHOLD - 0.01, 0), false);
  assert.equal(shouldOpenCurtain(0.1, 0.8), true);
  assert.equal(shouldOpenCurtain(0.8, -0.8), false);
  assert.equal(shouldOpenCurtain(0.5, 0, true), false);
  assert.equal(shouldOpenCurtain(0.7, 0, true), true);
});

test('clamp and visible height stay in range', () => {
  assert.equal(clampPull(-1), 0);
  assert.equal(clampPull(2), 1);
  assert.equal(curtainVisibleHeight(0.25, 800), 200);
  assert.equal(curtainVisibleHeight(2, 800), 800);
});
