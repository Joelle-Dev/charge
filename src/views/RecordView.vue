<template>
  <div class="record-page">
    <div
      ref="pagerRef"
      class="record-pager"
      :class="{ 'is-locked': curtainOpen || dailyOpen }"
      @touchstart.passive="onPagerTouchStart"
      @touchmove="onPagerTouchMove"
      @touchend.passive="onPagerTouchEnd"
      @touchcancel.passive="onPagerTouchCancel"
    >
      <div ref="trackRef" class="record-pager-track">
        <section class="record-pager-pane" data-pane="home" aria-label="首页">
          <HomeView />
        </section>

        <section
          ref="centerPaneRef"
          class="record-pager-pane record-pager-center"
          data-pane="record"
          aria-label="记账"
        >
          <RecordPane />
        </section>

        <section class="record-pager-pane" data-pane="records" aria-label="历史">
          <HistoryView embedded :active="activePane === 'records'" />
        </section>
      </div>
    </div>

    <RecordCurtain />

    <button
      v-if="activePane === 'record' && !curtainOpen && !dailyOpen"
      class="record-history-fab"
      type="button"
      aria-label="花过的钱"
      title="花过的钱"
      @click="openHistory"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 19V5"></path>
        <path d="M4 19h16"></path>
        <path d="M8 16v-5"></path>
        <path d="M13 16V8"></path>
        <path d="M18 16v-3"></path>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import HomeView from './HomeView.vue';
import HistoryView from './HistoryView.vue';
import RecordPane from '../components/RecordPane.vue';
import RecordCurtain from '../components/RecordCurtain.vue';
import { useLedger } from '../composables/useLedger';
import { useRecordEntry } from '../composables/useRecordEntry';
import { useRecordsView } from '../composables/useRecordsView';
import { useBackClose } from '../composables/useBackClose';
import { LEDGER_PANES, useLedgerPanes } from '../composables/useLedgerPanes';
import {
  isDownwardPull,
  isHorizontalGesture,
  pullProgress,
  shouldOpenCurtain
} from '../utils/pullGesture';
import { haptic } from '../utils/haptics';

const CLICK_SUPPRESS_MS = 360;
const SWIPE_THRESHOLD_RATIO = 0.18;
const SWIPE_VELOCITY = 0.35;
const EDGE_RESISTANCE = 0.3;

const route = useRoute();
const { ready, currentStage } = useLedger();
const { activePane, paneRequest, goToPane } = useLedgerPanes();
const { curtainOpen, curtainPull, curtainDragging, beginCurtainPull, updateCurtainPull, endCurtainPull, resetRecord } = useRecordEntry();
const { dailyOpen, dailyDate } = useRecordsView();

useBackClose(curtainOpen, resetRecord);
useBackClose(dailyOpen, () => {
  dailyOpen.value = false;
  dailyDate.value = '';
});

const pagerRef = ref(null);
const trackRef = ref(null);
const centerPaneRef = ref(null);

let pagerEl = null;
let pagerWidth = 1;
let paneIndex = 0;
let pagerDragDistance = 0;
let pagerTouchId = null;
let pagerStartX = 0;
let pagerStartY = 0;
let pagerStartIndex = 0;
let pagerStartTime = 0;
let pagerTracking = false;
let pagerHorizontal = false;

let touchId = null;
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let touchTracking = false;
let touchPulling = false;

let suppressClick = false;
let suppressTimer = null;
let wheelLocked = false;
let wheelAccum = 0;
let wheelTimer = null;

let activePointerId = null;
let pointerStartX = 0;
let pointerStartY = 0;
let pointerStartTime = 0;
let pointerTracking = false;
let pointerPulling = false;

function clampIndex(index) {
 return Math.max(0, Math.min(LEDGER_PANES.length - 1, index));
}

function measurePager() {
  const width = pagerRef.value?.clientWidth || window.innerWidth || 1;
  pagerWidth = width > 0 ? width : 1;
}

function applyTransform(offset, animate) {
  const track = trackRef.value;
  if (!track) return;
  track.style.transition = animate ? 'transform 0.28s var(--ease-out)' : 'none';
  track.style.transform = `translate3d(${offset}px, 0, 0)`;
}

