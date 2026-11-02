<template>
  <section class="record-pane">
    <header class="record-pane-head">
      <img class="record-pane-cat" :src="catAvatar" alt="" aria-hidden="true">
      <div class="record-pane-card">
        <RecordPullHandle />
        <div class="record-pane-meta">
          <div class="record-month-nav">
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
          </div>
          <span class="record-meta-dot" aria-hidden="true"></span>
          <div class="record-head-total">
            <span class="record-total-label">花了</span>
            <strong class="record-month-total">
              <span class="record-total-currency">¥</span>{{ formatMoney(total) }}
            </strong>
          </div>
        </div>
      </div>
    </header>

    <div v-if="loading" class="record-loading">
      <span class="loading-dot"></span>
      果冻在翻这个月的小账本…
    </div>

    <div v-else-if="expenses.length" class="record-tree">
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

        <section
          v-for="(day, dayIndex) in treeDays"
          :key="day.key"
          class="record-day"
        >
          <button
            class="record-day-head"
            type="button"
            :aria-label="`${day.label}，${day.items.length} 笔，合计 ¥${formatMoney(day.total)}，消费热度 ${day.heat} 级`"
            :aria-expanded="!isDayCollapsed(day.key)"
            @click="toggleTreeDay(day.key)"
          >
            <span class="record-day-dot" :class="`heat-${day.heat}`" aria-hidden="true"></span>
            <span class="record-day-label">{{ day.label }}</span>
            <span class="record-day-meta">¥{{ formatMoney(day.total) }}</span>
            <svg
              class="record-day-chevron"
              :class="{ collapsed: isDayCollapsed(day.key) }"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6"></path>
            </svg>
          </button>

          <div v-if="!isDayCollapsed(day.key)" class="record-day-leaves">
            <article
              v-for="(expense, index) in day.leaves"
              :key="expense.id"
              class="record-branch"
              :style="{
                '--swatch': expense.color,
                '--branch-width': expense.branchWidth,
                '--branch-delay': `${Math.min(dayIndex * 3 + index, 12) * 35}ms`
              }"
            >
              <svg class="record-branch-arm" viewBox="0 0 20 18" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 1 C 0 11, 4 16, 20 16"></path>
              </svg>

              <div class="record-branch-main">
                <RecordLeaf
                  :expense="expense"
                  @select="openDaily"
                />
                <button
                  class="record-leaf-more"
                  type="button"
                  :aria-label="`更多操作：${expense.noteText || expense.category}`"
                  @click.stop="openRowMenu(expense)"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.6"></circle>
                    <circle cx="12" cy="12" r="1.6"></circle>
                    <circle cx="19" cy="12" r="1.6"></circle>
                  </svg>
                </button>
              </div>
            </article>
          </div>
        </section>
    </div>

    <div v-else class="record-empty">
      <strong>这个月果冻还没花钱</strong>
      <span>果冻在等第一笔</span>
    </div>

    <MonthPickerSheet
      v-model:show="showMonthPicker"
      :selected-month="month"
      @select="selectMonth"
    />

    <ExpenseActionSheets ref="rowActionsRef" />

    <Teleport to="body">
      <div v-if="dailyDate" class="daily-page">
        <header class="daily-page-head">
          <button class="daily-page-back" type="button" aria-label="返回月视图" @click="closeDaily">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M19 12H5"></path>
              <path d="m12 19-7-7 7-7"></path>
            </svg>
          </button>
          <h1>果冻的每日账单</h1>
          <span class="daily-page-spacer" aria-hidden="true"></span>
        </header>

        <div class="daily-page-body">
          <section class="daily-date-card">
            <button class="daily-date-arrow" type="button" aria-label="前一天" @click="shiftDaily(-1)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6"></path>
              </svg>
            </button>
            <div class="daily-date-main">
              <span class="daily-date-relative">
                <span v-if="dailyRelative" class="daily-date-relative-pill">{{ dailyRelative }}</span>
                <span>{{ dailyWeekday }}</span>
              </span>
              <strong class="daily-date-day">{{ dailyDayNumber }}</strong>
              <span class="daily-date-ym">{{ dailyYearMonth }}</span>
            </div>
            <button class="daily-date-arrow" type="button" aria-label="后一天" @click="shiftDaily(1)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6"></path>
              </svg>
            </button>
          </section>

          <section class="daily-summary">
            <span class="daily-summary-label">这天花了</span>
            <strong class="daily-summary-total">¥{{ formatMoney(dailyTotal) }}</strong>
            <span class="daily-summary-count">{{ dailyExpenses.length }} 笔</span>
          </section>

          <div v-if="dailyLoading" class="record-loading">
            <span class="loading-dot"></span>
            果冻在翻这一天的账本…
          </div>

          <div v-else-if="dailyExpenses.length" class="daily-list">
            <div
              v-for="expense in dailyExpenses"
              :key="expense.id"
              class="expense-row"
            >
              <ExpenseItem
                :expense="expense"
                @select="editExpense"
              />
              <button
                class="expense-more"
                type="button"
                :aria-label="`更多操作：${expense.note || expense.category}`"
                @click.stop="openRowMenu(expense)"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <circle cx="5" cy="12" r="1.6"></circle>
                  <circle cx="12" cy="12" r="1.6"></circle>
                  <circle cx="19" cy="12" r="1.6"></circle>
                </svg>
              </button>
            </div>
          </div>

          <div v-else class="record-empty">
            <strong>果冻这天没花钱</strong>
            <span>换一天看看嘛</span>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { showToast } from 'vant';
