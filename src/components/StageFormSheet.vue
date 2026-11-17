<template>
  <SheetFrame v-model:show="show" :title="editingStage ? '改改账本' : '建个新账本'" max-height="88dvh">
    <form novalidate @submit.prevent="save">
      <label class="field">
        <span class="field-label">账本名字</span>
        <input
          v-model="name"
          class="input"
          type="text"
          maxlength="24"
          placeholder="比如：国庆旅行、装修 2025"
          required
        >
      </label>

      <label class="field">
        <span class="field-label">猫粮罐预算 <span>可选</span></span>
        <input
          v-model="budget"
          class="input"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          placeholder="不填也没关系"
        >
      </label>

      <div class="field">
        <span class="field-label">书脊颜色</span>
        <div class="stage-color-grid" role="radiogroup" aria-label="账本颜色">
          <button
            v-for="option in STAGE_COLORS"
            :key="option.key"
            class="stage-color-cell"
            :class="{ active: color === option.value }"
            type="button"
            role="radio"
            :aria-checked="color === option.value"
            :aria-label="option.label"
            :style="{ '--swatch': option.value }"
            @click="pickColor(option.value)"
          >
            <svg v-if="color === option.value" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m5 12 4.5 4.5L19 7"></path>
            </svg>
          </button>

          <label
            class="stage-color-cell stage-color-custom"
            :class="{ active: isCustomColor, 'is-picked': isCustomColor }"
            :style="isCustomColor ? { '--swatch': color } : null"
            :aria-label="isCustomColor ? `自定义颜色，当前 ${color}` : '自定义颜色'"
          >
            <svg v-if="!isCustomColor" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.4-4-7-9-7Z"></path>
              <circle cx="7.5" cy="10.5" r="1.2" fill="currentColor" stroke="none"></circle>
              <circle cx="12" cy="7.5" r="1.2" fill="currentColor" stroke="none"></circle>
              <circle cx="16.5" cy="10.5" r="1.2" fill="currentColor" stroke="none"></circle>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m5 12 4.5 4.5L19 7"></path>
            </svg>
            <input
              :value="color"
              class="stage-color-input"
              type="color"
              aria-label="选择自定义颜色"
              @input="pickColor($event.target.value)"
            >
          </label>
        </div>
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>

      <div class="form-actions">
        <button class="primary-btn" type="submit" :disabled="busy">{{ editingStage ? '保存' : '建好就用它' }}</button>
        <button v-if="editingStage" class="danger-btn" type="button" :disabled="busy" @click="toggleArchive">
          {{ editingStage.archived ? '恢复' : '收起来' }}
        </button>
      </div>

      <button
        v-if="editingStage && !editingStage.archived"
        class="text-btn stage-delete-btn"
        type="button"
        @click="removeStage"
      >
        把这个账本删掉
      </button>

      <p class="sheet-note">
        {{ editingStage ? '预算只用来算还剩多少，不影响记账。' : '建好后会马上换到这个账本。' }}
      </p>
    </form>
  </SheetFrame>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { showConfirmDialog, showToast } from 'vant';
import SheetFrame from './SheetFrame.vue';
import { useLedger, UNDO_DELETE_STAGE_MAX } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { useUndo } from '../composables/useUndo';
import { haptic } from '../utils/haptics';
import { DANGER_COLOR } from '../utils/theme';
import { STAGE_COLORS, stageColor } from '../utils/format';

const show = defineModel('show', { type: Boolean, default: false });
const sheets = useSheets();
const { showUndo } = useUndo();
const { editingStage, stageDraftName } = sheets;
const {
  createStage,
  updateStage,
  archiveStage,
  restoreStage,
  deleteStage,
  restoreDeletedStage,
  loadStageExpensesSnapshot,
  stageStats
} = useLedger();

const name = ref('');
const budget = ref('');
const color = ref('');
const error = ref('');
const busy = ref(false);

function pickColor(value) {
  color.value = String(value || '').toLowerCase();
  haptic('light');
}

