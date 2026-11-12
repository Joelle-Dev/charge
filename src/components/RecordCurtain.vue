<template>
  <div
    ref="panelRef"
    class="record-curtain"
    :class="{ 'is-dragging': curtainDragging, 'is-open': curtainOpen, 'is-keyboard-open': keyboardOpen }"
    :style="panelStyle"
    @pointerdown="onCurtainPointerDown"
  >
    <button
      class="record-curtain-grabber"
      type="button"
      aria-label="收起记账面板"
      @click="closeCurtain()"
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

      <div class="record-category-layer">
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

          <button
            class="record-category-cell record-category-create"
            type="button"
            aria-label="添加或管理分类"
            @click="openCategories"
          >
            <span class="record-category-create-plus" aria-hidden="true">＋</span>
          </button>
        </div>
      </div>

      <div class="record-keypad-layer" :style="keypadLayerStyle">
        <div class="record-keypad-head">
          <span
            class="record-current-category"
            :style="{ '--swatch': categoryColor(selectedCategory) }"
          >
            <span class="record-current-dot" aria-hidden="true"></span>
            <span class="record-current-name">{{ selectedCategory }}</span>
          </span>
          <div class="record-keypad-amount">
            <div
              class="record-quick-amount"
              :class="{ empty: !amount, long: amountDisplay.length > 7, xlong: amountDisplay.length > 9 }"
              aria-live="polite"
            >
              <span class="record-quick-currency">¥</span>
              <span ref="amountValueRef" class="record-quick-value">{{ amountDisplay || '0.00' }}</span>
              <span class="record-quick-caret" aria-hidden="true"></span>
            </div>
            <span
              v-if="expressionPreview"
              class="record-quick-preview"
              :class="{ 'is-invalid': expressionInvalid }"
            >
              {{ expressionPreview }}
            </span>
          </div>
        </div>

        <div class="record-keypad-note">
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
              @focus="onNoteFocus"
              @blur="onNoteBlur"
              @input="scheduleKeyboardInset"
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
          <button
            class="record-date-chip"
            type="button"
            :aria-label="`选择日期，当前 ${dateStatsLabel}`"
            @click="openDatePicker"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2"></rect>
              <path d="M8 3v4M16 3v4M3 11h18"></path>
            </svg>
            {{ dateStatsLabel }}
          </button>
        </div>

        <NumberKeypad
          :done-label="doneLabel"
          :done-close="closeMode"
          :disabled="doneDisabled"
          @digit="onDigit"
          @decimal="onDecimal"
          @double-zero="onDoubleZero"
          @operator="onOperator"
          @backspace="onBackspace"
          @clear="onClear"
          @done="handleDone"
        />
      </div>
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

    <CategorySheet
      v-model:show="showCategories"
      auto-focus
      @created="onCategoryCreated"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { showConfirmDialog, showToast } from 'vant';
import { useRouter } from 'vue-router';
import NumberKeypad from './NumberKeypad.vue';
import CategoryIcon from './CategoryIcon.vue';
import CategorySheet from './CategorySheet.vue';
import { useExpenseActions } from '../composables/useExpenseActions';
import { useLedger } from '../composables/useLedger';
import { useRecordEntry } from '../composables/useRecordEntry';
import {
  amountToInput,
  appendExpressionDecimal,
  appendExpressionDigit,
  appendExpressionDoubleZero,
  appendExpressionOperator,
  backspaceAmount,
  clearAmount,
  evaluateExpression,
  formatExpression,
  isValidExpression
} from '../utils/amountInput';
import {
  applyDateToIso,
  categoryColor,
  combineLocal,
  formatMoney,
  pad2,
  toDateInput,
  toTimeInput
} from '../utils/format';
import { curtainVisibleHeight, shouldOpenCurtain } from '../utils/pullGesture';
import { haptic } from '../utils/haptics';
import { DANGER_COLOR } from '../utils/theme';

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
  resetRecord,
  setCloseGuard
} = useRecordEntry();
const { categories, currentStage, dataVersion, addExpense, updateExpense, iconFor, loadMonthExpenses } = useLedger();
const { removeExpenseWithUndo } = useExpenseActions();

const panelRef = ref(null);
const noteInput = ref(null);
const amountValueRef = ref(null);
const noteFocused = ref(false);
const keyboardOpen = ref(false);
const keyboardInset = ref(0);
const amount = ref('');
const selectedCategory = ref('');
const date = ref(toDateInput(new Date()));
const note = ref('');
const showDatePicker = ref(false);
const showCategories = ref(false);
const dateDraft = ref([]);
const saving = ref(false);
const panelHeight = ref(0);
const categoryStripRef = ref(null);
const dateStatsCount = ref(0);
const minDate = new Date(2000, 0, 1);
const maxDate = new Date(2100, 11, 31);

