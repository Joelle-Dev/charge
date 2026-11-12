<template>
  <SheetFrame v-model:show="show" title="合并账本" max-height="88dvh">
    <template v-if="mergedStages.length >= 2">
      <p class="sheet-intro">
        选一个账本作为合并后的目标。其他账本的账目都会搬过去，源账本会收进旧账本。
      </p>

      <div class="merge-target-list" role="radiogroup" aria-label="合并到哪个账本">
        <button
          v-for="stage in mergedStages"
          :key="stage.id"
          class="merge-target"
          :class="{ active: stage.id === targetId }"
          type="button"
          role="radio"
          :aria-checked="stage.id === targetId"
          :disabled="busy"
          @click="targetId = stage.id"
        >
          <span class="merge-target-radio" aria-hidden="true"></span>
          <span class="merge-target-body">
            <span class="merge-target-name">
              {{ stage.name }}
              <span v-if="stage.id === currentStage?.id" class="current-badge">现在</span>
            </span>
            <span class="merge-target-meta">{{ stageLine(stage) }}</span>
          </span>
        </button>
      </div>

      <div class="merge-preview">
        <div class="merge-preview-row">
          <span>目标</span>
          <b>{{ targetStage?.name || '还没选好' }}</b>
        </div>
        <div class="merge-preview-row">
          <span>合并后账目</span>
          <b>{{ mergedTotals.count }} 笔 · ¥{{ displayMoney(mergedTotals.total) }}</b>
        </div>
        <div class="merge-preview-row">
          <span>预算</span>
          <b>{{ targetBudget > 0 ? `沿用 ¥${displayMoney(targetBudget)}` : '目标账本没设预算' }}</b>
        </div>
        <div class="merge-preview-row">
          <span>会收进旧账本</span>
          <b>{{ sourceNames || '—' }}</b>
        </div>
      </div>

      <p class="merge-warning">
        合并后账目都会归到「{{ targetStage?.name || '目标账本' }}」，另外 {{ sourceNames || '—' }} 会收进旧账本。
      </p>

      <div class="form-actions">
        <button class="secondary-btn" type="button" :disabled="busy" @click="show = false">取消</button>
        <button class="primary-btn" type="button" :disabled="!canSubmit" @click="confirmMerge">
          {{ busy ? busyText : '合并并归档' }}
        </button>
      </div>
      <p class="sheet-note">合并后 10 秒内可以撤销，超过时间就找不回来了。</p>
    </template>

    <div v-else class="list-empty">
      <p>还没选好账本</p>
      <span>至少选两个账本才能合并哦</span>
    </div>
  </SheetFrame>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { showToast } from 'vant';
import SheetFrame from './SheetFrame.vue';
import { useLedger } from '../composables/useLedger';
import { useUndo } from '../composables/useUndo';
import { displayMoney } from '../utils/money';
import { haptic } from '../utils/haptics';

const show = defineModel('show', { type: Boolean, default: false });
const { showUndo } = useUndo();
const {
  currentStage,
  mergedStages,
  mergedTotals,
  mergeStages,
  undoMergeStages,
  stageStats
} = useLedger();

const targetId = ref('');
const busy = ref(false);
const moved = ref(0);

const targetStage = computed(() =>
  mergedStages.value.find((stage) => stage.id === targetId.value) || null
);
const targetBudget = computed(() => Number(targetStage.value?.budget) || 0);
const sourceNames = computed(() =>
  mergedStages.value
    .filter((stage) => stage.id !== targetId.value)
    .map((stage) => stage.name)
    .join('、')
);
const canSubmit = computed(() => (
  !busy.value && Boolean(targetStage.value) && mergedStages.value.length >= 2
));
const busyText = computed(() => (
  moved.value ? `正在合并… ${moved.value} 笔` : '正在合并…'
));

function stageLine(stage) {
  const stats = stageStats(stage.id);
  return `${stats.count} 笔 · ¥${displayMoney(stats.total)}`;
}

watch(
  [show, mergedStages],
  ([visible]) => {
    if (!visible) return;
    moved.value = 0;
    const currentId = currentStage.value?.id;
    const preferred = mergedStages.value.find((stage) => stage.id === currentId);
    if (!mergedStages.value.some((stage) => stage.id === targetId.value)) {
      targetId.value = preferred?.id || mergedStages.value[0]?.id || '';
    }
  },
  { immediate: true }
);

async function confirmMerge() {
  if (!canSubmit.value || !targetStage.value) return;
  const targetName = targetStage.value.name;
  const count = mergedStages.value.length;
  busy.value = true;
  moved.value = 0;
  haptic('light');

  try {
    const snapshot = await mergeStages(targetId.value, {
      onProgress: ({ moved: movedCount }) => {
        moved.value = Number(movedCount) || 0;
      }
    });
    show.value = false;
    haptic('success');
    showToast(`${count} 个账本合好啦，都装进「${targetName}」`);
    showUndo(`「${targetName}」合并好啦`, async () => {
      try {
        const restored = await undoMergeStages(snapshot);
        if (!restored) throw new Error('没有可撤销的合并');
        haptic('success');
        showToast('合并撤销啦');
      } catch (err) {
        console.error(err);
        showToast('撤销没成功，再试一次吧');
      }
    }, 10000);
  } catch (err) {
    console.error(err);
    showToast(err?.message || '合并没成功，再试一次吧');
  } finally {
    busy.value = false;
  }
}
</script>
