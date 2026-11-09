<template>
  <div
    ref="panelRef"
    class="record-curtain"
    :class="{ 'is-dragging': curtainDragging, 'is-open': curtainOpen }"
    :style="panelStyle"
    @pointerdown="onCurtainPointerDown"
  >
    <button
      class="record-curtain-grabber"
      type="button"
      aria-label="收起记账面板"
      @click="closeCurtain"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m6 15 6-6 6 6"></path>
      </svg>
    </button>
    <div class="record-curtain-body" :inert="!curtainOpen">
      <button
        v-if="editingExpense"
        class="record-quick-delete"
        type="button"
        @click="removeCurrent"
      >
        删掉
      </button>

      <div class="record-quick-top">
        <div class="record-quick-main">
          <span
            class="record-current-category"
            :style="{ '--swatch': categoryColor(selectedCategory) }"
          >
            <span class="record-current-dot" aria-hidden="true"></span>
            <span class="record-current-name">{{ selectedCategory }}</span>
          </span>
          <button
            class="record-stage-hint"
            type="button"
            aria-label="切换账本"
            @click="sheets.openStages()"
          >
            <span class="record-stage-text">{{ editingExpense ? '改改' : '记进' }}「{{ currentStage?.name || '当前账本' }}」</span>
            <svg class="record-stage-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6"></path>
            </svg>
          </button>
          <div
            class="record-quick-amount"
            :class="{ empty: !amount, long: amount.length > 7, xlong: amount.length > 9 }"
            aria-live="polite"
          >
            <span class="record-quick-currency">¥</span>
            <span class="record-quick-value">{{ amountDisplay || '0.00' }}</span>
            <span class="record-quick-caret" aria-hidden="true"></span>
          </div>
        </div>

        <div class="record-quick-sub">
          <div class="record-note-ghost">
            <svg class="record-note-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z"></path>
              <path d="m13.5 6.5 4 4"></path>
            </svg>
            <input
              ref="noteInput"
              v-model="note"
              class="record-note-input"
              type="text"
              maxlength="40"
              placeholder="写点备注…"
              aria-label="备注"
              enterkeyhint="done"
              @keydown.enter.prevent="blurNote"
              @keydown.esc.prevent="blurNote"
            >
            <button
              v-if="note"
              class="record-note-clear"
              type="button"
              aria-label="清掉备注"
              @click="clearNote"
            >
              ×
            </button>
          </div>
          <span class="record-quick-meta">今天 {{ todayStats.count }} 笔</span>
        </div>
      </div>

      <div class="record-category-head">
        <span>分类</span>
        <button
          v-if="categories.length < 40"
          class="record-category-add"
          type="button"
          aria-label="添加分类"
          @click="toggleAddCategory"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14"></path>
          </svg>
        </button>
      </div>

      <div v-if="showAddCategory" class="record-category-add-row">
        <input
          ref="categoryAddInput"
          v-model="newCategoryName"
          class="record-category-add-input"
          type="text"
          maxlength="10"
          placeholder="新分类名字"
          enterkeyhint="done"
          @keydown.enter.prevent="submitCategory"
          @keydown.esc.prevent="cancelAddCategory"
        >
        <button class="record-category-add-cancel" type="button" @click="cancelAddCategory">取消</button>
        <button class="record-category-add-submit" type="button" @click="submitCategory">添加</button>
      </div>

      <div ref="categoryStripRef" class="record-category-grid" role="listbox" aria-label="选择分类">
        <button
          v-for="category in categoryOptions"
          :key="category"
          class="record-category-cell"
          :class="{ selected: category === selectedCategory }"
          :style="{ '--swatch': categoryColor(category) }"
          type="button"
          role="option"
          :aria-selected="category === selectedCategory"
          @click="chooseCategory(category)"
        >
          <span class="record-category-icon"><CategoryIcon :name="iconFor(category)" /></span>
          <span class="record-category-label">{{ category }}</span>
        </button>
      </div>

      <NumberKeypad
        :date-label="dateLabel"
        :done-label="doneLabel"
        :done-close="closeMode"
        :disabled="doneDisabled"
        @digit="onDigit"
        @decimal="onDecimal"
        @double-zero="onDoubleZero"
        @backspace="onBackspace"
        @clear="onClear"
        @date="openDatePicker"
        @done="handleDone"
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
        title="挑个日子"
        :min-date="minDate"
        :max-date="maxDate"
        @confirm="confirmDate"
        @cancel="showDatePicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { showToast } from 'vant';
