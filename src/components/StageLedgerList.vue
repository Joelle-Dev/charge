<template>
  <section class="ledger-stages" aria-label="阶段账本">
    <div v-if="mergeMode" class="ledger-select-bar">
      <span class="ledger-select-label">选择要合并的账本</span>
      <span class="ledger-select-actions">
        <button class="text-btn" type="button" @click="selectAllMergeStages">全选</button>
        <button class="text-btn" type="button" @click="clearMergeStages">清空</button>
      </span>
    </div>

    <div class="ledger-list">
      <button
        v-for="stage in orderedStages"
        :key="stage.id"
        class="ledger-card"
        :class="{
          current: stage.id === currentStage?.id,
          selected: mergeMode && isMergingStage(stage.id)
        }"
        :style="{ '--book-color': stageColor(stage) }"
        type="button"
        :role="mergeMode ? 'checkbox' : undefined"
        :aria-checked="mergeMode ? isMergingStage(stage.id) : undefined"
        :aria-label="mergeMode
          ? `${isMergingStage(stage.id) ? '取消选择' : '选择'} ${stage.name}`
          : `切换到 ${stage.name}`"
        @click="selectStage(stage)"
      >
        <span v-if="mergeMode" class="ledger-check" aria-hidden="true">
          <svg v-if="isMergingStage(stage.id)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="m5 12 4.5 4.5L19 7"></path>
          </svg>
        </span>
        <span v-else class="ledger-emblem" aria-hidden="true">{{ stage.name.slice(0, 1) }}</span>

        <span class="ledger-card-body">
          <span class="ledger-card-name">
            {{ stage.name }}
            <span v-if="stage.id === currentStage?.id" class="current-badge">现在</span>
          </span>
          <span class="ledger-card-meta">{{ stageMeta(stage) }}</span>
        </span>

        <span class="ledger-card-total">¥{{ formatMoney(stageStats(stage.id).total) }}</span>
        <span v-if="!mergeMode" class="ledger-card-arrow" aria-hidden="true">›</span>
      </button>
    </div>

    <div v-if="mergeMode" class="ledger-merge-bar">
      <span class="ledger-merge-summary">
        已选 <b>{{ mergedStages.length }}</b> 个 · 共 ¥{{ formatMoney(mergedTotals.total) }}
      </span>
      <button
        class="primary-btn ledger-merge-btn"
        type="button"
        :disabled="mergedStages.length < 2"
        @click="sheets.openMerge()"
      >
        {{ mergedStages.length < 2 ? '再选一个账本' : '选择目标账本' }}
      </button>
    </div>

    <template v-else>
      <p v-if="activeStages.length === 1" class="ledger-single-hint">再建一个账本就能合并</p>
      <button class="ledger-create" type="button" @click="sheets.openStageForm()">
        <span class="ledger-create-plus" aria-hidden="true">＋</span>
        <span class="ledger-create-text">新建阶段账本</span>
        <span class="ledger-create-arrow" aria-hidden="true">›</span>
      </button>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { showToast } from 'vant';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { formatMoney, stageColor } from '../utils/format';
import { haptic } from '../utils/haptics';

const sheets = useSheets();
const {
  activeStages,
  currentStage,
  mergeMode,
  mergedStages,
  mergedTotals,
  isMergingStage,
  switchStage,
  toggleMergeStage,
  selectAllMergeStages,
  clearMergeStages,
  stageStats
} = useLedger();

const orderedStages = computed(() => {
  const currentId = currentStage.value?.id;
  return [...activeStages.value].sort((a, b) => {
    if (a.id === currentId) return -1;
    if (b.id === currentId) return 1;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
});

function stageMeta(stage) {
  const stats = stageStats(stage.id);
  const budget = Number(stage.budget) || 0;
  const date = stats.maxDate || stats.minDate;
  const base = date && stats.count
    ? `最近 ${shortDate(date)} · ${stats.count} 笔`
    : '还没记过账';
  return budget > 0 ? `${base} · 预算 ¥${formatMoney(budget)}` : base;
}

function shortDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  const prefix = year === new Date().getFullYear() ? '' : `${year}/`;
  return `${prefix}${month}/${day}`;
}

async function selectStage(stage) {
  if (mergeMode.value) {
    toggleMergeStage(stage.id);
    haptic('light');
    return;
  }

  if (stage.id !== currentStage.value?.id) {
    await switchStage(stage.id);
    haptic('light');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`已经换到「${stage.name}」啦`);
  }
}
</script>
