<template>
  <nav class="actionbar" aria-label="果冻的记账小屋">
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
      <span>记一笔</span>
    </button>

    <button
      class="action-secondary"
      :class="{ active: isBatch }"
      type="button"
      :aria-current="isBatch ? 'page' : undefined"
      aria-label="一次记多笔"
      @click="openBatch"
    >
      <span class="action-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 6h16"></path>
          <path d="M4 12h16"></path>
          <path d="M4 18h10"></path>
        </svg>
      </span>
      <span>批量记</span>
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

const { currentStage } = useLedger();
const panes = useLedgerPanes();
const sheets = useSheets();
const route = useRoute();
const router = useRouter();

const isRecord = computed(() => (
  route.path === '/' || route.path === '/records' || route.path === '/history' || route.path === '/year'
));
const isBatch = computed(() => route.path === '/batch');
const isSettings = computed(() => route.path === '/settings');

function openRecordTab() {
  panes.goToPane('record');
  if (route.path !== '/') router.push('/');
}

function openBatch() {
  if (!currentStage.value) {
    sheets.openStageForm();
    return;
  }
  if (route.path !== '/batch') router.push('/batch');
}

function openSettings() {
  if (route.path !== '/settings') router.push('/settings');
}
</script>
