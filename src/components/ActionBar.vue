<template>
  <nav class="actionbar" aria-label="记账与导航">
    <button class="action-secondary" :class="{ active: isHome }" type="button" @click="goHome">
      <span class="action-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m3 10 9-7 9 7"></path>
          <path d="M5 9v11h14V9"></path>
          <path d="M9 20v-6h6v6"></path>
        </svg>
      </span>
      <span>首页</span>
    </button>

    <button class="action-secondary" :class="{ active: isRecords }" type="button" @click="openRecords">
      <span class="action-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="3"></rect>
          <path d="M8 2v4M16 2v4M3 9h18"></path>
          <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"></path>
        </svg>
      </span>
      <span>明细</span>
    </button>

    <button
      class="mic-slot"
      type="button"
      aria-label="说一笔"
      @pointerdown="onMicPointerDown"
      @pointermove="onMicPointerMove"
      @pointerup="onMicPointerUp"
      @pointercancel="onMicPointerCancel"
      @click="onMicClick"
      @contextmenu.prevent
    >
      <span class="mic-main">
        <span class="mic-main-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <rect x="9" y="2.5" width="6" height="11" rx="3"></rect>
            <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"></path>
            <path d="M12 18v3"></path>
          </svg>
        </span>
      </span>
      <span class="mic-caption">说一笔</span>
    </button>

    <button class="action-secondary" type="button" @click="openManual">
      <span class="action-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
        </svg>
      </span>
      <span>手动</span>
    </button>

    <button class="action-secondary" type="button" @click="sheets.openSettings()">
      <span class="action-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.12.62.66 1.05 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"></path>
        </svg>
      </span>
      <span>设置</span>
    </button>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { haptic } from '../utils/haptics';

const { currentStage } = useLedger();
const sheets = useSheets();
const route = useRoute();
const router = useRouter();

const isHome = computed(() => route.path === '/');
const isRecords = computed(() => route.path === '/records');

const LONG_PRESS_MS = 320;
let pressTimer = null;
let pressStart = null;
let longPress = false;

function requireStage() {
  if (currentStage.value) return true;
  sheets.openStageForm();
  return false;
}

function goHome() {
  if (route.path !== '/') router.push('/');
}

function openRecords() {
  if (!requireStage()) return;
  if (route.path !== '/records') router.push('/records');
}

function onMicPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  clearTimeout(pressTimer);
  longPress = false;
  pressStart = { x: event.clientX, y: event.clientY };
  try {
    event.currentTarget.setPointerCapture?.(event.pointerId);
  } catch (err) {
    // Synthetic events or older browsers may not support pointer capture.
  }
  pressTimer = setTimeout(() => {
    longPress = true;
    pressStart = null;
    haptic('medium');
    if (requireStage()) sheets.openVoice(true);
  }, LONG_PRESS_MS);
}

function onMicPointerMove(event) {
  if (!pressStart) return;
  if (Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > 12) {
    clearTimeout(pressTimer);
    pressStart = null;
  }
}

function onMicPointerUp() {
  clearTimeout(pressTimer);
  pressStart = null;
  if (longPress) {
    setTimeout(() => {
      sheets.requestVoiceStop();
    }, 80);
    setTimeout(() => {
      longPress = false;
    }, 0);
  }
}

function onMicPointerCancel() {
  clearTimeout(pressTimer);
  pressStart = null;
  longPress = false;
}

function onMicClick(event) {
  if (longPress) {
    event.preventDefault();
    return;
  }
  if (requireStage()) sheets.openVoice(false);
}

function openManual() {
  if (requireStage()) sheets.openExpenseForm();
}
</script>
