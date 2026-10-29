<template>
  <section class="record-pane">
    <header class="record-pane-head">
      <div class="record-summary-main">
        <span class="record-summary-meta">
          <span class="record-month-nav">
            <button class="record-month-arrow" type="button" aria-label="上个月" @click="shiftMonth(-1)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6"></path>
              </svg>
            </button>
            <button class="record-month-label" type="button" @click="showMonthPicker = true">
              {{ monthTitle }}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6"></path>
              </svg>
            </button>
            <button class="record-month-arrow" type="button" aria-label="下个月" @click="shiftMonth(1)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6"></path>
              </svg>
            </button>
          </span>
          <span v-if="expenseCount" class="record-summary-dot" aria-hidden="true">·</span>
          <span v-if="expenseCount" class="record-summary-count">{{ expenseCount }} 笔</span>
        </span>
        <span class="record-summary-title">{{ isCurrentMonth ? '本月支出' : '月度支出' }}</span>
      </div>
      <strong class="record-month-total">
        <span class="record-total-currency">¥</span>{{ formatMoney(total) }}
      </strong>
    </header>

    <div class="record-view-row">
      <div class="record-view-switch" aria-label="记账视图">
        <button
          type="button"
          :class="{ active: recordMode === 'tree' }"
          :aria-pressed="recordMode === 'tree'"
          @click="setRecordMode('tree')"
        >
          树形
        </button>
        <button
          type="button"
          :class="{ active: recordMode === 'list' }"
          :aria-pressed="recordMode === 'list'"
          @click="setRecordMode('list')"
        >
          列表
        </button>
      </div>
    </div>

    <div v-if="loading" class="record-loading">
      <span class="loading-dot"></span>
      正在看看这个月…
    </div>

    <template v-else-if="expenses.length">
      <div v-if="recordMode === 'tree'" class="record-tree">
      <div class="record-trunk" aria-hidden="true">
        <svg viewBox="0 0 22 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="record-trunk-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#d7b892"></stop>
              <stop offset="100%" stop-color="#b88b62"></stop>
            </linearGradient>
          </defs>
          <path d="M11 0 C 7 18, 15 34, 10 52 C 6 70, 14 84, 11 100"></path>
        </svg>
        <span class="record-trunk-root"></span>
      </div>

      <article
        v-for="(expense, index) in leaves"
        :key="expense.id"
        class="record-branch"
        :class="[
          index % 2 === 0 ? 'is-left' : 'is-right',
          { active: activeExpenseId === expense.id }
        ]"
        :style="{
          '--swatch': expense.color,
          '--branch-width': expense.branchWidth,
          '--branch-delay': `${Math.min(index, 8) * 35}ms`
        }"
      >
        <svg class="record-branch-arm" viewBox="0 0 26 34" preserveAspectRatio="none" aria-hidden="true">
          <path :d="index % 2 === 0 ? 'M26 34 C 20 34, 16 16, 0 16' : 'M0 34 C 6 34, 10 16, 26 16'"></path>
        </svg>

        <div class="record-leaf">
          <button
            class="record-leaf-main"
            type="button"
            :aria-expanded="activeExpenseId === expense.id"
            :aria-label="`${expense.category}，${expenseDate(expense)}${expense.noteText ? `，${expense.noteText}` : ''}，¥${formatMoney(expense.amount)}`"
            @click="toggleExpenseActions(expense)"
          >
            <span class="record-leaf-top">
              <span class="record-leaf-content">
                <span class="record-leaf-category">{{ expense.category }}</span>
                <span class="record-expense-date">{{ expenseDate(expense) }}</span>
              </span>
              <span class="record-leaf-amount">¥{{ formatMoney(expense.amount) }}</span>
            </span>
            <span v-if="expense.noteText" class="record-leaf-note" :title="expense.noteText">{{ expense.noteText }}</span>
          </button>

          <div v-if="activeExpenseId === expense.id" class="record-expense-actions">
            <button
              class="expense-action expense-action-edit"
              type="button"
              aria-label="编辑这笔支出"
              @click="editExpense(expense)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
              </svg>
            </button>
            <button
              class="expense-action expense-action-delete"
              type="button"
              aria-label="删除这笔支出"
              @click="deleteExpense(expense)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 7h16"></path>
                <path d="M9 7V5h6v2"></path>
                <path d="M7 7l1 12h8l1-12"></path>
                <path d="M10 11v4M14 11v4"></path>
              </svg>
            </button>
          </div>
        </div>
      </article>
      </div>

      <div v-else class="record-list">
        <div class="expense-list">
          <div
            v-for="group in groups"
            :key="group.key"
            class="day-group"
            :data-day="group.key"
            :class="{ expanded: isExpanded(group.key) }"
          >
            <button class="day-head" type="button" @click="toggleDay(group.key)">
              <span class="day-main">
                <span class="day-label">{{ group.label }}</span>
                <span class="day-count">{{ group.items.length }} 笔</span>
              </span>
              <span class="day-side">
                <span class="day-total">¥{{ formatMoney(group.total) }}</span>
                <svg class="day-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6"></path>
                </svg>
              </span>
            </button>

            <div v-if="isExpanded(group.key)" class="day-items">
              <ExpenseRow
                v-for="expense in group.items"
                :key="expense.id"
                :expense="expense"
                @edit="editExpense"
                @delete="deleteExpense"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="record-empty">
      <strong>这个月还没花钱</strong>
      <span>果冻在等第一笔</span>
    </div>

    <MonthPickerSheet
      v-model:show="showMonthPicker"
      :selected-month="month"
      @select="selectMonth"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import ExpenseRow from './ExpenseRow.vue';