import ExpenseActionSheets from './ExpenseActionSheets.vue';
import ExpenseItem from './ExpenseItem.vue';
import MonthPickerSheet from './MonthPickerSheet.vue';
import RecordLeaf from './RecordLeaf.vue';
import RecordPullHandle from './RecordPullHandle.vue';
import catAvatar from '../assets/cat-avatar.png';
import { useLedger } from '../composables/useLedger';
import { useRecordEntry } from '../composables/useRecordEntry';
import { useRecordsView } from '../composables/useRecordsView';
import { categoryColor, dayKey, formatMoney, sumAmounts, toDateInput } from '../utils/format';
import { groupExpensesByDay } from '../utils/expenses';
import { haptic } from '../utils/haptics';
import { addMonths, currentMonthKey, monthLabel, shortMonthLabel } from '../utils/months';

const { ready, currentStage, dataVersion, loadMonthExpenses } = useLedger();
const record = useRecordEntry();
const { recordMonth, dailyOpen } = useRecordsView();

const month = ref(recordMonth.value || currentMonthKey());
const monthTitle = computed(() => (
  month.value.slice(0, 4) === String(new Date().getFullYear())
    ? shortMonthLabel(month.value)
    : monthLabel(month.value)
));
const showMonthPicker = ref(false);
const rowActionsRef = ref(null);
const expenses = ref([]);
const loading = ref(true);
const dailyDate = ref('');
const dailyExpenses = ref([]);
const dailyLoading = ref(false);
const collapsedDays = ref(new Set());
let treeDefaultMonth = '';
let loadToken = 0;
let dailyToken = 0;

const total = computed(() => sumAmounts(expenses.value));
const dailyTotal = computed(() => sumAmounts(dailyExpenses.value));
const dailyDateObj = computed(() => (
  dailyDate.value ? new Date(`${dailyDate.value}T12:00:00`) : null
));
const dailyRelative = computed(() => {
  if (!dailyDateObj.value) return '';
  const todayKey = toDateInput(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dailyDate.value === todayKey) return '今天';
  if (dailyDate.value === toDateInput(yesterday)) return '昨天';
  return '';
});
const dailyWeekday = computed(() => (
  dailyDateObj.value
    ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dailyDateObj.value.getDay()]
    : ''
));
const dailyDayNumber = computed(() => (
  dailyDateObj.value ? String(dailyDateObj.value.getDate()).padStart(2, '0') : ''
));
const dailyYearMonth = computed(() => (
  dailyDateObj.value
    ? `${dailyDateObj.value.getFullYear()}年${dailyDateObj.value.getMonth() + 1}月`
    : ''
));

const groups = computed(() => groupExpensesByDay(expenses.value));

