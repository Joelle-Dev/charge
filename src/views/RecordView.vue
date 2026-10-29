<template>
  <div class="record-page">
    <div
      ref="pagerRef"
      class="record-pager"
      :class="{ 'is-locked': curtainOpen }"
      @scroll.passive="onPagerScroll"
    >
      <section class="record-pager-pane" data-pane="home" aria-label="首页">
        <HomeView />
      </section>

      <section
        ref="centerPaneRef"
        class="record-pager-pane record-pager-center"
        data-pane="record"
        aria-label="记账"
        @scroll.passive="onCenterScroll"
      >
        <RecordPane />
      </section>

      <section class="record-pager-pane" data-pane="records" aria-label="明细">
        <ExpenseRecords />
      </section>
    </div>

    <RecordPullHandle
      v-show="activePane === 'record'"
      :scroll-top="centerScrollTop"
    />
    <RecordCurtain />
  </div>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import HomeView from './HomeView.vue';
import ExpenseRecords from '../components/ExpenseRecords.vue';
import RecordPane from '../components/RecordPane.vue';
import RecordPullHandle from '../components/RecordPullHandle.vue';
import RecordCurtain from '../components/RecordCurtain.vue';
import { useRecordEntry } from '../composables/useRecordEntry';
import { LEDGER_PANES, useLedgerPanes } from '../composables/useLedgerPanes';
import {
  isDownwardPull,
  isHorizontalGesture,
  pullProgress,
  shouldOpenCurtain
} from '../utils/pullGesture';
import { haptic } from '../utils/haptics';

const CLICK_SUPPRESS_MS = 360;

const route = useRoute();
const { activePane, paneRequest } = useLedgerPanes();
const { curtainOpen, curtainPull, curtainDragging, beginCurtainPull, updateCurtainPull, endCurtainPull, resetRecord } = useRecordEntry();

const pagerRef = ref(null);
const centerPaneRef = ref(null);
const centerScrollTop = ref(0);

let activePointerId = null;
let startX = 0;
let startY = 0;
let startTime = 0;
let tracking = false;
let pulling = false;
let touchId = null;
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let touchTracking = false;
let touchPulling = false;
let suppressClick = false;
let suppressTimer = null;
let scrollFrame = 0;

onMounted(() => {
  window.scrollTo({ top: 0 });
  activePane.value = 'record';
  nextTick(() => scrollToPane('record', 'auto'));
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('click', onClickCapture, true);
  document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
  document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
  document.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
  document.addEventListener('touchcancel', onTouchCancel, { capture: true, passive: true });
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown, true);
  document.removeEventListener('click', onClickCapture, true);
  document.removeEventListener('touchstart', onTouchStart, { capture: true });
  document.removeEventListener('touchmove', onTouchMove, { capture: true });
  document.removeEventListener('touchend', onTouchEnd, { capture: true });
  document.removeEventListener('touchcancel', onTouchCancel, { capture: true });
  removeMoveListeners();
  clearTimeout(suppressTimer);
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  resetRecord();
});

watch(paneRequest, () => {
  scrollToPane(activePane.value);
});

function scrollToPane(pane, behavior = 'smooth') {
  const el = pagerRef.value;
  if (!el) return;
  const index = LEDGER_PANES.indexOf(pane);
  if (index < 0) return;
  const width = el.clientWidth || window.innerWidth;
  el.scrollTo({ left: width * index, behavior });
}

function onPagerScroll() {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    const el = pagerRef.value;
    if (!el) return;
    const width = el.clientWidth || 1;
    const index = Math.round(el.scrollLeft / width);
    const pane = LEDGER_PANES[index] || 'record';
    if (activePane.value !== pane) activePane.value = pane;
  });
}

function onCenterScroll() {
  centerScrollTop.value = centerPaneRef.value?.scrollTop || 0;
}

function centerPaneAtTop() {
  return (centerPaneRef.value?.scrollTop || 0) <= 1;
}