import { useRouter } from 'vue-router';
import NumberKeypad from './NumberKeypad.vue';
import CategoryIcon from './CategoryIcon.vue';
import { useExpenseActions } from '../composables/useExpenseActions';
import { useLedger } from '../composables/useLedger';
import { usePreferences } from '../composables/usePreferences';
import { useRecordEntry } from '../composables/useRecordEntry';
import { useSheets } from '../composables/useSheets';
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
  categoryColor,
  combineLocal,
  pad2,
  toDateInput,
  toTimeInput
} from '../utils/format';
import { curtainVisibleHeight, shouldOpenCurtain } from '../utils/pullGesture';
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
  beginCurtainPull,
  updateCurtainPull,
  endCurtainPull,
  resetRecord
} = useRecordEntry();
const { categories, currentStage, todayStats, addExpense, updateExpense, setCategories, iconFor } = useLedger();
const { removeExpense: removeExpenseAction } = useExpenseActions();
const { recordDoneBehavior, initPreferences } = usePreferences();
const sheets = useSheets();

const panelRef = ref(null);
const noteInput = ref(null);
const amount = ref('');
const selectedCategory = ref('');
const date = ref(toDateInput(new Date()));
const note = ref('');
const showDatePicker = ref(false);
const showAddCategory = ref(false);
const newCategoryName = ref('');
const categoryAddInput = ref(null);
const dateDraft = ref([]);
const saving = ref(false);
const panelHeight = ref(0);
const categoryStripRef = ref(null);
const minDate = new Date(2000, 0, 1);
const maxDate = new Date(2100, 11, 31);

let previousOverflow = '';
let closePointerId = null;
let closeStartY = 0;
let closeStartTime = 0;
let closeTracking = false;
let closePulling = false;

const categoryOptions = computed(() => {
  if (!selectedCategory.value || categories.value.includes(selectedCategory.value)) {
    return categories.value;
  }
  return [selectedCategory.value, ...categories.value];
});

const amountDisplay = computed(() => formatAmountInput(amount.value));
const canSave = computed(() => isValidAmount(amount.value) && Boolean(selectedCategory.value));
const closeMode = computed(() => !amount.value.trim() && !editingExpense.value);
const doneLabel = computed(() => (closeMode.value ? '收起来' : '记好啦'));
const doneDisabled = computed(() => saving.value || (!closeMode.value && !canSave.value));

const dateLabel = computed(() => {
  const today = toDateInput(new Date());
  if (date.value === today) return '今天';

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.value === toDateInput(yesterday)) return '昨天';

  const [, month, day] = date.value.split('-').map(Number);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return '哪一天';
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
  note.value = expense?.note || draft?.note || '';
  date.value = draft?.date ||
    (expense?.spentAt ? toDateInput(expense.spentAt) : toDateInput(now));
  if (!expense && draft?.spentAt) date.value = toDateInput(draft.spentAt);
  showDatePicker.value = false;
  showAddCategory.value = false;
  newCategoryName.value = '';
  nextTick(revealSelectedCategory);
}

watch(recordSession, initialize);

function revealSelectedCategory() {
  const strip = categoryStripRef.value;
  if (!strip) return;
  const chip = strip.querySelector('.record-category-cell.selected');
  if (!chip) return;
  const top = chip.offsetTop - (strip.clientHeight - chip.offsetHeight) / 2;
  strip.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

function measurePanel() {
  panelHeight.value = panelRef.value?.clientHeight || window.innerHeight;
}

onMounted(() => {
  initialize();
  measurePanel();
  initPreferences().catch((err) => console.error(err));
  previousOverflow = document.body.style.overflow;
  if (curtainOpen.value) document.body.style.overflow = 'hidden';
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', measurePanel);
});

watch(curtainOpen, (open) => {
  if (open) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    nextTick(revealSelectedCategory);
  } else {
    cancelAddCategory();
    document.body.style.overflow = previousOverflow;
  }
});

onUnmounted(() => {
  document.body.style.overflow = previousOverflow;
  stopCurtainDrag();
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', measurePanel);
});

function blurNote() {
  noteInput.value?.blur();
}

function clearNote() {
  note.value = '';
  noteInput.value?.focus();
}

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

function toggleAddCategory() {
  if (showAddCategory.value) {
    cancelAddCategory();
    return;
  }
  if (categories.value.length >= 40) {
    showToast('分类最多只能有 40 个哦');
    return;
  }
  haptic('light');
  showAddCategory.value = true;
  nextTick(() => categoryAddInput.value?.focus());
}

