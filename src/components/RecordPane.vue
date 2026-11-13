<template>
  <section
    ref="rootRef"
    class="record-pane"
    :class="{ 'is-header-compact': headerCompact }"
  >
    <div class="record-header">
    <header class="record-pane-head">
      <img class="record-pane-cat" :src="catAvatar" alt="" aria-hidden="true">
      <div class="record-topbar">
        <button class="record-batch-entry" type="button" aria-label="一次记多笔" @click="openBatch">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M16 5H3"></path>
            <path d="M11 12H3"></path>
            <path d="M16 19H3"></path>
            <path d="M18 9v6"></path>
            <path d="M21 12h-6"></path>
          </svg>
          <span>多笔</span>
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
        <button class="record-topbar-button" type="button" aria-label="查明细" @click="openSearch">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"></circle>
            <path d="m20 20-3.5-3.5"></path>
          </svg>
        </button>
      </div>
    </header>

    <div class="record-month-bar">
      <MonthNav variant="record" :label="monthTitle" @shift="shiftMonth" @pick="showMonthPicker = true" />
      <div class="record-head-total">
        <span class="record-total-label">{{ monthTotalLabel }}</span>
        <strong class="record-month-total">
          <span class="record-total-currency">¥</span>{{ displayMoney(activeMonthTotal) }}
        </strong>
      </div>
    </div>
    <RecordPullHandle class="record-pane-pull" />
    <span v-if="showPullHint" class="record-pull-hint" aria-hidden="true">下拉记一笔</span>
    </div>

    <div ref="scrollRef" class="record-pane-scroll">
    <LoadingState v-if="loading" text="果冻在翻账本…" />

    <div v-else-if="feedError" class="record-empty">
      <strong>账本没翻成</strong>
      <span>果冻绊了一跤，再试一次吧</span>
      <button class="text-btn" type="button" @click="loadFeed">重新翻翻</button>
    </div>

    <template v-else>
    <div v-if="expenses.length" class="record-timeline">
      <section
        v-for="day in timelineDays"
        :key="day.key"
        class="timeline-day"
        :data-month="day.key.slice(0, 7)"
      >
        <button
          class="timeline-day-head"
          type="button"
          :aria-label="`查看 ${day.label} 的每日账单`"
          @click="openDay(day)"
        >
          <span class="timeline-day-main">
            <span class="timeline-day-node" :class="`heat-${day.heat}`" aria-hidden="true"></span>
            <span class="timeline-day-label">{{ day.label }}</span>
            <span class="timeline-day-summary">
              <span class="timeline-day-count">{{ day.items.length }} 笔</span>
              <span class="timeline-day-total">¥{{ displayMoney(day.total) }}</span>
            </span>
          </span>
        </button>

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
      <strong>果冻还没花过钱</strong>
      <span>记一笔试试嘛</span>
      <button class="secondary-btn" type="button" @click="record.openRecord()">记一笔</button>
    </div>

    <LoadingState v-if="loadingMore" inline text="再往前翻翻…" />
    </template>
    </div>

    <MonthPickerSheet
      v-model:show="showMonthPicker"
      :selected-month="activeMonth"
      @select="selectMonth"
    />

    <ExpenseActionSheets ref="rowActionsRef" />

    <Teleport to="body">
      <Transition name="daily-sheet">
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
            <strong class="daily-summary-total">¥{{ displayMoney(dailyTotal) }}</strong>
            <span class="daily-summary-count">{{ dailyExpenses.length }} 笔</span>
          </section>
        </div>

        <div class="daily-page-body">

          <LoadingState v-if="dailyLoading" text="果冻在翻这一天的账本…" />

          <div v-else-if="dailyError" class="record-empty">
            <strong>这一天没翻成</strong>
            <span>果冻绊了一跤，再试一次吧</span>
            <button class="text-btn" type="button" @click="loadDaily(dailyDate)">重新翻翻</button>
          </div>

          <div v-else-if="dailyExpenses.length" class="daily-list">
            <ExpenseRow
              v-for="expense in dailyExpenses"
              :key="expense.id"
              :expense="expense"
              @select="record.openRecord"
              @edit="record.openRecord"
              @delete="removeExpenseWithUndo"
              @menu="openRowMenu"
            />
          </div>

          <div v-else class="record-empty">
            <strong>果冻这天没花钱</strong>
            <span>换一天看看嘛</span>
          </div>
        </div>
      </div>
      </Transition>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { showToast } from 'vant';
import ExpenseActionSheets from './ExpenseActionSheets.vue';
import ExpenseRow from './ExpenseRow.vue';
import MonthNav from './MonthNav.vue';
import LoadingState from './LoadingState.vue';
import MonthPickerSheet from './MonthPickerSheet.vue';
import RecordLeaf from './RecordLeaf.vue';
import RecordPullHandle from './RecordPullHandle.vue';
import catAvatar from '../assets/cat-avatar.png';
import { useExpenseActions } from '../composables/useExpenseActions';
import { useLedger } from '../composables/useLedger';
import { useLedgerPanes } from '../composables/useLedgerPanes';
import { useRecordEntry } from '../composables/useRecordEntry';
import { useRecordsView } from '../composables/useRecordsView';
import { useSheets } from '../composables/useSheets';
import { displayMoney } from '../utils/money';
import { categoryColor, dayKey, sumAmounts, toDateInput } from '../utils/format';
import { groupExpensesByDay } from '../utils/expenses';
import { haptic } from '../utils/haptics';
import { addMonths, currentMonthKey, monthLabel, shortMonthLabel } from '../utils/months';