let previousOverflow = '';
let keyboardCloseTimer = 0;
let keyboardSyncTimer = 0;
let dateStatsToken = 0;
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

const amountDisplay = computed(() => formatExpression(amount.value));
const expressionResult = computed(() => evaluateExpression(amount.value));
const expressionPreview = computed(() => {
  if (/[+-]$/.test(amount.value)) return '继续输入金额';
  if (!/[+-]/.test(amount.value) || !expressionResult.value.valid) return '';
  const value = expressionResult.value.value;
  return `= ${value < 0 ? '-' : ''}¥${formatMoney(Math.abs(value))}`;
});
const keypadLayerStyle = computed(() => (
  keyboardInset.value > 0 ? { bottom: `${keyboardInset.value}px` } : null
));
const expressionInvalid = computed(() => (
  expressionResult.value.valid && !isValidExpression(amount.value)
));
const canSave = computed(() => isValidExpression(amount.value) && Boolean(selectedCategory.value));
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

const dateStatsLabel = computed(() => {
  const today = toDateInput(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const prefix = date.value === today
    ? '今天'
    : date.value === toDateInput(yesterday)
      ? '昨天'
      : dateLabel.value;
  return `${prefix} · ${dateStatsCount.value} 笔`;
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
  const keepCategory = !expense && !draft &&
    selectedCategory.value && categories.value.includes(selectedCategory.value)
    ? selectedCategory.value
    : '';
  selectedCategory.value = expense?.category || draft?.category || keepCategory || defaultCategory();
  note.value = expense?.note || draft?.note || '';
  date.value = draft?.date ||
    (expense?.spentAt ? toDateInput(expense.spentAt) : toDateInput(now));
  if (!expense && draft?.spentAt) date.value = toDateInput(draft.spentAt);
  showDatePicker.value = false;
  nextTick(revealSelectedCategory);
}

watch(recordSession, initialize);

watch(amountDisplay, () => {
  nextTick(() => {
    const element = amountValueRef.value;
    if (element) element.scrollLeft = element.scrollWidth;
  });
});

function updateKeyboardInset() {
  const viewport = window.visualViewport;
  if (!keyboardOpen.value || !viewport) {
    keyboardInset.value = 0;
    return;
  }
  // Detect the keyboard by its height alone; offsetTop only tells us how far
  // iOS scrolled the visual viewport, which must not hide a real keyboard.
  const keyboardHeight = window.innerHeight - viewport.height;
  if (keyboardHeight < 120) {
    keyboardInset.value = 0;
    return;
  }
  keyboardInset.value = Math.max(0, Math.round(keyboardHeight - viewport.offsetTop));
}

function scheduleKeyboardInset() {
  if (!keyboardOpen.value) return;
  updateKeyboardInset();
  window.clearTimeout(keyboardSyncTimer);
  // The keyboard/scroll settle a few frames after focus or text edits.
  keyboardSyncTimer = window.setTimeout(updateKeyboardInset, 120);
}

function usesSoftKeyboard() {
  return typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);
}

function onNoteFocus() {
  noteFocused.value = true;
  // Desktop keeps the on-screen keypad: there is no soft keyboard to replace
  // it, and typing the note works with the physical keyboard.
  if (!usesSoftKeyboard()) return;
  window.clearTimeout(keyboardCloseTimer);
  keyboardOpen.value = true;
  nextTick(scheduleKeyboardInset);
}

function onNoteBlur() {
  noteFocused.value = false;
  // Keep the number keypad hidden while the system keyboard settles back down.
  window.clearTimeout(keyboardCloseTimer);
  window.clearTimeout(keyboardSyncTimer);
  keyboardCloseTimer = window.setTimeout(() => {
    if (noteFocused.value) return;
    keyboardOpen.value = false;
    keyboardInset.value = 0;
  }, 200);
}

async function loadDateStats(dateKey) {
  const stage = currentStage.value;
  const token = ++dateStatsToken;
  if (!stage || !dateKey) {
    dateStatsCount.value = 0;
    return;
  }
  try {
    const items = await loadMonthExpenses(stage.id, dateKey.slice(0, 7));
    if (token !== dateStatsToken) return;
    dateStatsCount.value = items.filter((expense) => toDateInput(expense.spentAt) === dateKey).length;
  } catch (err) {
    if (token === dateStatsToken) dateStatsCount.value = 0;
  }
}

watch(
  [date, () => currentStage.value?.id, dataVersion, curtainOpen],
  ([dateKey]) => {
    if (!curtainOpen.value) return;
    loadDateStats(dateKey);
  },
  { immediate: true }
);

function revealSelectedCategory() {
  const strip = categoryStripRef.value;
  if (!strip) return;
  const chip = strip.querySelector('.record-category-cell.selected');
  if (!chip) return;
  const top = chip.offsetTop - (strip.clientHeight - chip.offsetHeight) / 2;
  strip.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

function hasUnsavedInput() {
  const expense = editingExpense.value;
  if (expense) {
    return (
      amount.value !== amountToInput(expense.amount) ||
      note.value !== (expense.note || '') ||
      selectedCategory.value !== expense.category ||
      date.value !== toDateInput(expense.spentAt)
    );
  }
  return Boolean(amount.value.trim() || note.value.trim());
}

async function closeGuard() {
  if (saving.value || !hasUnsavedInput()) return true;
  try {
    await showConfirmDialog({
      title: '还没记上呢',
      message: editingExpense.value
        ? '这一笔的修改还没保存，要收起来吗？'
        : '填好的内容还没记上，要收起来吗？',
      confirmButtonText: '收起来',
      cancelButtonText: '继续记',
      confirmButtonColor: DANGER_COLOR
    });
    return true;
  } catch (err) {
    return false;
  }
}

setCloseGuard(closeGuard);

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
  window.visualViewport?.addEventListener('resize', updateKeyboardInset);
  window.visualViewport?.addEventListener('scroll', updateKeyboardInset);
});

