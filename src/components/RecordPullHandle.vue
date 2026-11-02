<template>
  <button
    class="record-pull-handle"
    :class="{
      'is-open': curtainOpen,
      'is-dragging': curtainDragging,
      'is-arrow-up': arrowUp
    }"
    type="button"
    :aria-expanded="curtainOpen"
    :aria-label="curtainOpen ? '收起记账面板' : '展开记账面板'"
    @pointerdown="onPointerDown"
    @click="onClick"
  >
    <svg class="record-pull-ring" viewBox="0 0 44 44" aria-hidden="true">
      <circle class="record-pull-ring-track" cx="22" cy="22" r="19"></circle>
      <circle
        class="record-pull-ring-fill"
        cx="22"
        cy="22"
        r="19"
        :stroke-dasharray="ringLength"
        :style="{ strokeDashoffset: ringOffset }"
      ></circle>
    </svg>
    <svg
      class="record-pull-arrow"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6"></path>
    </svg>
  </button>
</template>

<script setup>
import { computed, onUnmounted } from 'vue';
import { useRecordEntry } from '../composables/useRecordEntry';
import { shouldOpenCurtain } from '../utils/pullGesture';
import { haptic } from '../utils/haptics';

const CLICK_SUPPRESS_MS = 360;

const {
  curtainOpen,
  curtainPull,
  curtainDragging,
  beginCurtainPull,
  updateCurtainPull,
  endCurtainPull,
  toggleCurtain
} = useRecordEntry();

let startY = 0;
let startProgress = 0;
let startTime = 0;
let activePointerId = null;
let pulling = false;
let suppressClick = false;
let suppressTimer = null;

const progress = computed(() => {
  if (curtainDragging.value) return curtainPull.value;
  return curtainOpen.value ? 1 : 0;
});

const RING_RADIUS = 19;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const ringLength = RING_CIRCUMFERENCE;
const ringOffset = computed(() => String(RING_CIRCUMFERENCE * (1 - progress.value)));

const arrowUp = computed(() => curtainOpen.value || progress.value > 0.5);

onUnmounted(() => {
  removeDragListeners();
  clearTimeout(suppressTimer);
});

function onPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  removeDragListeners();

  startY = event.clientY;
  startProgress = curtainOpen.value ? 1 : 0;
  startTime = performance.now();
  activePointerId = event.pointerId;
  pulling = false;

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

function onPointerMove(event) {
  if (event.pointerId !== activePointerId) return;
  const delta = event.clientY - startY;

  if (!pulling && Math.abs(delta) > 6) {
    pulling = true;
    beginCurtainPull();
  }
  if (!pulling) return;

  const next = startProgress + delta / (window.innerHeight * 0.55);
  updateCurtainPull(next);
  if (event.cancelable) event.preventDefault();
}

function onPointerUp(event) {
  if (event.pointerId !== activePointerId) return;

  if (pulling) {
    const duration = Math.max(1, performance.now() - startTime);
    const velocity = (curtainPull.value - startProgress) / duration;
    endCurtainPull(shouldOpenCurtain(curtainPull.value, velocity, startProgress === 1));
    markClickSuppressed();
    haptic('light');
  }

  removeDragListeners();
  pulling = false;
  activePointerId = null;
}

function onClick() {
  if (suppressClick) {
    suppressClick = false;
    clearTimeout(suppressTimer);
    return;
  }
  toggleCurtain();
  haptic('light');
}

function markClickSuppressed() {
  suppressClick = true;
  clearTimeout(suppressTimer);
  suppressTimer = setTimeout(() => {
    suppressClick = false;
  }, CLICK_SUPPRESS_MS);
}

function removeDragListeners() {
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
}
</script>