function onPointerDown(event) {
  if (event.pointerType === 'touch') return;
  if (event.button !== 0) return;
  if (route.name !== 'record') return;
  if (activePane.value !== 'record') return;
  if (tracking || curtainOpen.value) return;
  if (event.target?.closest?.('.record-pull-handle, .van-popup, .van-overlay, .van-dialog')) return;

  activePointerId = event.pointerId;
  startX = event.clientX;
  startY = event.clientY;
  startTime = performance.now();
  tracking = true;
  pulling = false;

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
}

function onPointerMove(event) {
  if (!tracking || event.pointerId !== activePointerId) return;

  if (!pulling) {
    if (isHorizontalGesture(startX, startY, event.clientX, event.clientY)) {
      stopTracking();
      return;
    }
    if (!isDownwardPull(startX, startY, event.clientX, event.clientY)) {
      if (event.clientY - startY < -12) stopTracking();
      return;
    }

    pulling = true;
    beginCurtainPull();
    haptic('light');
  }

  const progress = pullProgress(startY, event.clientY, window.innerHeight);
  updateCurtainPull(progress);
  if (event.cancelable) event.preventDefault();
}

function onPointerUp(event) {
  if (!tracking || event.pointerId !== activePointerId) return;

  if (pulling) {
    const duration = Math.max(1, performance.now() - startTime);
    const velocity = curtainPull.value / duration;
    endCurtainPull(shouldOpenCurtain(curtainPull.value, velocity));
    markClickSuppressed();
    haptic('light');
  }

  stopTracking();
}

function onPointerCancel(event) {
  if (!tracking || event.pointerId !== activePointerId) return;
  if (pulling) endCurtainPull(false);
  stopTracking();
}

function stopTracking() {
  tracking = false;
  pulling = false;
  activePointerId = null;
  removeMoveListeners();
}

function removeMoveListeners() {
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerCancel);
}

function onTouchStart(event) {
  if (event.touches.length !== 1) {
    stopTouchTracking();
    return;
  }
  if (route.name !== 'record') return;
  if (activePane.value !== 'record') return;
  if (curtainOpen.value || touchTracking) return;
  if (!centerPaneAtTop()) return;
  if (event.target?.closest?.('.record-pull-handle, .van-popup, .van-overlay, .van-dialog')) return;

  const touch = event.touches[0];
  touchId = touch.identifier;
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchStartTime = performance.now();
  touchTracking = true;
  touchPulling = false;
}

function onTouchMove(event) {
  if (!touchTracking) return;

  const touch = [...event.touches].find((item) => item.identifier === touchId);
  if (!touch) return;

  if (!touchPulling) {
    if (isHorizontalGesture(touchStartX, touchStartY, touch.clientX, touch.clientY)) {
      stopTouchTracking();
      return;
    }
    if (!isDownwardPull(touchStartX, touchStartY, touch.clientX, touch.clientY)) {
      if (touch.clientY - touchStartY < -12) stopTouchTracking();
      return;
    }

    touchPulling = true;
    beginCurtainPull();
    haptic('light');
  }

  const progress = pullProgress(touchStartY, touch.clientY, window.innerHeight);
  updateCurtainPull(progress);
  if (event.cancelable) event.preventDefault();
}

function onTouchEnd(event) {
  if (!touchTracking) return;
  if (![...event.changedTouches].some((touch) => touch.identifier === touchId)) return;

  if (touchPulling) {
    const duration = Math.max(1, performance.now() - touchStartTime);
    const velocity = curtainPull.value / duration;
    endCurtainPull(shouldOpenCurtain(curtainPull.value, velocity));
    markClickSuppressed();
    haptic('light');
  }

  stopTouchTracking();
}

function onTouchCancel() {
  if (!touchTracking) return;
  if (touchPulling) endCurtainPull(false);
  stopTouchTracking();
}

function stopTouchTracking() {
  touchTracking = false;
  touchPulling = false;
  touchId = null;
}

function markClickSuppressed() {
  suppressClick = true;
  clearTimeout(suppressTimer);
  suppressTimer = setTimeout(() => {
    suppressClick = false;
  }, CLICK_SUPPRESS_MS);
}

function onClickCapture(event) {
  if (!suppressClick) return;
  suppressClick = false;
  clearTimeout(suppressTimer);
  event.preventDefault();
  event.stopPropagation();
}
</script>
