<template>
  <nav class="actionbar" aria-label="记账操作">
    <button class="action-secondary" type="button" @click="openManual">
      <span class="action-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
        </svg>
      </span>
      <span>手动</span>
    </button>

    <button class="mic-main" type="button" @click="openVoice">
      <span class="mic-main-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <rect x="9" y="2.5" width="6" height="11" rx="3"></rect>
          <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"></path>
          <path d="M12 18v3"></path>
        </svg>
      </span>
      <span class="mic-main-label">说一笔</span>
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
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';

const { currentStage } = useLedger();
const sheets = useSheets();

function openVoice() {
  if (!currentStage.value) {
    sheets.openStageForm();
    return;
  }
  sheets.openVoice();
}

function openManual() {
  if (!currentStage.value) {
    sheets.openStageForm();
    return;
  }
  sheets.openExpenseForm();
}
</script>
