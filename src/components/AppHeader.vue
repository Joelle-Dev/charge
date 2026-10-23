<template>
  <header class="topbar">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">
        <img class="brand-image" :src="brandIcon" alt="">
      </span>
      <span class="brand-name">守财小果</span>
    </div>

    <button class="stage-pill" type="button" aria-label="切换阶段" @click="sheets.openStages()">
      <span class="stage-dot" :style="{ background: currentStage ? '#d8847c' : '#b9aca0' }"></span>
      <span class="stage-pill-name">{{ currentStage ? currentStage.name : '选择阶段' }}</span>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6"></path>
      </svg>
    </button>
  </header>
</template>

<script setup>
import brandIcon from '../assets/brand-icon.png';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';

const { currentStage } = useLedger();
const sheets = useSheets();
</script>
