<template>
  <section class="record-pane">
    <div class="record-header">
    <header class="record-pane-head">
      <img class="record-pane-cat" :src="catAvatar" alt="" aria-hidden="true">
      <div class="record-topbar">
        <button class="record-topbar-button" type="button" aria-label="账本" @click="goLedgers">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="12" height="16" rx="2"></rect>
            <path d="M7 8h4M7 12h3"></path>
            <path d="M8 20h10.5a2.5 2.5 0 0 0 2.5-2.5V6"></path>
          </svg>
        </button>
        <button
          class="record-topbar-title"
          type="button"
          :aria-label="`切换账本：${currentStage?.name || '选择账本'}`"
          @click="openStages"
        >
          <span class="record-topbar-name">{{ currentStage?.name || '选择账本' }}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6"></path>
          </svg>
        </button>
        <button class="record-topbar-button" type="button" aria-label="搜索支出" @click="openSearch">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"></circle>
            <path d="m20 20-3.5-3.5"></path>
          </svg>
        </button>
      </div>
    </header>

    <div class="record-month-bar">
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
      <div class="record-head-total">
        <span class="record-total-label">本月 {{ expenses.length }} 笔</span>
        <strong class="record-month-total">
          <span class="record-total-currency">¥</span>{{ formatMoney(total) }}
        </strong>
      </div>
    </div>
    <RecordPullHandle class="record-pane-pull" />
    <span v-if="showPullHint" class="record-pull-hint" aria-hidden="true">下拉记一笔</span>
    </div>

    <div v-if="loading" class="record-loading">
      <span class="loading-dot"></span>
      果冻在翻这个月的小账本…
    </div>

    <div v-else-if="expenses.length" class="record-timeline">
      <section
        v-for="day in timelineDays"
        :key="day.key"
        class="timeline-day"
      >
        <div class="timeline-day-head">
          <div class="timeline-day-main">
            <span class="timeline-day-node" :class="`heat-${day.heat}`" aria-hidden="true"></span>
            <span class="timeline-day-label">{{ day.label }}</span>
            <span class="timeline-day-summary">
              <span class="timeline-day-count">{{ day.items.length }} 笔</span>
              <span class="timeline-day-total">¥{{ formatMoney(day.total) }}</span>
            </span>
          </div>
        </div>

        <div class="timeline-items">
          <RecordLeaf
            v-for="expense in day.items"
            :key="expense.id"
            :expense="expense"
            :style="{ '--swatch': expense.color }"
            @select="openDaily"
            @menu="openRowMenu"
          />
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
        <div class="daily-header">
          <header class="daily-page-head">
            <button class="daily-page-back" type="button" aria-label="返回月视图" @click="closeDaily">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M19 12H5"></path>
                <path d="m12 19-7-7 7-7"></path>
              </svg>
            </button>
            <h1>每日账单</h1>
            <span class="daily-page-spacer" aria-hidden="true"></span>
          </header>

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
        </div>

        <div class="daily-page-body">

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
              <ExpenseItem :expense="expense" readonly />
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
import { useLedgerPanes } from '../composables/useLedgerPanes';
import { useRecordEntry } from '../composables/useRecordEntry';
import { useRecordsView } from '../composables/useRecordsView';
import { useSheets } from '../composables/useSheets';
import { categoryColor, dayKey, formatMoney, sumAmounts, toDateInput } from '../utils/format';
import { groupExpensesByDay } from '../utils/expenses';
import { haptic } from '../utils/haptics';
import { addMonths, currentMonthKey, monthLabel, shortMonthLabel } from '../utils/months';

const { ready, currentStage, dataVersion, loadMonthExpenses } = useLedger();
const { activePane, goToPane } = useLedgerPanes();
const record = useRecordEntry();
const { recordMonth, dailyOpen, dailyDate } = useRecordsView();
const sheets = useSheets();

const month = ref(recordMonth.value || currentMonthKey());
const monthTitle = computed(() => (
  month.value.slice(0, 4) === String(new Date().getFullYear())
    ? shortMonthLabel(month.value)
    : monthLabel(month.value)
));
const showMonthPicker = ref(false);
const showPullHint = ref(false);
const rowActionsRef = ref(null);
const expenses = ref([]);
const loading = ref(true);
const dailyExpenses = ref([]);
const dailyLoading = ref(false);
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

function itemMeta(expense) {
  return {
    ...expense,
    color: categoryColor(expense.category),
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

const timelineDays = computed(() => (
  groups.value.map((group) => ({
    ...group,
    label: group.label.replace(/\s*周[日一二三四五六]$/, ''),
    heat: dayHeat(group.total),
    items: group.items.map(itemMeta)
  }))
));

const HEAT_HINT_KEY = 'recordHeatHintSeen';
const PULL_HINT_KEY = 'recordPullHintSeen';
let pullHintTimer = null;
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
  timelineDays,
  (days) => {
    if (days.length) maybeShowHeatHint(days);
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
});

watch(
  () => currentStage.value?.id,
  (id, previous) => {
    if (!id || id === previous) return;
    month.value = currentMonthKey();
  }
);

function goLedgers() {
  haptic('light');
  goToPane('home');
}

function openStages() {
  haptic('light');
  sheets.openStages();
}

function openSearch() {
  haptic('light');
  sheets.openSearch();
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

function openRowMenu(expense) {
  rowActionsRef.value?.open(expense);
}

watch(
  [dailyDate, dataVersion, () => currentStage.value?.id],
  () => {
    if (dailyDate.value) loadDaily(dailyDate.value);
  },
  { immediate: true }
);

function maybeShowPullHint() {
  if (showPullHint.value || pullHintTimer) return;
  try {
    if (localStorage.getItem(PULL_HINT_KEY)) return;
    localStorage.setItem(PULL_HINT_KEY, '1');
  } catch (err) {
    return;
  }
  showPullHint.value = true;
  pullHintTimer = setTimeout(() => {
    showPullHint.value = false;
    pullHintTimer = null;
  }, 4500);
}

watch(
  activePane,
  (pane) => {
    if (pane === 'record') maybeShowPullHint();
  },
  { immediate: true }
);

watch(
  () => record.curtainOpen.value,
  (open) => {
    if (!open) return;
    clearTimeout(pullHintTimer);
    pullHintTimer = null;
    showPullHint.value = false;
  }
);

onBeforeUnmount(() => {
  dailyOpen.value = false;
  dailyDate.value = '';
  clearTimeout(pullHintTimer);
});

function cleanNote(value) {
  return String(value || '')
    .replace(/(?:19|20)\d{2}\s*年\s*/g, '')
    .replace(/^(?:19|20)\d{2}[-/.]/, '')
    .trim();
}

</script>
