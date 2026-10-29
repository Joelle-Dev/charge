<template>
  <div class="number-keypad" role="group" aria-label="金额键盘">
    <button
      v-for="digit in ['1', '2', '3']"
      :key="digit"
      class="keypad-key keypad-digit"
      type="button"
      :aria-label="digit"
      @click="press(digit)"
    >
      {{ digit }}
    </button>
    <button
      class="keypad-key keypad-backspace"
      type="button"
      aria-label="退格，长按清空"
      @pointerdown="onBackspaceDown"
      @pointerup="clearBackspaceTimer"
      @pointerleave="clearBackspaceTimer"
      @pointercancel="clearBackspaceTimer"
      @click="onBackspaceClick"
    >
      <svg viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M10 5h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10L3 12l7-7Z"></path>
        <path d="m13 9 6 6M19 9l-6 6"></path>
      </svg>
    </button>

    <button
      v-for="digit in ['4', '5', '6']"
      :key="digit"
      class="keypad-key keypad-digit"
      type="button"
      :aria-label="digit"
      @click="press(digit)"
    >
      {{ digit }}
    </button>
    <button
      class="keypad-key keypad-date"
      type="button"
      :aria-label="`日期：${dateLabel}`"
      @click="$emit('date')"
    >
      {{ dateLabel }}
    </button>

    <button
      v-for="digit in ['7', '8', '9']"
      :key="digit"
      class="keypad-key keypad-digit"
      type="button"
      :aria-label="digit"
      @click="press(digit)"
    >
      {{ digit }}
    </button>
    <button
      class="keypad-key keypad-done"
      type="button"
      :disabled="disabled"
      @click="$emit('done')"
    >
      完成
    </button>

    <button class="keypad-key keypad-digit keypad-soft" type="button" aria-label="两个零" @click="press('00')">
      00
    </button>
    <button class="keypad-key keypad-digit" type="button" aria-label="零" @click="press('0')">
      0
    </button>
    <button class="keypad-key keypad-digit" type="button" aria-label="小数点" @click="press('.')">
      .
    </button>
  </div>
</template>

<script setup>
import { haptic } from '../utils/haptics';

defineProps({
  dateLabel: { type: String, default: '今天' },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['digit', 'decimal', 'double-zero', 'backspace', 'clear', 'date', 'done']);

let backspaceTimer = null;
let longPressed = false;

function press(key) {
  haptic('light');
  if (key === '.') {
    emit('decimal');
    return;
  }
  if (key === '00') {
    emit('double-zero');
    return;
  }
  emit('digit', key);
}

function onBackspaceDown() {
  clearBackspaceTimer();
  longPressed = false;
  backspaceTimer = setTimeout(() => {
    longPressed = true;
    haptic('medium');
    emit('clear');
  }, 520);
}

function clearBackspaceTimer() {
  clearTimeout(backspaceTimer);
  backspaceTimer = null;
}

function onBackspaceClick() {
  clearBackspaceTimer();
  if (longPressed) {
    longPressed = false;
    return;
  }
  haptic('light');
  emit('backspace');
}
</script>