function cancelAddCategory() {
  showAddCategory.value = false;
  newCategoryName.value = '';
}

async function submitCategory() {
  const name = newCategoryName.value.trim();
  if (!name) {
    showToast('给分类起个名字吧');
    return;
  }
  if (categories.value.includes(name)) {
    showToast('这个分类已经有啦');
    return;
  }
  if (categories.value.length >= 40) {
    showToast('分类最多只能有 40 个哦');
    return;
  }

  await setCategories([...categories.value, name]);
  selectedCategory.value = name;
  rememberCategory(name);
  haptic('success');
  showToast(`「${name}」加进来啦`);
  cancelAddCategory();
  nextTick(revealSelectedCategory);
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

function handleDone() {
  if (closeMode.value) {
    haptic('light');
    resetRecord();
    return;
  }
  save();
}

async function save() {
  if (!canSave.value || saving.value) return;

  const value = toAmountNumber(amount.value);
  if (!isValidAmount(amount.value)) {
    showToast('金额要大于 0 哦');
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
        note: note.value.trim(),
        spentAt: applyDateToIso(expense.spentAt, date.value)
      });
      rememberCategory(selectedCategory.value);
      haptic('success');
      showToast('改好啦');
      closeCurtain();
      resetRecord();
      if (backPath) router.back();
      return;
    }

    const spentAt = combineLocal(date.value, toTimeInput(new Date()));
    if (!spentAt) {
      showToast('这个日子好像不对哦');
      return;
    }

    await addExpense({
      amount: value,
      category: selectedCategory.value,
      note: note.value.trim(),
      spentAt: spentAt.toISOString()
    });
    rememberCategory(selectedCategory.value);
    haptic('success');
    showToast('喵，记好啦');
    if (recordDoneBehavior.value === 'close') {
      resetRecord();
    } else {
      amount.value = '';
      note.value = '';
      expenseDraft.value = null;
    }
  } catch (err) {
    console.error(err);
    showToast('没记上，再试一次吧');
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

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.('button, input, textarea, select, a, .record-category-grid, .record-category-add-row, .record-note-ghost, .number-keypad, .van-popup'));
}

function onCurtainPointerDown(event) {
  if (!curtainOpen.value || showDatePicker.value) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (!event.isPrimary) return;
  if (isInteractiveTarget(event.target)) return;

  closePointerId = event.pointerId;
  closeStartY = event.clientY;
  closeStartTime = performance.now();
  closeTracking = true;
  closePulling = false;

  window.addEventListener('pointermove', onCurtainPointerMove);
  window.addEventListener('pointerup', onCurtainPointerUp);
  window.addEventListener('pointercancel', onCurtainPointerCancel);
}

function onCurtainPointerMove(event) {
  if (!closeTracking || event.pointerId !== closePointerId) return;
  const delta = event.clientY - closeStartY;

  if (!closePulling) {
    if (delta > -6) return;
    closePulling = true;
    beginCurtainPull();
  }

  const progress = 1 + delta / (window.innerHeight * 0.55);
  updateCurtainPull(progress);
  if (event.cancelable) event.preventDefault();
}

function onCurtainPointerUp(event) {
  if (!closeTracking || event.pointerId !== closePointerId) return;

  if (closePulling) {
    const duration = Math.max(1, performance.now() - closeStartTime);
    const velocity = (curtainPull.value - 1) / duration;
    endCurtainPull(shouldOpenCurtain(curtainPull.value, velocity, true));
    haptic('light');
  }

  stopCurtainDrag();
}

function onCurtainPointerCancel(event) {
  if (!closeTracking || event.pointerId !== closePointerId) return;
  if (closePulling) {
    const velocity = (curtainPull.value - 1) / Math.max(1, performance.now() - closeStartTime);
    endCurtainPull(shouldOpenCurtain(curtainPull.value, velocity, true));
  }
  stopCurtainDrag();
}

function stopCurtainDrag() {
  closeTracking = false;
  closePulling = false;
  closePointerId = null;
  window.removeEventListener('pointermove', onCurtainPointerMove);
  window.removeEventListener('pointerup', onCurtainPointerUp);
  window.removeEventListener('pointercancel', onCurtainPointerCancel);
}

function onKeydown(event) {
  if (!curtainOpen.value || showDatePicker.value) return;

  const target = event.target;
  const tag = target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;

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
    if (tag === 'BUTTON') return;
    if (canSave.value && !saving.value) {
      event.preventDefault();
      save();
    }
  }
}
</script>
