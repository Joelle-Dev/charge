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

      <p v-if="error" class="form-error">{{ error }}</p>

      <div class="form-actions">
        <button class="primary-btn" type="submit">{{ editingStage ? '保存' : '建好就用它' }}</button>
        <button v-if="editingStage" class="danger-btn" type="button" @click="toggleArchive">
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
import { ref, watch } from 'vue';
import { showConfirmDialog, showToast } from 'vant';
import SheetFrame from './SheetFrame.vue';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { haptic } from '../utils/haptics';
import { DANGER_COLOR } from '../utils/theme';

const show = defineModel('show', { type: Boolean, default: false });
const sheets = useSheets();
const { editingStage, stageDraftName } = sheets;
const {
  createStage,
  updateStage,
  archiveStage,
  restoreStage,
  deleteStage,
  stageStats
} = useLedger();

const name = ref('');
const budget = ref('');
const error = ref('');

watch(
  [show, editingStage, stageDraftName],
  ([visible]) => {
    if (!visible) return;
    const stage = editingStage.value;
    name.value = stage?.name || stageDraftName.value || '';
    budget.value = stage?.budget ? String(stage.budget) : '';
    error.value = '';
  }
);

async function save() {
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

  if (editingStage.value) {
    await updateStage(editingStage.value, { name: trimmed, budget: budgetValue });
    haptic('success');
    showToast('账本改好啦');
  } else {
    await createStage({ name: trimmed, budget: budgetValue });
    haptic('success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`「${trimmed}」建好啦`);
  }
  show.value = false;
}

async function toggleArchive() {
  const stage = editingStage.value;
  if (!stage) return;
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
}

async function removeStage() {
  const stage = editingStage.value;
  if (!stage) return;
  const count = stageStats(stage.id).count;
  try {
    await showConfirmDialog({
      title: '删掉这个账本',
      message: `要把「${stage.name}」和里面的 ${count} 笔花销一起删掉吗？删掉就找不回来啦。`,
      confirmButtonText: '删掉吧',
      confirmButtonColor: DANGER_COLOR
    });
  } catch (err) {
    return;
  }
  await deleteStage(stage);
  haptic('warning');
  showToast('账本删掉啦');
  show.value = false;
}
</script>
