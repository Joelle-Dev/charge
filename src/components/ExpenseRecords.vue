<template>
  <section class="expense-section" aria-label="支出明细">
    <div class="expense-sticky">
      <div class="month-nav">
        <button class="month-arrow" type="button" aria-label="上个月" @click="shiftMonth(-1)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6"></path>
          </svg>
        </button>
        <button class="month-label" type="button" @click="showMonthPicker = true">
          {{ monthLabel(selectedMonth) }}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6"></path>
          </svg>
        </button>
        <button class="month-arrow" type="button" aria-label="下个月" @click="shiftMonth(1)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6"></path>
          </svg>
        </button>
        <div class="month-nav-actions">
          <button
            class="section-icon"
            type="button"
            aria-label="历史支出"
            @click="goHistory"
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
            aria-label="搜索明细"
            @click="sheets.openSearch()"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5"></circle>
              <path d="m16 16 4 4"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="month-summary">
        <div class="month-summary-left">
          <span class="month-total">¥{{ formatMoney(monthTotal) }}</span>
          <span class="month-count">{{ monthExpenses.length }} 笔</span>
        </div>
      </div>
    </div>

    <template v-if="currentStageStats.count">
      <div v-if="viewMode === 'calendar'" ref="calendarViewRef" class="calendar-view">
        <ExpenseCalendar
          :month="selectedMonth"
          :expenses="monthExpenses"
          :selected-date="selectedDate"
          @select-day="selectDay"
        />

        <div
          v-if="dayPopover.show"
          ref="dayPopoverRef"
          class="day-popover"
          :class="{ 'is-ready': dayPopover.ready, 'is-top': dayPopover.placement === 'top' }"
          :style="{ top: `${dayPopover.top}px`, left: `${dayPopover.left}px`, '--arrow-x': `${dayPopover.arrowX}px` }"
          role="dialog"
          :aria-label="`${selectedDayLabel} 支出`"
        >
          <div class="day-pop-head">
            <div class="day-pop-heading">
              <strong>{{ selectedDayLabel }}</strong>
              <span v-if="selectedDayExpenses.length">
                {{ selectedDayExpenses.length }} 笔 · ¥{{ formatMoney(selectedDayTotal) }}
              </span>
              <span v-else>没有支出</span>
            </div>
            <button class="day-pop-close" type="button" aria-label="关闭当天明细" @click="closeDayPopover">
              ×
            </button>
          </div>

          <div v-if="selectedDayExpenses.length" class="day-pop-list">
            <div
              v-for="expense in selectedDayExpenses"
              :key="expense.id"
              class="day-pop-row"
              :style="{ '--swatch': categoryColor(expense.category) }"
            >
              <span class="day-pop-icon">{{ (expense.category || '其他').slice(0, 1) }}</span>
              <span class="day-pop-main">
                <strong>{{ expense.note || expense.category }}</strong>
                <small>{{ expense.category }} · {{ formatTime(expense.spentAt) }}</small>
              </span>
              <span class="day-pop-amount">¥{{ formatMoney(expense.amount) }}</span>
            </div>
          </div>
          <p v-else class="day-pop-empty">果冻这天没花钱</p>

          <div v-if="selectedDayExpenses.length" class="day-pop-actions">
            <span class="day-pop-hint">日历仅展示</span>
            <button class="text-btn" type="button" @click="editInList">去列表修改</button>
          </div>
        </div>
      </div>

      <div v-else class="list-view">
        <div v-if="!monthExpenses.length" class="list-empty">
          <p>这个月还没有支出</p>
          <button class="text-btn" type="button" @click="addForSelectedDay">补记这天</button>
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
                @edit="record.openRecord"
                @delete="removeExpense"
              />
            </div>
          </div>
        </div>


      </div>
    </template>

    <div v-else class="list-empty">
      <p>还没有支出</p>
      <span>点下面的麦克风，说一句就记上</span>
    </div>

    <Teleport to="body">
      <div
        v-if="showActions"
        class="records-actions"
        aria-label="明细操作"
      >
        <button
          class="records-action"
          type="button"
          :aria-label="viewMode === 'calendar' ? '切换到列表' : '切换到日历'"
          @click="toggleCalendar"
        >
          <svg
            v-if="viewMode === 'calendar'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M8 6h12M8 12h12M8 18h12"></path>
            <path d="M4 6h.01M4 12h.01M4 18h.01"></path>
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="3.5" y="5" width="17" height="15.5" rx="3"></rect>
            <path d="M8 3v4M16 3v4M3.5 10h17"></path>
          </svg>
          <span>{{ viewMode === 'calendar' ? '列表' : '日历' }}</span>
        </button>
      </div>
    </Teleport>

    <MonthPickerSheet
      v-model:show="showMonthPicker"
      :selected-month="selectedMonth"
      @select="selectMonth"
    />

  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ExpenseRow from './ExpenseRow.vue';
import ExpenseCalendar from './ExpenseCalendar.vue';
import MonthPickerSheet from './MonthPickerSheet.vue';
import { useExpenseActions } from '../composables/useExpenseActions';
import { useLedger } from '../composables/useLedger';
import { useLedgerPanes } from '../composables/useLedgerPanes';
import { useRecordEntry } from '../composables/useRecordEntry';
import { useSheets } from '../composables/useSheets';
import { useRecordsView } from '../composables/useRecordsView';
import {
  categoryColor,
  dayKey,
  dayLabel,
  formatMoney,
  formatTime,
  sumAmounts,
  toDateInput
} from '../utils/format';
import { addMonths, currentMonthKey, monthLabel } from '../utils/months';
import { haptic } from '../utils/haptics';

