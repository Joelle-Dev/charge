<template>
  <nav class="actionbar" aria-label="记账与导航">
    <button
      class="action-secondary"
      :class="{ active: isRecord }"
      type="button"
      :aria-current="isRecord ? 'page' : undefined"
      @click="openRecordTab"
    >
      <span class="action-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
        </svg>
      </span>
      <span>记账</span>
    </button>

    <button
      class="action-secondary voice-tab"
      type="button"
      aria-label="说一笔"
      @pointerdown="onMicPointerDown"
      @pointermove="onMicPointerMove"
      @pointerup="onMicPointerUp"
      @pointercancel="onMicPointerCancel"
      @click="onMicClick"
      @contextmenu.prevent
    >
      <span class="action-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <rect x="9" y="2.5" width="6" height="11" rx="3"></rect>
          <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"></path>
          <path d="M12 18v3"></path>
        </svg>
      </span>
      <span>说一笔</span>
    </button>

    <button
      class="action-secondary"
      :class="{ active: isSettings }"
      type="button"
      :aria-current="isSettings ? 'page' : undefined"
      @click="openSettings"
    >
      <span class="action-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
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
import { useLedgerPanes } from '../composables/useLedgerPanes';
import { useSheets } from '../composables/useSheets';
import { useVoiceEntry } from '../composables/useVoiceEntry';
import { haptic } from '../utils/haptics';

const { currentStage } = useLedger();
const panes = useLedgerPanes();
const sheets = useSheets();
const voice = useVoiceEntry();
const route = useRoute();
const router = useRouter();

const isRecord = computed(() => (
  route.path === '/' || route.path === '/records' || route.path === '/history' || route.path === '/year'
));
const isSettings = computed(() => route.path === '/settings');

const LONG_PRESS_MS = 320;
let pressTimer = null;
let pressStart = null;
let longPress = false;

function requireStage() {
  if (currentStage.value) return true;
  sheets.openStageForm();
  return false;
}

function openRecordTab() {
  panes.goToPane('record');
  if (route.path !== '/') router.push('/');
}

function openSettings() {
  if (route.path !== '/settings') router.push('/settings');
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
    if (requireStage()) voice.openVoice(true);
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
      voice.requestVoiceStop();
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
  if (requireStage()) voice.openVoice(false);
}
</script>
