<template>
  <section class="bookshelf" :class="{ 'is-merging': mergeMode }" aria-label="账本">
    <div class="bookshelf-head">
      <span class="bookshelf-label">{{ mergeMode ? '选择要合并的账本' : '账本' }}</span>
      <div v-if="mergeMode" class="bookshelf-actions">
        <button class="text-btn" type="button" @click="selectAllMergeStages">全选</button>
        <button class="text-btn" type="button" @click="clearMergeStages">清空</button>
      </div>
      <span v-else class="bookshelf-hint">长按可改名或改预算</span>
    </div>

    <div class="book-grid">
      <button
        v-for="item in stagesView"
        :key="item.stage.id"
        class="book"
        :class="{
          current: item.stage.id === currentStage?.id,
          selected: mergeMode && isMergingStage(item.stage.id),
          'is-switched': !mergeMode && item.stage.id === switchedId
        }"
        :style="{ '--book-color': stageColor(item.stage) }"
        type="button"
        :role="mergeMode ? 'checkbox' : undefined"
        :aria-checked="mergeMode ? isMergingStage(item.stage.id) : undefined"
        :aria-current="!mergeMode && item.stage.id === currentStage?.id ? 'true' : undefined"
        :aria-label="mergeMode
          ? `${isMergingStage(item.stage.id) ? '取消选择' : '选择'} ${item.stage.name}`
          : `切换到 ${item.stage.name}，长按可以编辑`"
        @click="onBookClick(item.stage)"
        @pointerdown="onBookPointerDown($event, item.stage)"
        @pointermove="onBookPointerMove"
        @pointerup="cancelPress"
        @pointercancel="cancelPress"
        @pointerleave="cancelPress"
        @contextmenu.prevent
      >
        <span class="book-title">{{ item.stage.name }}</span>
        <span class="book-foot">
          <template v-if="item.count">
            <span class="book-amount" :class="item.amountClass" :title="item.amountTitle">¥{{ item.amountText }}</span>
            <span class="book-count" :class="{ 'is-over': item.over }">
              {{ item.count }} 笔<template v-if="item.budget > 0">
                · {{ item.over ? `超 ¥${displayMoney(Math.abs(item.remaining))}` : `剩 ¥${displayMoney(item.remaining)}` }}
              </template>
            </span>
          </template>
          <template v-else>
            <span class="book-amount book-idle">还没记过</span>
            <span class="book-count">点记账开始</span>
          </template>
          <span
            v-if="item.budget > 0"
            class="book-budget"
            :class="{ over: item.over }"
            aria-hidden="true"
          >
            <span class="book-budget-fill" :style="{ width: `${item.ratio * 100}%` }"></span>
          </span>
        </span>
        <span v-if="item.stage.id === currentStage?.id" class="book-mark" aria-hidden="true">现在</span>
        <span v-if="mergeMode" class="book-check" aria-hidden="true">
          <svg v-if="isMergingStage(item.stage.id)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
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
import { computed, onBeforeUnmount, ref } from 'vue';
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

const stagesView = computed(() => activeStages.value.map((stage) => {
  const stats = stageStats(stage.id);
  const count = Number(stats.count) || 0;
  const total = Number(stats.total) || 0;
  const budget = Number(stage.budget) || 0;
  const remaining = budget - total;
  const amountText = displayMoney(total);
  return {
    stage,
    count,
    total,
    budget,
    remaining,
    over: budget > 0 && remaining < 0,
    ratio: budget > 0 ? Math.min(1, Math.max(0, total / budget)) : 0,
    amountText,
    amountTitle: `¥${amountText}`,
    amountClass: {
      'is-long': amountText.length > 9,
      'is-tiny': amountText.length > 12
    }
  };
}));

const switchedId = ref('');
let switchedTimer = null;
let pressTimer = null;
let pressStartX = 0;
let pressStartY = 0;
let longPressed = false;

const LONG_PRESS_MS = 480;
const PRESS_MOVE_TOLERANCE = 10;

function cancelPress() {
  clearTimeout(pressTimer);
  pressTimer = null;
}

function onBookPointerDown(event, stage) {
  if (event.button > 0 || mergeMode.value) return;
  longPressed = false;
  pressStartX = event.clientX;
  pressStartY = event.clientY;
  cancelPress();
  pressTimer = setTimeout(() => {
    pressTimer = null;
    longPressed = true;
    haptic('light');
    sheets.openStageForm(stage);
  }, LONG_PRESS_MS);
}

function onBookPointerMove(event) {
  if (!pressTimer) return;
  if (Math.abs(event.clientX - pressStartX) > PRESS_MOVE_TOLERANCE ||
      Math.abs(event.clientY - pressStartY) > PRESS_MOVE_TOLERANCE) {
    cancelPress();
  }
}

function onBookClick(stage) {
  cancelPress();
  if (longPressed) {
    longPressed = false;
    return;
  }
  selectStage(stage);
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
    showToast(`已经换到「${stage.name}」啦`);
    switchedId.value = stage.id;
    clearTimeout(switchedTimer);
    switchedTimer = setTimeout(() => {
      switchedId.value = '';
    }, 700);
  }
}

onBeforeUnmount(() => {
  clearTimeout(switchedTimer);
  cancelPress();
});
</script>