const {
  currentStage,
  currentStageStats,
  dataVersion,
  latestMonthForStage,
  loadMonthExpenses
} = useLedger();
const { removeExpense } = useExpenseActions();
const record = useRecordEntry();
const sheets = useSheets();
const { activePane } = useLedgerPanes();
const route = useRoute();
const router = useRouter();
const {
  viewMode,
  selectedMonth,
  selectedDate,
  stageId
} = useRecordsView();

const todayKey = toDateInput(new Date());
const currentMonth = currentMonthKey();
const showMonthPicker = ref(false);
const expandedKeys = ref(new Set());
const loadedMonthExpenses = ref([]);
const calendarViewRef = ref(null);
const dayPopoverRef = ref(null);
const dayPopover = reactive({
  show: false,
  ready: false,
  top: 0,
  left: 0,
  placement: 'bottom',
  arrowX: 0
});
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

const showActions = computed(() => (
  route.path === '/records' || (route.path === '/' && activePane.value === 'records')
));

const filteredGroups = computed(() => {
  const groups = new Map();
  for (const expense of monthExpenses.value) {
    const key = dayKey(new Date(expense.spentAt));
    if (!groups.has(key)) {
      groups.set(key, { key, label: dayLabel(key), total: 0, items: [] });
    }
    const group = groups.get(key);
    group.items.push(expense);
    group.total += Number(expense.amount) || 0;
  }
  return [...groups.values()];
});

const selectedDayExpenses = computed(() =>
  monthExpenses.value.filter((expense) => dayKey(new Date(expense.spentAt)) === selectedDate.value)
);
const selectedDayTotal = computed(() => sumAmounts(selectedDayExpenses.value));
const selectedDayLabel = computed(() => dayLabel(selectedDate.value));

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

function setView(mode) {
  if (viewMode.value === mode) return;
  closeDayPopover();
  viewMode.value = mode;
  haptic('light');
  if (mode === 'list') {
    const first = monthExpenses.value[0];
    expandedKeys.value = new Set(first ? [dayKey(new Date(first.spentAt))] : []);
  }
}

function toggleCalendar() {
  setView(viewMode.value === 'calendar' ? 'list' : 'calendar');
}

function goHistory() {
  closeDayPopover();
  haptic('light');
  router.push('/history');
}

function closeDayPopover() {
  if (!dayPopover.show) return;
  dayPopover.show = false;
  dayPopover.ready = false;
}

function positionDayPopover() {
  const wrap = calendarViewRef.value;
  const pop = dayPopoverRef.value;
  if (!wrap || !pop) return;

  const cell = wrap.querySelector(`.calendar-day[data-date="${selectedDate.value}"]`);
  if (!cell) return;

  const wrapRect = wrap.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  const pad = 8;
  const gap = 8;
  const wrapW = wrap.clientWidth;
  const wrapH = wrap.clientHeight;
  const popW = pop.offsetWidth;
  const popH = pop.offsetHeight;
  const cellCenter = cellRect.left - wrapRect.left + cellRect.width / 2;
  const cellTop = cellRect.top - wrapRect.top;
  const cellBottom = cellRect.bottom - wrapRect.top;

  const left = Math.min(
    Math.max(cellCenter - popW / 2, pad),
    Math.max(pad, wrapW - popW - pad)
  );
  let top = cellBottom + gap;
  let placement = 'bottom';

  if (top + popH > wrapH - pad) {
    const above = cellTop - popH - gap;
    if (above >= pad) {
      placement = 'top';
      top = above;
    } else {
      top = Math.max(pad, wrapH - popH - pad);
    }
  }

  dayPopover.placement = placement;
  dayPopover.top = Math.round(top);
  dayPopover.left = Math.round(left);
  dayPopover.arrowX = Math.round(
    Math.min(Math.max(cellCenter - left, 18), Math.max(18, popW - 18))
  );
}

async function selectDay(dateKey) {
  if (dayPopover.show && selectedDate.value === dateKey) {
    closeDayPopover();
    return;
  }

  const wasOpen = dayPopover.show;
  selectedDate.value = dateKey;
  haptic('light');
  dayPopover.show = true;
  if (!wasOpen) dayPopover.ready = false;

  await nextTick();
  positionDayPopover();
  dayPopover.ready = true;
}

async function editInList() {
  const date = selectedDate.value;
  closeDayPopover();
  viewMode.value = 'list';
  haptic('light');
  expandedKeys.value = new Set(date ? [date] : []);
  await nextTick();
  document
    .querySelector(`.list-view .day-group[data-day="${date}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function addForSelectedDay() {
  closeDayPopover();
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

function onDocumentPointerDown(event) {
  if (!dayPopover.show) return;
  if (calendarViewRef.value?.contains(event.target)) return;
  closeDayPopover();
}

function onResize() {
  if (dayPopover.show) positionDayPopover();
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
    closeDayPopover();
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

onMounted(() => {
  window.addEventListener('resize', onResize);
  document.addEventListener('pointerdown', onDocumentPointerDown);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  document.removeEventListener('pointerdown', onDocumentPointerDown);
});
</script>