const { ready, currentStage, dataVersion, loadMonthExpenses, latestMonthBefore } = useLedger();
const { removeExpenseWithUndo } = useExpenseActions();
const { activePane, goToPane } = useLedgerPanes();
const record = useRecordEntry();
const { recordMonth, dailyOpen, dailyDate } = useRecordsView();
const sheets = useSheets();

const month = ref(recordMonth.value || currentMonthKey());
const visibleMonth = ref('');
const activeMonth = computed(() => visibleMonth.value || month.value);
const monthTitle = computed(() => (
  activeMonth.value.slice(0, 4) === String(new Date().getFullYear())
    ? shortMonthLabel(activeMonth.value)
    : monthLabel(activeMonth.value)
));
const monthTotalLabel = computed(() => {
  if (!activeMonth.value) return '本月支出';
  if (activeMonth.value === currentMonthKey()) return '本月支出';
  const [year, month] = activeMonth.value.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return '本月支出';
  return year === new Date().getFullYear() ? `${month}月支出` : `${year}年${month}月支出`;
});
const showMonthPicker = ref(false);
const showPullHint = ref(false);
const headerCompact = ref(false);
const rowActionsRef = ref(null);
const expenses = ref([]);
const loading = ref(true);
const feedError = ref(false);
const dailyExpenses = ref([]);
const dailyLoading = ref(false);
const dailyError = ref(false);
let loadToken = 0;
let dailyToken = 0;

const rootRef = ref(null);
const scrollRef = ref(null);
const loadedMonths = ref([]);
const feedDone = ref(false);
const loadingMore = ref(false);
let feedKey = '';
let filling = false;
let scrollEl = null;
let scrollRaf = 0;

const activeMonthExpenses = computed(() => (
  expenses.value.filter((e) => dayKey(new Date(e.spentAt)).slice(0, 7) === activeMonth.value)
));
const activeMonthTotal = computed(() => sumAmounts(activeMonthExpenses.value));

watch(expenses, () => {
  nextTick(updateVisibleMonth);
});
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
  })).sort((a, b) => (a.key < b.key ? 1 : -1))
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

function oldestMonth() {
  if (!loadedMonths.value.length) return month.value;
  return loadedMonths.value.reduce((min, key) => (key < min ? key : min), loadedMonths.value[0]);
}

async function appendMonth(stageId, monthKey, token) {
  if (loadedMonths.value.includes(monthKey)) return false;
  const items = await loadMonthExpenses(stageId, monthKey);
  if (token !== loadToken) return false;
  loadedMonths.value.push(monthKey);
  expenses.value = expenses.value.concat(items);
  return items.length > 0;
}

// 往更早的月份翻，跳过空月直到翻到有记录的月份（或到达下限）。
async function loadEarlier(stageId, token, maxLoops = 12) {
  let loops = 0;
  while (loops < maxLoops && token === loadToken && !feedDone.value) {
    const prev = addMonths(oldestMonth(), -1);
    if (prev < '2000-01') {
      feedDone.value = true;
      return;
    }
    const hasData = await appendMonth(stageId, prev, token);
    if (token !== loadToken) return;
    loops += 1;
    if (hasData) return;

    // The month was empty: jump straight to the latest month with data
    // instead of walking month by month through the whole gap.
    const jump = await latestMonthBefore(stageId, prev);
    if (token !== loadToken) return;
    if (!jump || jump >= prev) {
      feedDone.value = true;
      return;
    }
    const jumpedData = await appendMonth(stageId, jump, token);
    if (token !== loadToken) return;
    loops += 1;
    if (jumpedData) return;
  }
}

async function loadFeed() {
  const stage = currentStage.value;
  const token = ++loadToken;
  if (!ready.value) {
    loading.value = true;
    return;
  }
  if (!stage) {
    expenses.value = [];
    loadedMonths.value = [];
    feedDone.value = false;
    loading.value = false;
    return;
  }

  const key = `${stage.id}|${month.value}`;
  const fresh = key !== feedKey;

  loading.value = true;
  feedError.value = false;
  try {
    if (fresh) {
      loadedMonths.value = [];
      expenses.value = [];
      feedDone.value = false;
      await appendMonth(stage.id, month.value, token);
      if (token !== loadToken) return;
      // 当月没记账也继续往早翻，别让首屏空着
      if (!expenses.value.length) await loadEarlier(stage.id, token);
      if (token !== loadToken) return;
    } else {
      const keys = [...loadedMonths.value];
      const acc = [];
      for (const key of keys) {
        const items = await loadMonthExpenses(stage.id, key);
        if (token !== loadToken) return;
        acc.push(...items);
      }
      expenses.value = acc;
    }
    // 加载成功才记录 feedKey，失败后的重试会重新走 fresh 分支
    feedKey = key;
    if (token !== loadToken) return;
  } catch (err) {
    console.error('加载账本失败', err);
    if (token === loadToken) feedError.value = true;
  } finally {
    if (token === loadToken) loading.value = false;
  }
  ensureFilled();
}