import MonthPickerSheet from './MonthPickerSheet.vue';
import { useExpenseActions } from '../composables/useExpenseActions';
import { useLedger } from '../composables/useLedger';
import { useRecordEntry } from '../composables/useRecordEntry';
import { useRecordsView } from '../composables/useRecordsView';
import { categoryColor, dayKey, dayLabel, formatMoney, sumAmounts } from '../utils/format';
import { haptic } from '../utils/haptics';
import { addMonths, currentMonthKey, monthLabel, shortMonthLabel } from '../utils/months';

const { ready, currentStage, dataVersion, loadMonthExpenses } = useLedger();
const { removeExpense: removeExpenseAction } = useExpenseActions();
const record = useRecordEntry();
const { recordMode, recordMonth } = useRecordsView();

const month = ref(recordMonth.value || currentMonthKey());
const monthTitle = computed(() => (
  month.value.slice(0, 4) === String(new Date().getFullYear())
    ? shortMonthLabel(month.value)
    : monthLabel(month.value)
));
const isCurrentMonth = computed(() => month.value === currentMonthKey());
const showMonthPicker = ref(false);
const expenses = ref([]);
const loading = ref(true);
const activeExpenseId = ref(null);
const expandedKeys = ref(new Set());
let loadToken = 0;

const total = computed(() => sumAmounts(expenses.value));
const expenseCount = computed(() => expenses.value.length);

const groups = computed(() => {
  const map = new Map();
  for (const expense of expenses.value) {
    const key = dayKey(new Date(expense.spentAt));
    if (!map.has(key)) {
      map.set(key, { key, label: dayLabel(key), total: 0, items: [] });
    }
    const group = map.get(key);
    group.items.push(expense);
    group.total += Number(expense.amount) || 0;
  }
  return [...map.values()];
});

watch(
  () => groups.value[0]?.key,
  (key) => {
    if (!key || expandedKeys.value.has(key)) return;
    const next = new Set(expandedKeys.value);
    next.add(key);
    expandedKeys.value = next;
  },
  { immediate: true }
);

const leaves = computed(() => {
  if (!expenses.value.length) return [];
  const max = Math.max(1, ...expenses.value.map((expense) => Number(expense.amount) || 0));
  return expenses.value.map((expense) => {
    const amount = Number(expense.amount) || 0;
    return {
      ...expense,
      color: categoryColor(expense.category),
      branchWidth: (2 + Math.min(1, amount / max) * 5).toFixed(1),
      noteText: cleanNote(expense.note)
    };
  });
});

async function loadMonth() {
  if (!ready.value) {
    loading.value = true;
    return;
  }

  const stage = currentStage.value;
  const token = ++loadToken;
  if (!stage) {
    expenses.value = [];
    loading.value = false;
    return;
  }

  loading.value = true;
  try {
    const items = await loadMonthExpenses(stage.id, month.value);
    if (token !== loadToken) return;
    expenses.value = items;
  } finally {
    if (token === loadToken) loading.value = false;
  }
}

watch(
  [ready, dataVersion, () => currentStage.value?.id, month],
  loadMonth,
  { immediate: true }
);

watch(month, (value) => {
  recordMonth.value = value;
  activeExpenseId.value = null;
  expandedKeys.value = new Set();
});

watch(
  () => currentStage.value?.id,
  (id, previous) => {
    if (!id || id === previous) return;
    month.value = currentMonthKey();
  }
);

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true);
});

function onDocumentPointerDown(event) {
  if (!activeExpenseId.value) return;
  if (event.target?.closest?.('.record-branch')) return;
  activeExpenseId.value = null;
}

function toggleExpenseActions(expense) {
  haptic('light');
  activeExpenseId.value = activeExpenseId.value === expense.id ? null : expense.id;
}

function setRecordMode(mode) {
  if (recordMode.value === mode) return;
  activeExpenseId.value = null;
  recordMode.value = mode;
  haptic('light');
}

function shiftMonth(delta) {
  month.value = addMonths(month.value, delta);
  haptic('light');
}

function selectMonth(next) {
  showMonthPicker.value = false;
  if (next === month.value) return;
  month.value = next;
  haptic('light');
}

function isExpanded(key) {
  return expandedKeys.value.has(key);
}

function toggleDay(key) {
  const next = new Set(expandedKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedKeys.value = next;
}

function editExpense(expense) {
  haptic('light');
  activeExpenseId.value = null;
  record.openRecord(expense);
}

async function deleteExpense(expense) {
  activeExpenseId.value = null;
  await removeExpenseAction(expense);
}

function cleanNote(value) {
  return String(value || '')
    .replace(/(?:19|20)\d{2}\s*年\s*/g, '')
    .replace(/^(?:19|20)\d{2}[-/.]/, '')
    .trim();
}

function expenseDate(expense) {
  const date = new Date(expense.spentAt);
  return Number.isFinite(date.getTime())
    ? `${date.getMonth() + 1}月${date.getDate()}日`
    : '—';
}

</script>