const maxAmount = computed(() => (
  Math.max(1, ...expenses.value.map((expense) => Number(expense.amount) || 0))
));

function leafMeta(expense) {
  const amount = Number(expense.amount) || 0;
  return {
    ...expense,
    color: categoryColor(expense.category),
    branchWidth: (2 + Math.min(1, amount / maxAmount.value) * 5).toFixed(1),
    noteText: cleanNote(expense.note)
  };
}

const maxDayTotal = computed(() => (
  Math.max(1, ...groups.value.map((group) => group.total))
));

function dayHeat(total) {
  const ratio = total / maxDayTotal.value;
  if (ratio >= 0.85) return 4;
  if (ratio >= 0.6) return 3;
  if (ratio >= 0.35) return 2;
  return 1;
}

const treeDays = computed(() => (
  groups.value.map((group) => ({
    ...group,
    heat: dayHeat(group.total),
    leaves: group.items.map(leafMeta)
  }))
));

const HEAT_HINT_KEY = 'recordHeatHintSeen';
let heatHintShown = false;

function maybeShowHeatHint(days) {
  if (heatHintShown || !days.length) return;
  heatHintShown = true;
  try {
    if (localStorage.getItem(HEAT_HINT_KEY)) return;
    localStorage.setItem(HEAT_HINT_KEY, '1');
  } catch (err) {
    // localStorage can be unavailable in private modes.
  }
  showToast({ message: '圆点越大，这天果冻花得越多', position: 'bottom' });
}

watch(
  treeDays,
  (days) => {
    if (!days.length) return;
    if (treeDefaultMonth !== month.value) {
      treeDefaultMonth = month.value;
      collapsedDays.value = new Set(days.slice(1).map((day) => day.key));
    }
    maybeShowHeatHint(days);
  },
  { immediate: true }
);

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
  collapsedDays.value = new Set();
  treeDefaultMonth = '';
});

watch(
  () => currentStage.value?.id,
  (id, previous) => {
    if (!id || id === previous) return;
    treeDefaultMonth = '';
    collapsedDays.value = new Set();
    month.value = currentMonthKey();
  }
);

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

function isDayCollapsed(key) {
  return collapsedDays.value.has(key);
}

function toggleTreeDay(key) {
  const next = new Set(collapsedDays.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  collapsedDays.value = next;
  haptic('light');
}

function openDaily(expense) {
  haptic('light');
  dailyOpen.value = true;
  dailyExpenses.value = [];
  dailyDate.value = dayKey(new Date(expense.spentAt));
}

function closeDaily() {
  dailyOpen.value = false;
  dailyDate.value = '';
  dailyExpenses.value = [];
  dailyLoading.value = false;
}

function shiftDaily(delta) {
  if (!dailyDate.value) return;
  const date = new Date(`${dailyDate.value}T12:00:00`);
  date.setDate(date.getDate() + delta);
  dailyExpenses.value = [];
  dailyDate.value = toDateInput(date);
  haptic('light');
}

async function loadDaily(dateKey) {
  const stage = currentStage.value;
  const token = ++dailyToken;
  if (!stage || !dateKey) {
    dailyExpenses.value = [];
    dailyLoading.value = false;
    return;
  }
  dailyLoading.value = true;
  try {
    const items = await loadMonthExpenses(stage.id, dateKey.slice(0, 7));
    if (token !== dailyToken) return;
    dailyExpenses.value = items.filter(
      (expense) => dayKey(new Date(expense.spentAt)) === dateKey
    );
  } finally {
    if (token === dailyToken) dailyLoading.value = false;
  }
}

function editExpense(expense) {
  haptic('light');
  record.openRecord(expense);
}

function openRowMenu(expense) {
  rowActionsRef.value?.open(expense);
}

watch(
  [dailyDate, dataVersion, () => currentStage.value?.id],
  () => {
    if (dailyDate.value) loadDaily(dailyDate.value);
  }
);

onBeforeUnmount(() => {
  dailyOpen.value = false;
});

function cleanNote(value) {
  return String(value || '')
    .replace(/(?:19|20)\d{2}\s*年\s*/g, '')
    .replace(/^(?:19|20)\d{2}[-/.]/, '')
    .trim();
}

</script>
