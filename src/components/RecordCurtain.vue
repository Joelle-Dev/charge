<template>
  <div
    ref="panelRef"
    class="record-curtain"
    :class="{ 'is-dragging': curtainDragging, 'is-open': curtainOpen }"
    :style="panelStyle"
  >
    <div class="record-curtain-body" :inert="!curtainOpen">
      <header class="record-curtain-head">
        <div class="record-curtain-heading">
          <span class="record-curtain-eyebrow">{{ editingExpense ? '编辑支出' : '记一笔' }}</span>
          <p>记入「{{ currentStage?.name || '当前阶段' }}」</p>
        </div>
        <button
          v-if="editingExpense"
          class="record-delete-btn"
          type="button"
          @click="removeCurrent"
        >
          删除
        </button>
      </header>

      <div class="record-category-strip" aria-label="选择分类">
        <button
          v-for="category in categoryOptions"
          :key="category"
          class="chip"
          :class="{ selected: category === selectedCategory }"
          type="button"
          @click="chooseCategory(category)"
        >
          {{ category }}
        </button>
      </div>

      <div
        class="record-amount-display"
        :class="{ empty: !amount, long: amount.length > 7, xlong: amount.length > 9 }"
        aria-live="polite"
      >
        <span class="record-currency">¥</span>
        <span class="record-amount-value">{{ amountDisplay || '0.00' }}</span>
        <span class="record-amount-caret" aria-hidden="true"></span>
      </div>

      <div class="record-amount-meta">
        <span>今天 {{ todayStats.count }} 笔 · ¥{{ formatMoney(todayStats.total) }}</span>
        <span v-if="editingExpense">原备注与时间保持不变</span>
        <span v-else-if="draftNote">备注：{{ draftNote }}</span>
      </div>

      <NumberKeypad
        :date-label="dateLabel"
        :disabled="!canSave || saving"
        @digit="onDigit"
        @decimal="onDecimal"
        @double-zero="onDoubleZero"
        @backspace="onBackspace"
        @clear="onClear"
        @date="openDatePicker"
        @done="save"
      />
    </div>

    <van-popup
      v-model:show="showDatePicker"
      position="bottom"
      round
      teleport="body"
      class="picker-popup"
    >
      <van-date-picker
        v-model="dateDraft"
        title="选择日期"
        :min-date="minDate"
        :max-date="maxDate"
        @confirm="confirmDate"
        @cancel="showDatePicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { showToast } from 'vant';
import { useRouter } from 'vue-router';
import NumberKeypad from './NumberKeypad.vue';
import { useExpenseActions } from '../composables/useExpenseActions';
import { useLedger } from '../composables/useLedger';
import { useRecordEntry } from '../composables/useRecordEntry';
import {
  amountToInput,
  appendDecimal,
  appendDigit,
  appendDoubleZero,
  backspaceAmount,
  clearAmount,
  formatAmountInput,
  isValidAmount,
  toAmountNumber
} from '../utils/amountInput';
import {
  applyDateToIso,
  combineLocal,
  formatMoney,
  pad2,
  toDateInput,
  toTimeInput
} from '../utils/format';
import { curtainVisibleHeight } from '../utils/pullGesture';
import { haptic } from '../utils/haptics';

const LAST_CATEGORY_KEY = 'shoucai:last-category';

const router = useRouter();
const {
  editingExpense,
  expenseDraft,
  curtainOpen,
  curtainPull,
  curtainDragging,
  recordSession,
  returnTo,
  closeCurtain,
  resetRecord
} = useRecordEntry();
const { categories, currentStage, todayStats, addExpense, updateExpense } = useLedger();
const { removeExpense: removeExpenseAction } = useExpenseActions();

const panelRef = ref(null);
const amount = ref('');
const selectedCategory = ref('');
const date = ref(toDateInput(new Date()));
const baseNote = ref('');
const showDatePicker = ref(false);
const dateDraft = ref([]);
const saving = ref(false);
const panelHeight = ref(0);
const minDate = new Date(2000, 0, 1);
const maxDate = new Date(2100, 11, 31);

let previousOverflow = '';

const categoryOptions = computed(() => {
  if (!selectedCategory.value || categories.value.includes(selectedCategory.value)) {
    return categories.value;
  }
  return [selectedCategory.value, ...categories.value];
});

const amountDisplay = computed(() => formatAmountInput(amount.value));
const canSave = computed(() => isValidAmount(amount.value) && Boolean(selectedCategory.value));
const draftNote = computed(() => String(expenseDraft.value?.note || '').trim());

const dateLabel = computed(() => {
  const today = toDateInput(new Date());
  if (date.value === today) return '今天';

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.value === toDateInput(yesterday)) return '昨天';

  const [, month, day] = date.value.split('-').map(Number);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return '日期';
  return `${month}/${day}`;
});

const panelStyle = computed(() => {
  if (!curtainDragging.value && curtainOpen.value) {
    return { clipPath: 'inset(0 0 0 0)' };
  }
  const visible = curtainDragging.value
    ? curtainVisibleHeight(curtainPull.value, panelHeight.value)
    : 0;
  return { clipPath: `inset(0 0 calc(100% - ${visible}px) 0)` };
});

