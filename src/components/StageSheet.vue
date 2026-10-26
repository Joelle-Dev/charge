<template>
  <SheetFrame v-model:show="show" title="阶段">
    <template v-if="!stages.length">
      <p class="sheet-intro">创建一个阶段，比如「国庆旅行」或「十一月日常」，之后所有支出都会记进这里。</p>
      <button class="primary-btn btn-block" type="button" @click="sheets.openStageForm()">新建阶段</button>
    </template>

    <template v-else>
      <div class="sheet-list">
        <div
          v-for="stage in activeStages"
          :key="stage.id"
          class="stage-item"
          :class="{ current: stage.id === currentStage?.id }"
        >
          <button class="stage-item-main" type="button" @click="selectStage(stage)">
            <span class="stage-item-name">
              {{ stage.name }}
              <span v-if="stage.id === currentStage?.id" class="current-badge">当前</span>
            </span>
            <span class="stage-item-sub">{{ stageSubtitle(stage) }}</span>
          </button>
          <button class="mini-btn" type="button" :aria-label="`编辑 ${stage.name}`" @click="sheets.openStageForm(stage)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
            </svg>
          </button>
        </div>
      </div>

      <button
        v-if="archivedStages.length"
        class="text-btn stage-archive-toggle"
        type="button"
        @click="showArchived = !showArchived"
      >
        {{ showArchived ? '收起已归档' : `查看已归档（${archivedStages.length}）` }}
      </button>

      <div v-if="showArchived" class="sheet-list stage-archived-list">
        <div v-for="stage in archivedStages" :key="stage.id" class="stage-item">
          <button class="stage-item-main" type="button" @click="restore(stage)">
            <span class="stage-item-name">{{ stage.name }}</span>
            <span class="stage-item-sub">已归档 · 点击恢复</span>
          </button>
          <button class="mini-btn" type="button" :aria-label="`编辑 ${stage.name}`" @click="sheets.openStageForm(stage)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="sheet-footer">
        <button v-if="currentStage" class="secondary-btn" type="button" @click="openSummary">阶段小结</button>
        <button class="primary-btn" type="button" @click="sheets.openStageForm()">新建阶段</button>
      </div>
      <p class="sheet-note">阶段可以归档，归档不会删除任何支出，随时可以恢复。</p>
    </template>
  </SheetFrame>
</template>

<script setup>
import { ref } from 'vue';
import { showToast } from 'vant';
import SheetFrame from './SheetFrame.vue';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { formatMoney } from '../utils/format';
import { haptic } from '../utils/haptics';

const show = defineModel('show', { type: Boolean, default: false });
const showArchived = ref(false);
const sheets = useSheets();
const {
  stages,
  activeStages,
  archivedStages,
  currentStage,
  switchStage,
  restoreStage,
  stageStats
} = useLedger();

function stageSubtitle(stage) {
  const stats = stageStats(stage.id);
  const budget = stage.budget ? ` · 预算 ¥${formatMoney(stage.budget)}` : '';
  return `${stats.count} 笔 · 支出 ¥${formatMoney(stats.total)}${budget}`;
}

async function selectStage(stage) {
  if (stage.id !== currentStage.value?.id) {
    await switchStage(stage.id);
    haptic('light');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`已切换到「${stage.name}」`);
  }
  show.value = false;
}

async function restore(stage) {
  await restoreStage(stage);
  haptic('light');
  showToast(`已恢复「${stage.name}」`);
}

function openSummary() {
  if (!currentStage.value) return;
  const stats = stageStats(currentStage.value.id);
  if (!stats.count) {
    showToast('这个阶段还没有支出');
    return;
  }
  sheets.openSummary(currentStage.value);
}
</script>