watch(curtainOpen, (open) => {
  if (open) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    nextTick(revealSelectedCategory);
  } else {
    showCategories.value = false;
    noteFocused.value = false;
    keyboardOpen.value = false;
    window.clearTimeout(keyboardCloseTimer);
    window.clearTimeout(keyboardSyncTimer);
    keyboardInset.value = 0;
    noteInput.value?.blur();
    document.body.style.overflow = previousOverflow;
  }
});

onUnmounted(() => {
  setCloseGuard(null);
  window.clearTimeout(keyboardCloseTimer);
  window.clearTimeout(keyboardSyncTimer);
  showCategories.value = false;
  document.body.style.overflow = previousOverflow;
  stopCurtainDrag();
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', measurePanel);
  window.visualViewport?.removeEventListener('resize', updateKeyboardInset);
  window.visualViewport?.removeEventListener('scroll', updateKeyboardInset);
});

function blurNote() {
  noteInput.value?.blur();
}

function clearNote() {
  note.value = '';
  noteInput.value?.focus();
}

function onDigit(digit) {
  amount.value = appendExpressionDigit(amount.value, digit);
}

function onDecimal() {
  amount.value = appendExpressionDecimal(amount.value);
}

function onDoubleZero() {
  amount.value = appendExpressionDoubleZero(amount.value);
}

function onOperator(operator) {
  amount.value = appendExpressionOperator(amount.value, operator);
}

function onBackspace() {
  amount.value = backspaceAmount(amount.value);
}

function onClear() {
  amount.value = clearAmount();
}

function chooseCategory(category) {
  selectedCategory.value = category;
  rememberCategory(category);
  haptic('light');
}

function openCategories() {
  haptic('light');
  showCategories.value = true;
}

function onCategoryCreated(name) {
  if (!name) return;
  selectedCategory.value = name;
  rememberCategory(name);
  showCategories.value = false;
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

  if (!isValidExpression(amount.value)) {
    showToast('金额要大于 0 哦');
    return;
  }
  const value = evaluateExpression(amount.value).value;

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
    resetRecord();
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
  const removed = await removeExpenseWithUndo(expense);
  if (!removed) return;
  resetRecord();
  if (backPath) router.back();
}

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.('button, input, textarea, select, a, .record-category-grid, .record-note-ghost, .number-keypad, .van-popup'));
}

function onCurtainPointerDown(event) {
  if (!curtainOpen.value || showDatePicker.value || showCategories.value) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (!event.isPrimary) return;

  // Tapping anywhere outside the note field should drop the system keyboard
  // (and restore the number keypad) before the tap does anything else.
  if (noteFocused.value && !event.target?.closest?.('.record-note-ghost')) {
    noteInput.value?.blur();
  }
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
    if (showCategories.value) {
      showCategories.value = false;
      return;
    }
    closeCurtain();
    return;
  }
  if (showCategories.value) return;
  if (/^\d$/.test(event.key)) {
    event.preventDefault();
    onDigit(event.key);
    return;
  }
  if (event.key === '.' || event.key === '。') {
    event.preventDefault();
    onDecimal();
    return;
  }
  if (event.key === '+' || event.key === '-') {
    event.preventDefault();
    onOperator(event.key);
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
