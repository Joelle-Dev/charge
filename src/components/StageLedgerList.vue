<template>
  <section class="bookshelf" :class="{ 'is-merging': mergeMode }" aria-label="账本">
    <div class="bookshelf-head">
      <span class="bookshelf-label">{{ mergeMode ? '选择要合并的账本' : '账本' }}</span>
      <div v-if="mergeMode" class="bookshelf-actions">
        <button class="text-btn" type="button" @click="selectAllMergeStages">全选</button>
        <button class="text-btn" type="button" @click="clearMergeStages">清空</button>
      </div>
    </div>

    <div class="book-grid">
      <button
        v-for="stage in orderedStages"
        :key="stage.id"
        class="book"
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
        <span class="book-title">{{ stage.name }}</span>
        <span class="book-foot">
          <span class="book-amount">¥{{ displayMoney(stageStats(stage.id).total) }}</span>
          <span class="book-count">{{ stageStats(stage.id).count }} 笔</span>
        </span>
        <span v-if="stage.id === currentStage?.id" class="book-mark" aria-hidden="true">现在</span>
        <span v-if="mergeMode" class="book-check" aria-hidden="true">
          <svg v-if="isMergingStage(stage.id)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="m5 12 4.5 4.5L19 7"></path>
          </svg>
        </span>
      </button>

      <button v-if="!mergeMode" class="book book-create" type="button" aria-label="新建账本" @click="sheets.openStageForm()">
        <span class="book-create-plus" aria-hidden="true">＋</span>
      </button>
    </div>

    <p v-if="!mergeMode && activeStages.length === 1" class="ledger-single-hint">再建一个账本就能合并</p>

    <div v-if="mergeMode" class="ledger-merge-bar">
      <span class="ledger-merge-summary">
        已选 <b>{{ mergedStages.length }}</b> 个 · 共 ¥{{ displayMoney(mergedTotals.total) }}
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
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { showToast } from 'vant';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { displayMoney } from '../utils/money';
import { stageColor } from '../utils/format';
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
