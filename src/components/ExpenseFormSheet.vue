<template>
  <SheetFrame v-model:show="show" :title="editingExpense ? '编辑支出' : '手动记一笔'" max-height="88dvh">
    <form novalidate @submit.prevent="save">
      <div class="field">
        <span class="field-label">金额</span>
        <div class="amount-input">
          <span class="currency">¥</span>
          <input
            v-model="amount"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            required
          >
        </div>
      </div>

      <div class="field">
        <span class="field-label">分类</span>
        <div class="chip-wrap">
          <button
            v-for="category in categoryOptions"
            :key="category"
            class="chip"
            :class="{ selected: category === selectedCategory }"
            type="button"
            @click="selectedCategory = category"
          >
            {{ category }}
          </button>
        </div>
      </div>

      <label class="field">
        <span class="field-label">备注 <span>可选</span></span>
        <input v-model="note" class="input" type="text" maxlength="40" placeholder="可选，比如：午饭">
      </label>

      <div class="form-row">
        <label class="field">
          <span class="field-label">日期</span>
          <input v-model="date" class="input" type="date">
        </label>
        <label class="field">
          <span class="field-label">时间</span>
          <input v-model="time" class="input" type="time">
        </label>
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>

      <div class="form-actions">
        <button class="primary-btn" type="submit">{{ editingExpense ? '保存修改' : '记下这笔' }}</button>
        <button v-if="editingExpense" class="danger-btn" type="button" @click="removeExpense">删除</button>
      </div>
    </form>
  </SheetFrame>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { showToast } from 'vant';
import SheetFrame from './SheetFrame.vue';
import { useExpenseActions } from '../composables/useExpenseActions';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { haptic } from '../utils/haptics';
import { combineLocal, toDateInput, toTimeInput } from '../utils/format';

const show = defineModel('show', { type: Boolean, default: false });
const sheets = useSheets();
const { editingExpense, expenseDraft } = sheets;
const { categories, addExpense, updateExpense } = useLedger();
const { removeExpense: removeExpenseAction } = useExpenseActions();

const amount = ref('');
const note = ref('');
const date = ref('');
const time = ref('');
const selectedCategory = ref('其他');
const error = ref('');

const categoryOptions = computed(() => {
  if (!selectedCategory.value || categories.value.includes(selectedCategory.value)) {
    return categories.value;
  }
  return [selectedCategory.value, ...categories.value];
});

watch(
  [show, editingExpense, expenseDraft],
  ([visible]) => {
    if (!visible) return;
    const expense = editingExpense.value;
    const draft = expenseDraft.value;
    const now = new Date();
    const draftDate = draft?.date ? combineLocal(draft.date, toTimeInput(now)) : null;
    amount.value = expense ? String(expense.amount) : draft ? String(draft.amount || '') : '';
    note.value = expense?.note || draft?.note || '';
    selectedCategory.value = expense?.category || draft?.category ||
      (categories.value.includes('餐饮') ? '餐饮' : categories.value[0]);
    date.value = toDateInput(expense?.spentAt || draft?.spentAt || draftDate || now);
    time.value = toTimeInput(expense?.spentAt || draft?.spentAt || now);
    error.value = '';
  }
);

async function save() {
  const value = Math.round(Number(amount.value) * 100) / 100;
  const spentAt = combineLocal(date.value, time.value);

  if (!Number.isFinite(value) || value <= 0) {
    error.value = '请输入大于 0 的金额';
    return;
  }
  if (!spentAt) {
    error.value = '日期或时间不正确';
    return;
  }

  const payload = {
    amount: value,
    category: selectedCategory.value,
    note: note.value.trim(),
    spentAt: spentAt.toISOString()
  };

  if (editingExpense.value) {
    await updateExpense(editingExpense.value, payload);
    showToast('已保存修改');
  } else {
    await addExpense(payload);
    haptic('success');
    showToast('喵，已记下这笔');
  }
  show.value = false;
}

async function removeExpense() {
  const expense = editingExpense.value;
  if (!expense) return;
  const removed = await removeExpenseAction(expense);
  if (removed) show.value = false;
}
</script>
