<template>
  <SheetFrame v-model:show="show" :title="editingStage ? '编辑阶段' : '新建阶段'" max-height="88dvh">
    <form novalidate @submit.prevent="save">
      <label class="field">
        <span class="field-label">阶段名称</span>
        <input
          v-model="name"
          class="input"
          type="text"
          maxlength="24"
          placeholder="例如：国庆旅行、装修 2025"
          required
        >
      </label>

      <label class="field">
        <span class="field-label">预算总数 <span>可选</span></span>
        <input
          v-model="budget"
          class="input"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          placeholder="不填也可以"
        >
      </label>

      <p v-if="error" class="form-error">{{ error }}</p>

      <div class="form-actions">
        <button class="primary-btn" type="submit">{{ editingStage ? '保存' : '创建并切换' }}</button>
        <button v-if="editingStage" class="danger-btn" type="button" @click="toggleArchive">
          {{ editingStage.archived ? '恢复' : '归档' }}
        </button>
      </div>

      <button
        v-if="editingStage && !editingStage.archived"
        class="text-btn"
        type="button"
        style="margin: 14px auto 0; display: block; color: var(--danger)"
        @click="removeStage"
      >
        删除这个阶段
      </button>

      <p class="sheet-note">
        {{ editingStage ? '预算只用于计算剩余和进度，不影响记账。' : '创建后会立即切换到这个阶段。' }}
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

const show = defineModel('show', { type: Boolean, default: false });
const sheets = useSheets();
const { editingStage } = sheets;
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
  [show, editingStage],
  ([visible]) => {
    if (!visible) return;
    const stage = editingStage.value;
    name.value = stage?.name || '';
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
    error.value = '给阶段起个名字吧';
    return;
  }
  if (budgetRaw !== '' && (!Number.isFinite(budgetValue) || budgetValue < 0)) {
    error.value = '预算需要是大于等于 0 的数字';
    return;
  }

  if (editingStage.value) {
    await updateStage(editingStage.value, { name: trimmed, budget: budgetValue });
    showToast('阶段已更新');
  } else {
    await createStage({ name: trimmed, budget: budgetValue });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`已创建「${trimmed}」`);
  }
  show.value = false;
}

async function toggleArchive() {
  const stage = editingStage.value;
  if (!stage) return;
  if (stage.archived) {
    await restoreStage(stage);
    showToast(`已恢复「${stage.name}」`);
  } else {
    await archiveStage(stage);
    showToast(`已归档「${stage.name}」`);
  }
  show.value = false;
}

async function removeStage() {
  const stage = editingStage.value;
  if (!stage) return;
  const count = stageStats(stage.id).count;
  try {
    await showConfirmDialog({
      title: '删除阶段',
      message: `删除「${stage.name}」及其中 ${count} 笔支出？此操作不可恢复。`,
      confirmButtonText: '删除',
      confirmButtonColor: '#c94a44'
    });
  } catch (err) {
    return;
  }
  await deleteStage(stage);
  showToast('阶段已删除');
  show.value = false;
}
</script>
