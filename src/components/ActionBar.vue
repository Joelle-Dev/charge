<template>
  <nav class="actionbar" aria-label="果冻的记账小屋">
    <button
      class="action-secondary"
      :class="{ active: isLedger }"
      type="button"
      :aria-current="isLedger ? 'page' : undefined"
      aria-label="账本"
      @click="openLedgerTab"
    >
      <span class="action-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H7v18H5.5A1.5 1.5 0 0 1 4 19.5v-15Z"></path>
          <path d="M7 3h3v18H7z"></path>
          <path d="m13 3.7 2.6-.7 4 15.4-2.6.7z"></path>
        </svg>
      </span>
      <span>账本</span>
    </button>

    <button
      class="action-secondary"
      :class="{ active: isChart }"
      type="button"
      :aria-current="isChart ? 'page' : undefined"
      aria-label="看账"
      @click="openChartTab"
    >
      <span class="action-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 19V5"></path>
          <path d="M4 19h16"></path>
          <path d="m8 14 4-4 3 3 5-6"></path>
        </svg>
      </span>
      <span>看账</span>
    </button>

    <button
      class="action-primary"
      :class="{ active: isRecord }"
      type="button"
      :aria-current="isRecord ? 'page' : undefined"
      aria-label="记账"
      @click="openRecordTab"
    >
      <span class="action-primary-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
          <path d="M12 5v14"></path>
          <path d="M5 12h14"></path>
        </svg>
      </span>
      <span class="action-primary-label">记账</span>
    </button>

    <button
      class="action-secondary"
      :class="{ active: isDiary }"
      type="button"
      :aria-current="isDiary ? 'page' : undefined"
      aria-label="小票"
      @click="openDiaryTab"
    >
      <span class="action-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 2.5h12v19l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z"></path>
          <path d="M9 7h6"></path>
          <path d="M9 10.5h6"></path>
          <path d="M9 14h4"></path>
        </svg>
      </span>
      <span>小票</span>
    </button>

    <button
      class="action-secondary"
      :class="{ active: isSettings }"
      type="button"
      :aria-current="isSettings ? 'page' : undefined"
      aria-label="我的"
      @click="openSettings"
    >
      <span class="action-icon action-avatar">
        <ProfileAvatar :avatar="profile.avatar" :name="profile.name" :size="24" />
      </span>
      <span>我的</span>
    </button>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ProfileAvatar from './ProfileAvatar.vue';
import { useLedger } from '../composables/useLedger';
import { useLedgerPanes } from '../composables/useLedgerPanes';
import { useProfile } from '../composables/useProfile';
import { useSheets } from '../composables/useSheets';

const { currentStage } = useLedger();
const { profile } = useProfile();
const panes = useLedgerPanes();
const sheets = useSheets();
const route = useRoute();
const router = useRouter();

const isLedger = computed(() => (
  route.path === '/' && panes.activePane.value === 'home'
));
const isRecord = computed(() => (
  route.path === '/' && panes.activePane.value !== 'home'
));
const isChart = computed(() => route.path === '/chart');
const isDiary = computed(() => route.path === '/diary');
const isSettings = computed(() => route.path === '/settings');

function openLedgerTab() {
  panes.goToPane('home');
  if (route.path !== '/') router.push('/');
}

function openRecordTab() {
  if (!currentStage.value) {
    panes.goToPane('record');
    if (route.path !== '/') router.push('/');
    sheets.openStageForm();
    return;
  }
  panes.goToPane('record');
  if (route.path !== '/') router.push('/');
}

function openChartTab() {
  if (route.path !== '/chart') router.push('/chart');
}

function openDiaryTab() {
  if (route.path !== '/diary') router.push('/diary');
}

function openSettings() {
  if (route.path !== '/settings') router.push('/settings');
}
</script>
