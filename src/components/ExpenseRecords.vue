<template>
  <section class="expense-section" aria-label="支出明细">
    <div class="expense-sticky">
      <MonthNav :label="monthLabel(selectedMonth)" @shift="shiftMonth" @pick="showMonthPicker = true">
        <template #actions>
          <button
            class="section-icon"
            type="button"
            aria-label="小票"
            @click="goDiary"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5"></circle>
              <path d="M12 7.5V12l3 2"></path>
            </svg>
          </button>
          <button
            v-if="currentStageStats.count"
            class="section-icon"
            type="button"
            aria-label="查明细"
            @click="sheets.openSearch()"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5"></circle>
              <path d="m16 16 4 4"></path>
            </svg>
          </button>
        </template>
      </MonthNav>

      <div class="month-summary">
        <div class="month-summary-left">
          <span class="month-total">¥{{ displayMoney(monthTotal) }}</span>
          <span class="month-count">{{ monthExpenses.length }} 笔</span>
        </div>
      </div>
    </div>

    <template v-if="currentStageStats.count">
      <div class="list-view">
        <div v-if="!monthExpenses.length" class="list-empty">
          <p>这个月果冻还没花钱</p>
          <button class="text-btn" type="button" @click="addForSelectedDay">补记这一天</button>
        </div>

        <div v-else class="expense-list">
          <div
            v-for="group in filteredGroups"
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
                <span class="day-total">¥{{ displayMoney(group.total) }}</span>
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
                @select="record.openRecord"
                @edit="record.openRecord"
                @delete="removeExpenseWithUndo"
                @menu="openRowMenu"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="list-empty">
      <p>果冻还没记过账</p>
      <span>点「批量记」说一句，或下拉「记一笔」</span>
    </div>

    <MonthPickerSheet
      v-model:show="showMonthPicker"
      :selected-month="selectedMonth"
      @select="selectMonth"
    />

    <ExpenseActionSheets ref="rowActionsRef" />

  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import ExpenseActionSheets from './ExpenseActionSheets.vue';
import ExpenseRow from './ExpenseRow.vue';
import MonthNav from './MonthNav.vue';
import MonthPickerSheet from './MonthPickerSheet.vue';
import { useExpenseActions } from '../composables/useExpenseActions';
import { useLedger } from '../composables/useLedger';
import { useRecordEntry } from '../composables/useRecordEntry';
import { useSheets } from '../composables/useSheets';
import { useRecordsView } from '../composables/useRecordsView';
import { displayMoney } from '../utils/money';
import {
  dayKey,
  sumAmounts,
  toDateInput
} from '../utils/format';
import { groupExpensesByDay } from '../utils/expenses';
import { addMonths, currentMonthKey, monthLabel } from '../utils/months';
import { haptic } from '../utils/haptics';

const {
  currentStage,
  currentStageStats,
  dataVersion,
  latestMonthForStage,
  loadMonthExpenses
} = useLedger();
const { removeExpenseWithUndo } = useExpenseActions();
const record = useRecordEntry();
const sheets = useSheets();
const router = useRouter();
const {
  selectedMonth,
  selectedDate,
  stageId
} = useRecordsView();

const todayKey = toDateInput(new Date());
const currentMonth = currentMonthKey();
const showMonthPicker = ref(false);
const rowActionsRef = ref(null);
const expandedKeys = ref(new Set());
const loadedMonthExpenses = ref([]);
let loadToken = 0;

if (!selectedMonth.value || stageId.value !== currentStage.value?.id) {
  stageId.value = currentStage.value?.id || null;
  selectedMonth.value = currentStage.value
    ? latestMonthForStage(currentStage.value.id)
    : currentMonth;
  selectedDate.value = '';
}

const monthExpenses = computed(() => loadedMonthExpenses.value);

const monthTotal = computed(() => sumAmounts(monthExpenses.value));

function openRowMenu(expense) {
  rowActionsRef.value?.open(expense);
}

const filteredGroups = computed(() => groupExpensesByDay(monthExpenses.value));

function emptyDateForMonth(month) {
  return month === currentMonth ? todayKey : `${month}-01`;
}

function settleSelection(preserveDate = false) {
  const items = monthExpenses.value;
  const keepDate = preserveDate &&
    selectedDate.value &&
    items.some((expense) => dayKey(new Date(expense.spentAt)) === selectedDate.value);

  if (!keepDate) {
    selectedDate.value = items[0]
      ? dayKey(new Date(items[0].spentAt))
      : emptyDateForMonth(selectedMonth.value);
  }

  const expandedDay = items.some(
    (expense) => dayKey(new Date(expense.spentAt)) === selectedDate.value
  )
    ? selectedDate.value
    : '';
  expandedKeys.value = new Set(expandedDay ? [expandedDay] : []);
}

async function loadMonthData(month, preserveDate = false) {
  const stage = currentStage.value;
  const token = ++loadToken;

  if (!stage) {
    loadedMonthExpenses.value = [];
    settleSelection(false);
    return;
  }

  const items = await loadMonthExpenses(stage.id, month);
  if (token !== loadToken) return;
  loadedMonthExpenses.value = items;
  settleSelection(preserveDate);
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

function goDiary() {
  haptic('light');
  router.push('/diary');
}

function addForSelectedDay() {
  haptic('light');
  record.openRecord(null, { date: selectedDate.value });
}

function shiftMonth(delta) {
  selectedMonth.value = addMonths(selectedMonth.value, delta);
  haptic('light');
}

function selectMonth(month) {
  selectedMonth.value = month;
  haptic('light');
}

watch(
  () => filteredGroups.value[0]?.key,
  (key) => {
    if (!key || expandedKeys.value.has(key)) return;
    const next = new Set(expandedKeys.value);
    next.add(key);
    expandedKeys.value = next;
  },
  { immediate: true }
);

watch(
  [selectedMonth, () => currentStage.value?.id, dataVersion],
  async ([month, id], previous) => {
    const previousId = previous?.[1];
    const previousMonth = previous?.[0];

    if (id !== stageId.value) {
      stageId.value = id || null;
      selectedDate.value = '';
      const latest = id ? latestMonthForStage(id) : currentMonth;
      if (month !== latest) {
        selectedMonth.value = latest;
        return;
      }
    }

    if (!id) {
      loadedMonthExpenses.value = [];
      settleSelection(false);
      return;
    }

    const isDataRefresh = Boolean(previous) && previousId === id && previousMonth === month;
    await loadMonthData(month, isDataRefresh);
  },
  { immediate: true }
);
</script>