// 当前颜色不在 10 个预设里时，说明是用户自己调的，让自定义格高亮。
const isCustomColor = computed(() => (
  Boolean(color.value) && !STAGE_COLORS.some((option) => option.value === color.value)
));

watch(
  [show, editingStage, stageDraftName],
  ([visible]) => {
    if (!visible) return;
    const stage = editingStage.value;
    name.value = stage?.name || stageDraftName.value || '';
    budget.value = stage?.budget ? String(stage.budget) : '';
    // 没设过颜色时，用名字哈希出来的默认色，让选择器起点与书架一致。
    color.value = stage
      ? stageColor(stage)
      : stageColor({ name: stageDraftName.value });
    error.value = '';
  }
);

async function save() {
  if (busy.value) return;
  const trimmed = String(name.value || '').trim();
  const budgetRaw = budget.value === '' || budget.value === null || budget.value === undefined
    ? ''
    : String(budget.value);
  const budgetValue = budgetRaw === '' ? null : Number(budgetRaw);

  if (!trimmed) {
    error.value = '给账本起个名字吧';
    return;
  }
  if (budgetRaw !== '' && (!Number.isFinite(budgetValue) || budgetValue < 0)) {
    error.value = '预算要填 0 或更大的数字哦';
    return;
  }

  busy.value = true;
  try {
    if (editingStage.value) {
      await updateStage(editingStage.value, { name: trimmed, budget: budgetValue, color: color.value });
      haptic('success');
      showToast('账本改好啦');
    } else {
      await createStage({ name: trimmed, budget: budgetValue, color: color.value });
      haptic('success');
      showToast(`「${trimmed}」建好啦`);
    }
    show.value = false;
  } catch (err) {
    console.error('保存账本失败', err);
    showToast('没保存好，再试试吧');
  } finally {
    busy.value = false;
  }
}

async function toggleArchive() {
  const stage = editingStage.value;
  if (!stage || busy.value) return;
  busy.value = true;
  try {
    if (stage.archived) {
      await restoreStage(stage);
      haptic('light');
      showToast(`「${stage.name}」回来啦`);
    } else {
      await archiveStage(stage);
      haptic('light');
      showToast(`「${stage.name}」收起来啦`);
    }
    show.value = false;
  } catch (err) {
    console.error('更新账本状态失败', err);
    showToast('没弄好，再试试吧');
  } finally {
    busy.value = false;
  }
}

async function removeStage() {
  const stage = editingStage.value;
  if (!stage) return;
  const count = stageStats(stage.id).count;
  const recoverable = count <= UNDO_DELETE_STAGE_MAX;
  try {
    await showConfirmDialog({
      title: '删掉这个账本',
      message: recoverable
        ? `要把「${stage.name}」和里面的 ${count} 笔花销一起删掉吗？删掉后 8 秒内可以撤销。`
        : `「${stage.name}」里有 ${count} 笔花销，删掉就找不回来啦。建议先导出备份。`,
      confirmButtonText: '删掉吧',
      confirmButtonColor: DANGER_COLOR
    });
  } catch (err) {
    return;
  }
  busy.value = true;
  try {
    const snapshot = recoverable && count > 0 ? await loadStageExpensesSnapshot(stage.id) : null;
    const snapshotStage = { ...stage };
    await deleteStage(stage);
    haptic('warning');
    show.value = false;

    if (snapshot) {
      showUndo(`「${stage.name}」删掉啦`, async () => {
        try {
          await restoreDeletedStage(snapshotStage, snapshot);
          haptic('success');
          showToast(`「${stage.name}」回来啦`);
        } catch (err) {
          console.error('恢复账本失败', err);
          showToast('没找回来，再试试吧');
        }
      }, 8000);
    } else {
      showToast('账本删掉啦');
    }
  } catch (err) {
    console.error('删除账本失败', err);
    showToast('没删掉，再试试吧');
  } finally {
    busy.value = false;
  }
}
</script>