async function loadMore() {
  const stage = currentStage.value;
  if (!stage || loading.value || loadingMore.value || feedDone.value) return;
  const token = ++loadToken;
  loadingMore.value = true;
  try {
    await loadEarlier(stage.id, token);
    if (token !== loadToken) return;
  } catch (err) {
    console.error('加载更早账目失败', err);
    showToast('再往前翻失败了，等会儿再试试');
  } finally {
    loadingMore.value = false;
  }
}

function needsMore() {
  const el = scrollEl;
  if (!el) return false;
  return el.scrollTop + el.clientHeight >= el.scrollHeight - 240;
}

async function ensureFilled() {
  if (filling) return;
  filling = true;
  try {
    let guard = 0;
    while (!feedDone.value && guard < 24 && needsMore()) {
      await loadMore();
      guard += 1;
    }
  } finally {
    filling = false;
  }
}

function updateVisibleMonth() {
  const root = rootRef.value;
  if (!root) return;
  const days = root.querySelectorAll('.timeline-day');
  if (!days.length) return;
  const contentTop = scrollEl?.getBoundingClientRect().top ?? 0;
  let current = null;
  for (const el of days) {
    if (el.getBoundingClientRect().bottom > contentTop) {
      current = el.dataset.month;
      break;
    }
  }
  if (current && current !== visibleMonth.value) visibleMonth.value = current;
}

function onScroll() {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    updateHeaderCompact();
    updateVisibleMonth();
    if (needsMore()) ensureFilled();
  });
}

function updateHeaderCompact() {
  const top = scrollEl?.scrollTop || 0;
  const next = top > 72;
  if (next !== headerCompact.value) headerCompact.value = next;
}

watch(
  [ready, dataVersion, () => currentStage.value?.id, month],
  loadFeed,
  { immediate: true }
);

watch(month, (value) => {
  recordMonth.value = value;
  visibleMonth.value = '';
  headerCompact.value = false;
  if (scrollEl) scrollEl.scrollTo({ top: 0, behavior: 'auto' });
});

watch(
  () => currentStage.value?.id,
  (id, previous) => {
    if (!id || id === previous) return;
    month.value = currentMonthKey();
  }
);

function openStages() {
  haptic('light');
  sheets.openStages();
}

function openBatch() {
  haptic('light');
  if (!currentStage.value) {
    sheets.openStageForm();
    return;
  }
  goToPane('batch');
}

function openSearch() {
  haptic('light');
  sheets.openSearch();
}

function shiftMonth(delta) {
  month.value = addMonths(activeMonth.value, delta);
  haptic('light');
}

function selectMonth(next) {
  showMonthPicker.value = false;
  if (next === activeMonth.value) return;
  month.value = next;
  haptic('light');
}

function openDaily(expense) {
  haptic('light');
  dailyOpen.value = true;
  dailyExpenses.value = [];
  dailyDate.value = dayKey(new Date(expense.spentAt));
}

function openDay(day) {
  haptic('light');
  dailyOpen.value = true;
  dailyExpenses.value = [];
  dailyDate.value = day.key;
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
  dailyError.value = false;
  try {
    const items = await loadMonthExpenses(stage.id, dateKey.slice(0, 7));
    if (token !== dailyToken) return;
    dailyExpenses.value = items.filter(
      (expense) => dayKey(new Date(expense.spentAt)) === dateKey
    );
  } catch (err) {
    console.error('加载每日账单失败', err);
    if (token === dailyToken) {
      dailyExpenses.value = [];
      dailyError.value = true;
    }
  } finally {
    if (token === dailyToken) dailyLoading.value = false;
  }
}

function onKeydown(event) {
  if (event.key === 'Escape' && dailyDate.value) {
    event.preventDefault();
    closeDaily();
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

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  scrollEl = scrollRef.value;
  if (scrollEl) scrollEl.addEventListener('scroll', onScroll, { passive: true });
  if (ready.value && !loading.value) ensureFilled();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  dailyOpen.value = false;
  dailyDate.value = '';
  clearTimeout(pullHintTimer);
  if (scrollEl) scrollEl.removeEventListener('scroll', onScroll);
  scrollEl = null;
  if (scrollRaf) cancelAnimationFrame(scrollRaf);
});

function cleanNote(value) {
  return String(value || '')
    .replace(/(?:19|20)\d{2}\s*年\s*/g, '')
    .replace(/^(?:19|20)\d{2}[-/.]/, '')
    .trim();
}

</script>