function setPane(pane, animate = true) {
  const index = LEDGER_PANES.indexOf(pane);
  if (index < 0) return;
  paneIndex = index;
  activePane.value = LEDGER_PANES[index];
  applyTransform(-index * pagerWidth, animate);
}

function onResize() {
  measurePager();
  applyTransform(-paneIndex * pagerWidth, false);
}

function isHorizontalScrollerTarget(target) {
  if (!(target instanceof Element)) return false;
  if (target.closest('.record-pull-handle, .van-popup, .van-overlay, .van-dialog, input, textarea, select')) {
    return true;
  }

  let el = target;
  while (el && el !== pagerEl) {
    const style = window.getComputedStyle(el);
    if (
      (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      el.scrollWidth > el.clientWidth + 1
    ) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

function onPagerTouchStart(event) {
  if (curtainOpen.value || dailyOpen.value) return;
  if (event.touches.length !== 1) {
    if (pagerTracking) onPagerTouchCancel();
    else stopPagerTracking();
    return;
  }
  if (isHorizontalScrollerTarget(event.target)) return;

  const touch = event.touches[0];
  pagerTouchId = touch.identifier;
  pagerStartX = touch.clientX;
  pagerStartY = touch.clientY;
  pagerStartIndex = paneIndex;
  pagerStartTime = performance.now();
  pagerDragDistance = 0;
  pagerTracking = true;
  pagerHorizontal = false;
}

function onPagerTouchMove(event) {
  if (!pagerTracking) return;

  const touch = [...event.touches].find((item) => item.identifier === pagerTouchId);
  if (!touch) return;

  const dx = touch.clientX - pagerStartX;
  const dy = touch.clientY - pagerStartY;

  if (!pagerHorizontal) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (Math.abs(dx) > Math.abs(dy) * 1.15) {
      pagerHorizontal = true;
    } else {
      stopPagerTracking();
      return;
    }
  }

  if (event.cancelable) event.preventDefault();
  pagerDragDistance = dx;

  let offset = dx;
  if ((pagerStartIndex === 0 && dx > 0) || (pagerStartIndex === LEDGER_PANES.length - 1 && dx < 0)) {
    offset = dx * EDGE_RESISTANCE;
  }
  applyTransform(-pagerStartIndex * pagerWidth + offset, false);
}

function onPagerTouchEnd(event) {
  if (!pagerTracking) return;
  if (
    event.changedTouches &&
    ![...event.changedTouches].some((touch) => touch.identifier === pagerTouchId)
  ) {
    return;
  }

  if (!pagerHorizontal) {
    stopPagerTracking();
    return;
  }

  const duration = Math.max(1, performance.now() - pagerStartTime);
  const velocity = pagerDragDistance / duration;
  const threshold = pagerWidth * SWIPE_THRESHOLD_RATIO;

  let target = pagerStartIndex;
  if (pagerDragDistance <= -threshold || velocity <= -SWIPE_VELOCITY) target = pagerStartIndex + 1;
  else if (pagerDragDistance >= threshold || velocity >= SWIPE_VELOCITY) target = pagerStartIndex - 1;
  target = clampIndex(target);

  const changed = target !== paneIndex;
  const swiped = Math.abs(pagerDragDistance) > 8;
  pagerDragDistance = 0;
  stopPagerTracking();
  if (swiped) markClickSuppressed();
  setPane(LEDGER_PANES[target], true);
  if (changed) haptic('light');
}

function onPagerTouchCancel() {
  if (!pagerTracking) return;
  pagerDragDistance = 0;
  stopPagerTracking();
  setPane(LEDGER_PANES[paneIndex], true);
}

function stopPagerTracking() {
  pagerTracking = false;
  pagerHorizontal = false;
  pagerTouchId = null;
}

function onPagerWheel(event) {
  if (curtainOpen.value || dailyOpen.value) return;
  if (event.target?.closest?.('.van-popup, .van-overlay, .van-dialog')) return;
  if (isHorizontalScrollerTarget(event.target)) return;
  if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;

  event.preventDefault();
  if (wheelLocked) {
    scheduleWheelUnlock();
    return;
  }

  wheelAccum += event.deltaX;
  if (Math.abs(wheelAccum) < 24) {
    scheduleWheelUnlock();
    return;
  }

  const direction = wheelAccum > 0 ? 1 : -1;
  const nextIndex = clampIndex(paneIndex + direction);
  wheelAccum = 0;
  wheelLocked = true;
  if (nextIndex !== paneIndex) setPane(LEDGER_PANES[nextIndex], true);
  scheduleWheelUnlock();
}

function scheduleWheelUnlock() {
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => {
    wheelLocked = false;
    wheelAccum = 0;
  }, 240);
}

function centerPaneAtTop() {
  return (centerPaneRef.value?.scrollTop || 0) <= 1;
}

function onRecordPane() {
  return paneIndex === 1;
}

function onPointerDown(event) {
  if (event.pointerType === 'touch') return;
  if (event.button !== 0) return;
  if (route.name !== 'record') return;
  if (!onRecordPane()) return;
  if (pointerTracking || curtainOpen.value || dailyOpen.value) return;
  if (event.target?.closest?.('.record-pull-handle, .van-popup, .van-overlay, .van-dialog, input, textarea, select')) return;

  activePointerId = event.pointerId;
  pointerStartX = event.clientX;
  pointerStartY = event.clientY;
  pointerStartTime = performance.now();
  pointerTracking = true;
  pointerPulling = false;

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
}

function onPointerMove(event) {
  if (!pointerTracking || event.pointerId !== activePointerId) return;

  if (!pointerPulling) {
    if (isHorizontalGesture(pointerStartX, pointerStartY, event.clientX, event.clientY)) {
      stopPointerTracking();
      return;
    }
    if (!isDownwardPull(pointerStartX, pointerStartY, event.clientX, event.clientY)) {
      if (event.clientY - pointerStartY < -12) stopPointerTracking();
      return;
    }

    pointerPulling = true;
    beginCurtainPull();
    haptic('light');
  }

  const progress = pullProgress(pointerStartY, event.clientY, window.innerHeight);
  updateCurtainPull(progress);
  if (event.cancelable) event.preventDefault();
}

function onPointerUp(event) {
  if (!pointerTracking || event.pointerId !== activePointerId) return;

  if (pointerPulling) {
    const duration = Math.max(1, performance.now() - pointerStartTime);
    const velocity = curtainPull.value / duration;
    endCurtainPull(shouldOpenCurtain(curtainPull.value, velocity));
    markClickSuppressed();
    haptic('light');
  }

  stopPointerTracking();
}

function onPointerCancel(event) {
  if (!pointerTracking || event.pointerId !== activePointerId) return;
  if (pointerPulling) endCurtainPull(false);
  stopPointerTracking();
}

function stopPointerTracking() {
  pointerTracking = false;
  pointerPulling = false;
  activePointerId = null;
  removePointerListeners();
}

function removePointerListeners() {
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
  if (!onRecordPane()) return;
  if (curtainOpen.value || dailyOpen.value || touchTracking) return;
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

onMounted(() => {
  window.scrollTo({ top: 0 });
  measurePager();
  paneIndex = Math.max(0, LEDGER_PANES.indexOf(activePane.value));
  applyTransform(-paneIndex * pagerWidth, false);

  pagerEl = pagerRef.value;
  pagerEl?.addEventListener('wheel', onPagerWheel, { passive: false });
  window.addEventListener('resize', onResize);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('click', onClickCapture, true);
  document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
  document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
  document.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
  document.addEventListener('touchcancel', onTouchCancel, { capture: true, passive: true });
});

watch(
  [ready, currentStage],
  ([isReady, stage]) => {
    if (!isReady || stage) return;
    activePane.value = 'home';
    setPane('home', true);
  },
  { immediate: true }
);

onUnmounted(() => {
  pagerEl?.removeEventListener('wheel', onPagerWheel);
  pagerEl = null;
  window.removeEventListener('resize', onResize);
  document.removeEventListener('pointerdown', onPointerDown, true);
  document.removeEventListener('click', onClickCapture, true);
  document.removeEventListener('touchstart', onTouchStart, { capture: true });
  document.removeEventListener('touchmove', onTouchMove, { capture: true });
  document.removeEventListener('touchend', onTouchEnd, { capture: true });
  document.removeEventListener('touchcancel', onTouchCancel, { capture: true });
  removePointerListeners();
  clearTimeout(suppressTimer);
  clearTimeout(wheelTimer);
  resetRecord();
});

watch(paneRequest, () => {
  setPane(activePane.value, true);
});

function openHistory() {
  haptic('light');
  goToPane('records');
}
</script>