function readLastCategory() {
  try {
    return localStorage.getItem(LAST_CATEGORY_KEY) || '';
  } catch (err) {
    return '';
  }
}

function rememberCategory(category) {
  try {
    localStorage.setItem(LAST_CATEGORY_KEY, category);
  } catch (err) {
    // Local storage can be unavailable in private modes.
  }
}

function defaultCategory() {
  const stored = readLastCategory();
  if (stored && categories.value.includes(stored)) return stored;
  return categories.value.includes('餐饮') ? '餐饮' : categories.value[0] || '其他';
}

function initialize() {
  const expense = editingExpense.value;
  const draft = expenseDraft.value;
  const now = new Date();

  amount.value = expense
    ? amountToInput(expense.amount)
    : amountToInput(draft?.amount || '');
  selectedCategory.value = expense?.category || draft?.category || defaultCategory();
  baseNote.value = expense?.note || draft?.note || '';
  date.value = draft?.date ||
    (expense?.spentAt ? toDateInput(expense.spentAt) : toDateInput(now));
  if (!expense && draft?.spentAt) date.value = toDateInput(draft.spentAt);
  showDatePicker.value = false;
}

watch(recordSession, initialize);

function measurePanel() {
  panelHeight.value = panelRef.value?.clientHeight || window.innerHeight;
}

onMounted(() => {
  initialize();
  measurePanel();
  previousOverflow = document.body.style.overflow;
  if (curtainOpen.value) document.body.style.overflow = 'hidden';
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', measurePanel);
});

watch(curtainOpen, (open) => {
  if (open) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = previousOverflow;
  }
});

onUnmounted(() => {
  document.body.style.overflow = previousOverflow;
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', measurePanel);
});

function onDigit(digit) {
  amount.value = appendDigit(amount.value, digit);
}

function onDecimal() {
  amount.value = appendDecimal(amount.value);
}

function onDoubleZero() {
  amount.value = appendDoubleZero(amount.value);
}

function onBackspace() {
  amount.value = backspaceAmount(amount.value);
}

function onClear() {
  amount.value = clearAmount();
}

function chooseCategory(category) {
  selectedCategory.value = category;
  haptic('light');
}

function openDatePicker() {
  const parts = date.value.split('-').map(Number);
  dateDraft.value = parts.length === 3 && parts.every(Number.isFinite)
    ? [String(parts[0]), pad2(parts[1]), pad2(parts[2])]
    : [String(new Date().getFullYear()), pad2(new Date().getMonth() + 1), pad2(new Date().getDate())];
  showDatePicker.value = true;
}

function confirmDate() {
  if (dateDraft.value.length !== 3) return;
  const [year, month, day] = dateDraft.value.map(Number);
  date.value = `${year}-${pad2(month)}-${pad2(day)}`;
  showDatePicker.value = false;
  haptic('light');
}

async function save() {
  if (!canSave.value || saving.value) return;

  const value = toAmountNumber(amount.value);
  if (!isValidAmount(amount.value)) {
    showToast('请输入大于 0 的金额');
    return;
  }

  saving.value = true;
  try {
    if (editingExpense.value) {
      const expense = editingExpense.value;
      const backPath = returnTo.value;
      await updateExpense(expense, {
        amount: value,
        category: selectedCategory.value,
        spentAt: applyDateToIso(expense.spentAt, date.value)
      });
      rememberCategory(selectedCategory.value);
      haptic('success');
      showToast('已保存修改');
      closeCurtain();
      resetRecord();
      if (backPath) router.back();
      return;
    }

    const spentAt = combineLocal(date.value, toTimeInput(new Date()));
    if (!spentAt) {
      showToast('日期不正确');
      return;
    }

    await addExpense({
      amount: value,
      category: selectedCategory.value,
      note: baseNote.value,
      spentAt: spentAt.toISOString()
    });
    rememberCategory(selectedCategory.value);
    haptic('success');
    showToast('喵，已记下这笔');
    amount.value = '';
    baseNote.value = '';
    expenseDraft.value = null;
  } catch (err) {
    console.error(err);
    showToast('保存失败，请重试');
  } finally {
    saving.value = false;
  }
}

async function removeCurrent() {
  const expense = editingExpense.value;
  if (!expense) return;
  const backPath = returnTo.value;
  const removed = await removeExpenseAction(expense);
  if (!removed) return;
  closeCurtain();
  resetRecord();
  if (backPath) router.back();
}

function onKeydown(event) {
  if (!curtainOpen.value || showDatePicker.value) return;

  if (event.key === 'Escape') {
    closeCurtain();
    return;
  }
  if (/^\d$/.test(event.key)) {
    event.preventDefault();
    onDigit(event.key);
    return;
  }
  if (event.key === '.') {
    event.preventDefault();
    onDecimal();
    return;
  }
  if (event.key === 'Backspace') {
    event.preventDefault();
    onBackspace();
    return;
  }
  if (event.key === 'Enter') {
    const tag = event.target?.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (canSave.value && !saving.value) {
      event.preventDefault();
      save();
    }
  }
}
</script>
