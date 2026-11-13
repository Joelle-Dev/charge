<template>
  <section class="report-page">
    <div class="report-bar">
      <button class="report-month-arrow" type="button" aria-label="上个月" @click="shiftMonth(-1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6"></path>
        </svg>
      </button>
      <button
        class="report-month-current"
        type="button"
        title="翻到别的月份"
        aria-label="翻到别的月份"
        @click="openMonthPicker"
      >
        {{ monthText }}
      </button>
      <button
        class="report-month-arrow"
        type="button"
        aria-label="下个月"
        :disabled="isCurrentMonth"
        @click="shiftMonth(1)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9 6 6 6-6 6"></path>
        </svg>
      </button>
      <button
        v-if="!isCurrentMonth"
        class="report-month-reset"
        type="button"
        aria-label="回到本月"
        @click="goCurrentMonth"
      >
        今
      </button>
      <span class="report-bar-spacer"></span>
      <div class="report-scope-switch" role="group" aria-label="统计范围">
        <button
          type="button"
          aria-label="当前账本"
          title="只看当前账本"
          :disabled="!currentStage"
          :class="{ active: stageScope === 'current' }"
          @click="setScope('current')"
        >
          当前
        </button>
        <button
          type="button"
          aria-label="全部账本"
          title="合并全部账本"
          :class="{ active: stageScope === 'all' }"
          @click="setScope('all')"
        >
          全部
        </button>
      </div>
    </div>

    <LoadingState v-if="loading" text="猫猫在打这个小票…" />

    <div v-else-if="loadError" class="list-empty">
      <p>小票被猫猫抓花了</p>
      <span>果冻绊了一跤，再试一次吧</span>
      <button class="text-btn" type="button" @click="loadReport">重新写写</button>
    </div>

    <div v-else-if="!scopeStageIds.length" class="list-empty">
      <p>先给果冻建个账本吧</p>
      <span>有账本才能打小票</span>
      <button class="secondary-btn" type="button" @click="openStageForm">建个账本</button>
    </div>

    <template v-else>
      <div class="receipt-export">
      <div class="receipt-toolbar">
        <button class="receipt-detail-btn" type="button" @click="openDetail">
          <span>看这个月的明细</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6"></path>
          </svg>
        </button>
      </div>
      <div ref="receiptRef" :key="month" class="receipt-paper">
      <div class="receipt-body">
        <span class="receipt-slip-tag" aria-hidden="true">猫猫联</span>
        <header class="receipt-head">
          <span class="receipt-brand">守财小果</span>
          <span class="receipt-brand-sub">MONTHLY RECEIPT</span>
          <span class="receipt-month-title">{{ monthText }}</span>
          <span class="receipt-meta-line">
            <span>桌号 <b class="receipt-table-no">523</b></span>
            <em aria-hidden="true">·</em>
            <span>{{ printText }}</span>
          </span>
        </header>

        <div class="receipt-divider" aria-hidden="true"></div>

        <section class="receipt-block receipt-items" aria-label="消费类别">
          <div class="receipt-block-title">
            <strong>都买了些啥</strong>
          </div>
          <div v-if="categoryRanking.length" class="receipt-item is-head" aria-hidden="true">
            <span></span>
            <span>类别</span>
            <span class="is-num">次数</span>
            <span class="is-num">价格</span>
            <span class="is-num">小计</span>
          </div>
          <div
            v-for="(item, index) in categoryRanking"
            :key="item.category"
            class="receipt-item is-link"
            role="button"
            tabindex="0"
            :aria-label="`查看 ${item.category} 的明细`"
            @click="openCategory(item.category)"
            @keydown.enter.prevent="openCategory(item.category)"
          >
            <span class="receipt-rank">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="receipt-item-name">
              <CategoryIcon :name="iconFor(item.category)" />
              <span class="receipt-item-text">
                <span class="receipt-row-name">{{ item.category }}</span>
                <small v-if="item.noteText" class="receipt-item-note">{{ item.noteText }}</small>
              </span>
            </span>
            <span class="is-num">{{ item.count }}</span>
            <span class="is-num is-money"><i class="receipt-yen">¥</i>{{ formatAmount(item.price) }}</span>
            <span class="is-num is-money is-strong"><i class="receipt-yen">¥</i>{{ formatAmount(item.amount) }}</span>
          </div>
          <p v-if="!categoryRanking.length" class="receipt-empty">猫猫没记到东西，这个月清清淡淡</p>
          <div class="receipt-total-row">
            <span class="receipt-total-label">合计</span>
            <span class="receipt-total-count">{{ count }} 次</span>
            <span class="receipt-total-sum">
              <span class="receipt-sum-ink"><i class="receipt-yen">¥</i>{{ formatAmount(total) }}</span>
            </span>
          </div>
        </section>

        <div class="receipt-divider is-section" aria-hidden="true"></div>

        <section class="receipt-block" aria-label="猫猫之最">
          <div class="receipt-row">
            <span class="receipt-row-label">剁手最狠</span>
            <span class="receipt-row-dots" aria-hidden="true"></span>
            <span class="receipt-row-value"><i class="receipt-yen">¥</i>{{ largest ? formatAmount(largest.amount) : '0.00' }}</span>
          </div>
          <p class="receipt-row-note">
            <template v-if="largest">
              {{ largest.note || largest.category }} · {{ dayLabel(largest.spentAt) }}
              <template v-if="showStageName"> · {{ stageNameFor(largest) }}</template>
            </template>
            <template v-else>猫猫还没出手</template>
          </p>

          <div class="receipt-row">
            <span class="receipt-row-label">买得最勤</span>
            <span class="receipt-row-dots" aria-hidden="true"></span>
            <span class="receipt-row-value">{{ topCategory ? topCategory.category : '—' }}</span>
          </div>
          <p class="receipt-row-note">
            <template v-if="topCategory">
              <i class="receipt-yen">¥</i>{{ formatAmount(topCategory.amount) }} · {{ Math.round(topCategory.percent) }}%
            </template>
            <template v-else>还没有分类</template>
          </p>

          <div class="receipt-row">
            <span class="receipt-row-label">钱包最疼那天</span>
            <span class="receipt-row-dots" aria-hidden="true"></span>
            <span class="receipt-row-value"><i class="receipt-yen">¥</i>{{ busiestDay ? formatAmount(busiestDay.total) : '0.00' }}</span>
          </div>
          <p class="receipt-row-note">
            <template v-if="busiestDay">{{ dayLabel(busiestDay.key) }} · {{ busiestDay.count }} 笔</template>
            <template v-else>这个月还没花钱</template>
          </p>

          <div class="receipt-row">
            <span class="receipt-row-label">最爱上供</span>
            <span class="receipt-row-dots" aria-hidden="true"></span>
            <span class="receipt-row-value">{{ busiestWeekday ? busiestWeekday.label : '—' }}</span>
          </div>
          <p class="receipt-row-note">
            <template v-if="busiestWeekday">有 {{ busiestWeekday.days }} 天在散财</template>
            <template v-else>还没有固定的节奏</template>
          </p>
        </section>

        <div class="receipt-divider is-section" aria-hidden="true"></div>

        <section class="receipt-block receipt-overview" aria-label="猫猫月报">
          <div class="receipt-row">
            <span class="receipt-row-label">铲屎日</span>
            <span class="receipt-row-dots" aria-hidden="true"></span>
            <span class="receipt-row-value">{{ activeDays }} / {{ elapsedDays }} 天</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-row-label">猫粮罐安全日</span>
            <span class="receipt-row-dots" aria-hidden="true"></span>
            <span class="receipt-row-value">{{ noSpendDays }} 天</span>
          </div>
        </section>

        <div class="receipt-divider is-dashed" aria-hidden="true"></div>

        <div class="receipt-mood">
          <span class="receipt-cat" aria-hidden="true"><CatMood :mood="mood" /></span>
          <div class="receipt-say">
            <span class="receipt-say-label">猫猫碎碎念</span>
            <p class="receipt-say-main">{{ narrative.main }}</p>
            <p v-if="narrative.detail" class="receipt-say-detail">{{ narrative.detail }}</p>
          </div>
        </div>

        <div class="receipt-divider is-dashed" aria-hidden="true"></div>

        <footer class="receipt-foot">
          <span class="receipt-thanks">谢谢投喂喵</span>
          <span class="receipt-barcode" aria-hidden="true">
            <i
              v-for="(bar, index) in barcodeBars"
              :key="index"
              :style="{ width: `${bar.width}px`, marginRight: `${bar.gap}px` }"
            ></i>
          </span>
          <span class="receipt-barcode-no">No.{{ receiptNo }}</span>
          <small>猫猫打的电子小票 · 收好喵</small>
        </footer>
      </div>
      </div>
      </div>

      <div class="report-actions">
        <button
          class="secondary-btn report-save-btn"
          type="button"
          :disabled="saving"
          @click="saveReceipt"
        >
          {{ saving ? '猫猫在画小票…' : '保存 / 分享小票' }}
        </button>
      </div>
    </template>

    <MonthPickerSheet
      v-model:show="showMonthPicker"
      :selected-month="month"
      :footprint="true"
      :day-totals="dayTotals"
      :loading="loading"
      @select="selectMonth"
      @pick-day="openDayDetail"
    />
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import CatMood from '../components/CatMood.vue';
import LoadingState from '../components/LoadingState.vue';
import CategoryIcon from '../components/CategoryIcon.vue';
import MonthPickerSheet from '../components/MonthPickerSheet.vue';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { useViewScope } from '../composables/useViewScope';
import { DEFAULT_CATEGORY } from '../lib/parser';
import { addMonths, currentMonthKey, monthBounds, monthLabel } from '../utils/months';
import { dayKey, formatAmount, pad2, toDateInput } from '../utils/format';
import { haptic } from '../utils/haptics';
import { saveImage } from '../utils/saveImage';

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const router = useRouter();
const {
  ready,
  dataVersion,
  currentStage,
  activeStages,
  searchExpenses,
  loadExpensesByIds,
  loadCategoryTotals,
  iconFor
} = useLedger();
const sheets = useSheets();
const { stageScope, setDetailContext } = useViewScope();

const month = ref(currentMonthKey());
const rows = ref([]);
const categoryItems = ref([]);
const total = ref(0);
const count = ref(0);
const previousTotal = ref(0);
const loading = ref(true);
const loadError = ref(false);
const receiptRef = ref(null);
const showMonthPicker = ref(false);
const saving = ref(false);
let loadToken = 0;

// 当前月份随时间变化：集中成一个来源，跨午夜自动刷新
const nowRef = ref(new Date());
const currentMonth = computed(() => currentMonthKey(nowRef.value));
let nowTimer = null;
function refreshNow() {
  const next = new Date();
  // 同一天内不触发响应式更新，避免无谓重算
  if (toDateInput(next) !== toDateInput(nowRef.value)) nowRef.value = next;
}
onMounted(() => {
  nowTimer = window.setInterval(refreshNow, 60 * 1000);
});
onBeforeUnmount(() => {
  if (nowTimer) window.clearInterval(nowTimer);
  nowTimer = null;
});

// '2026-11' → { year: 2026, index: 10, days: 30 }
function parseMonthKey(key) {
  const [year, monthNumber] = String(key || '').split('-').map(Number);
  return {
    year,
    index: monthNumber - 1,
    days: new Date(year, monthNumber, 0).getDate()
  };
}

const scopeStageIds = computed(() => {
  if (stageScope.value === 'all') return activeStages.value.map((stage) => stage.id);
  return currentStage.value ? [currentStage.value.id] : [];
});

// 稳定签名：账本集合没变时不重复加载（避免每次 activeStages 刷新都重打小票）
const scopeSignature = computed(() => `${stageScope.value}:${scopeStageIds.value.join(',')}`);

const showStageName = computed(() => stageScope.value === 'all' && activeStages.value.length > 1);
const stageNameById = computed(() => {
  const map = new Map();
  for (const stage of activeStages.value) map.set(stage.id, stage.name);
  return map;
});

const monthText = computed(() => monthLabel(month.value));
const receiptNo = computed(() => `${month.value.replace('-', '')}${String(count.value).padStart(4, '0')}`);
const barcodeBars = computed(() => {
  let hash = 0;
  for (const ch of receiptNo.value) hash = (hash * 131 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: 44 }, () => {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    return {
      width: 1 + hash % 3,
      gap: 1 + ((hash >> 2) % 2)
    };
  });
});
const printText = computed(() => {
  const isCurrent = month.value === currentMonth.value;
  if (isCurrent) {
    const now = nowRef.value;
    return `${toDateInput(now)} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  }
  const { year, index } = parseMonthKey(month.value);
  return `${year}-${pad2(index + 1)}-${pad2(new Date(year, index + 1, 0).getDate())} 21:08`;
});
const isCurrentMonth = computed(() => month.value >= currentMonth.value);
const monthDateRange = computed(() => {
  const { days } = parseMonthKey(month.value);
  return {
    from: `${month.value}-01`,
    to: `${month.value}-${pad2(days)}`,
    days
  };
});
const elapsedDays = computed(() => {
  const nowMonth = currentMonth.value;
  if (month.value < nowMonth) return monthDateRange.value.days;
  if (month.value > nowMonth) return 1;
  return Math.min(monthDateRange.value.days, nowRef.value.getDate());
});

// 本月还没过完：和上个月「同期」比，而不是拿半个月比人家整月
const previousCutoffDay = computed(() => {
  if (!isCurrentMonth.value) return null;
  return Math.min(elapsedDays.value, parseMonthKey(addMonths(month.value, -1)).days);
});

const activeDayKeys = computed(() => new Set(
  rows.value.map((expense) => dayKey(new Date(expense.spentAt)))
));
const activeDays = computed(() => activeDayKeys.value.size);
const noSpendDays = computed(() => Math.max(0, elapsedDays.value - activeDays.value));

const dayTotals = computed(() => {
  const map = new Map();
  for (const expense of rows.value) {
    const key = dayKey(new Date(expense.spentAt));
    const bucket = map.get(key) || { key, total: 0, count: 0 };
    bucket.total += Number(expense.amount) || 0;
    bucket.count += 1;
    map.set(key, bucket);
  }
  return map;
});

const busiestDay = computed(() => {
  let peak = null;
  for (const bucket of dayTotals.value.values()) {
    if (!peak || bucket.total > peak.total) peak = bucket;
  }
  return peak;
});

const busiestWeekday = computed(() => {
  const buckets = new Map();
  for (const key of activeDayKeys.value) {
    const date = new Date(`${key}T12:00:00`);
    if (Number.isNaN(date.getTime())) continue;
    const weekday = date.getDay();
    const bucket = buckets.get(weekday) || { weekday, days: 0, total: 0 };
    bucket.days += 1;
    bucket.total += dayTotals.value.get(key)?.total || 0;
    buckets.set(weekday, bucket);
  }
  let peak = null;
  for (const bucket of buckets.values()) {
    if (!peak || bucket.days > peak.days) peak = bucket;
  }
  if (!peak) return null;
  return { label: WEEKDAY_NAMES[peak.weekday], days: peak.days, total: peak.total };
});

const categoryNotes = computed(() => {
  const map = new Map();
  for (const expense of rows.value) {
    const note = String(expense?.note || '').trim();
    if (!note) continue;
    const key = String(expense?.category || DEFAULT_CATEGORY);
    if (!map.has(key)) map.set(key, new Map());
    const bag = map.get(key);
    const seen = bag.get(note);
    if (seen) {
      seen.count += 1;
    } else {
      bag.set(note, {
        count: 1,
        at: Date.parse(expense?.spentAt) || Number(expense?.createdAt) || 0
      });
    }
  }
  return map;
});

const categoryRanking = computed(() => {
  const notes = categoryNotes.value;
  return categoryItems.value.map((item) => {
    const bag = notes.get(String(item.category || DEFAULT_CATEGORY));
    const list = bag
      ? [...bag.entries()]
        .sort((a, b) => (a[1].at - b[1].at) || (b[1].count - a[1].count))
        .map(([note]) => note)
      : [];
    return {
      ...item,
      price: item.count ? item.amount / item.count : 0,
      noteText: list.join('、')
    };
  });
});

const largest = computed(() => rows.value.reduce((peak, expense) => (
  !peak || (Number(expense.amount) || 0) > (Number(peak.amount) || 0) ? expense : peak
), null));

const topCategories = computed(() => categoryRanking.value.slice(0, 3));

const topCategory = computed(() => topCategories.value[0] || null);

const comparison = computed(() => {
  const samePeriod = previousCutoffDay.value != null;
  const baseline = samePeriod ? `上月同期（前 ${previousCutoffDay.value} 天）` : '上月';

  if (!previousTotal.value) {
    return {
      text: total.value ? '上月没花钱' : '—',
      tone: 'flat',
      percent: 0,
      baseline
    };
  }
  const diff = total.value - previousTotal.value;
  const percent = Math.round(diff / previousTotal.value * 100);
  return {
    text: `${diff >= 0 ? '+' : ''}${percent}%`,
    tone: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
    percent,
    baseline
  };
});

const mood = computed(() => {
  if (!total.value) return 'sleep';
  if (comparison.value.tone === 'up' && comparison.value.percent >= 30) return 'worried';
  if (noSpendDays.value >= 5 || comparison.value.tone === 'down') return 'happy';
  return 'watch';
});

const narrative = computed(() => {
  if (!total.value) {
    return elapsedDays.value <= 1
      ? { main: '新的一月刚开始，猫粮罐亮亮的', detail: '喵～' }
      : { main: `都 ${elapsedDays.value} 天了一分没花，猫粮罐稳稳的`, detail: '喵！' };
  }

  let main;
  if (comparison.value.tone === 'up' && comparison.value.percent >= 30) {
    main = `比${comparison.value.baseline}多花了 ${comparison.value.percent}%，猫猫捂脸`;
  } else if (comparison.value.tone === 'down' && comparison.value.percent <= -15) {
    main = `比${comparison.value.baseline}省了 ${Math.abs(comparison.value.percent)}%，走路带风`;
  } else if (topCategory.value) {
    main = `大部分钱都上供给「${topCategory.value.category}」`;
  } else {
    main = '这个月花得挺均匀';
  }

  const tail = comparison.value.tone === 'up' ? '喵……' : '喵～';
  const details = [];
  if (largest.value?.note) details.push(`最肉疼的是「${largest.value.note}」`);
  else if (largest.value) details.push(`最肉疼的一笔 ¥${formatAmount(largest.value.amount)}`);
  if (busiestWeekday.value && busiestWeekday.value.days >= 2) {
    details.push(`${busiestWeekday.value.label}爪子最痒`);
  }
  if (noSpendDays.value >= 5) details.push(`有 ${noSpendDays.value} 天猫粮罐没动`);

  if (!details.length) return { main: `${main}，${tail}` };
  return { main, detail: `${details.slice(0, 2).join('，')}，${tail}` };
});

function stageNameFor(expense) {
  return stageNameById.value.get(expense.stageId) || '';
}

function dayLabel(value) {
  const date = typeof value === 'string' && value.length === 10
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function resetReport() {
  rows.value = [];
  categoryItems.value = [];
  total.value = 0;
  count.value = 0;
  previousTotal.value = 0;
}

async function loadReport() {
  if (!ready.value) {
    loading.value = true;
    return;
  }

  const stageIds = [...scopeStageIds.value];
  if (!stageIds.length) {
    resetReport();
    loading.value = false;
    loadError.value = false;
    return;
  }

  const token = ++loadToken;
  loading.value = true;
  loadError.value = false;

  const scope = stageScope.value;
  const [fromIso, toIso] = monthBounds(month.value);
  const previousMonth = addMonths(month.value, -1);
  const [prevFromIso] = monthBounds(previousMonth);
  // 上月同期：toIso 是开区间，所以取「上月第 N+1 天 00:00」作为截止
  const prevParts = parseMonthKey(previousMonth);
  const prevCutoffIso = previousCutoffDay.value != null
    ? new Date(prevParts.year, prevParts.index, previousCutoffDay.value + 1).toISOString()
    : monthBounds(previousMonth)[1];

  try {
    // worker 的搜索是单通道的（后一次会取消前一次），所以本月与上月要串行
    const found = await searchExpenses({ stageIds, fromIso, toIso, limit: 5000 });
    if (token !== loadToken) return;

    const [previous, categories] = await Promise.all([
      searchExpenses({ stageIds, fromIso: prevFromIso, toIso: prevCutoffIso, limit: 1 }),
      loadCategoryTotals({
        stageId: scope === 'all' ? null : currentStage.value?.id || null,
        stageIds: scope === 'all' ? stageIds : null,
        from: monthDateRange.value.from,
        to: monthDateRange.value.to
      })
    ]);
    if (token !== loadToken) return;

    const loaded = await loadExpensesByIds(found.ids);
    if (token !== loadToken) return;

    rows.value = loaded;
    categoryItems.value = categories.items;
    total.value = Number(found.sum) || 0;
    count.value = Number(found.count) || 0;
    previousTotal.value = Number(previous.sum) || 0;
  } catch (err) {
    if (err?.code === 'SEARCH_CANCELLED') return;
    if (token !== loadToken) return;
    console.error('加载小票失败', err);
    resetReport();
    loadError.value = true;
  } finally {
    if (token === loadToken) loading.value = false;
  }
}

function setScope(scope) {
  if (scope === 'current' && !currentStage.value) return;
  if (stageScope.value === scope) return;
  stageScope.value = scope;
  haptic('light');
}

function shiftMonth(delta) {
  const next = addMonths(month.value, delta);
  if (next > currentMonth.value) return;
  month.value = next;
  haptic('light');
}

function goCurrentMonth() {
  month.value = currentMonth.value;
  haptic('light');
}

function openMonthPicker() {
  showMonthPicker.value = true;
  haptic('light');
}

function selectMonth(next) {
  const key = String(next || '') > currentMonth.value ? currentMonth.value : next;
  if (key === month.value) return;
  month.value = key;
  haptic('light');
}

function openDetail() {
  const range = monthDateRange.value;
  setDetailContext(range.from, range.to);
  haptic('light');
  router.push('/search');
}

function openDayDetail(day) {
  setDetailContext(day, day);
  haptic('light');
  router.push('/search');
}

function openCategory(category) {
  if (!category) return;
  const range = monthDateRange.value;
  setDetailContext(range.from, range.to, category);
  haptic('light');
  router.push('/search');
}

function buildExportNode(node) {
  // Render an off-screen copy so the visible receipt never shifts or flashes.
  // The copy keeps the same paper styling; only the settled state is forced
  // (no drop-in animation). A cream frame wraps it so the exported image has
  // breathing room around the paper, just like it looks on the page.
  const clone = node.cloneNode(true);
  const width = node.getBoundingClientRect().width || node.clientWidth;
  if (width) clone.style.width = `${width}px`;
  clone.style.margin = '0';
  clone.style.opacity = '1';
  clone.style.transform = 'none';
  clone.style.animation = 'none';

  const background = getComputedStyle(document.documentElement)
    .getPropertyValue('--bg')
    .trim() || '#faf5ec';
  const frame = document.createElement('div');
  frame.style.width = `${(width || 344) + 40}px`;
  frame.style.padding = '20px';
  frame.style.background = background;
  frame.style.margin = '0';
  frame.appendChild(clone);

  const holder = document.createElement('div');
  holder.style.position = 'fixed';
  holder.style.left = '-10000px';
  holder.style.top = '0';
  holder.style.pointerEvents = 'none';
  holder.appendChild(frame);
  document.body.appendChild(holder);
  return { node: frame, holder };
}

async function saveReceipt() {
  const node = receiptRef.value;
  if (!node || saving.value) return;
  haptic('light');
  saving.value = true;

  try {
    let dataUrl = '';
    let holder = null;
    try {
      const built = buildExportNode(node);
      holder = built.holder;
      // Let the off-screen copy finish laying out before it is captured.
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      const { toPng } = await import('html-to-image');
      dataUrl = await toPng(built.node, {
        pixelRatio: 3,
        cacheBust: true
      });
    } catch (err) {
      console.error('保存小票失败', err);
      showToast('保存失败，再试一次');
      return;
    } finally {
      holder?.remove();
    }

    try {
      const result = await saveImage(dataUrl, `守财小果-${month.value}-小票.png`, {
        title: '守财小果 · 月度小票',
        text: `${monthText.value}的小票`
      });
      if (result === 'share') {
        showToast('已打开分享，选「存储图像」保存');
      } else if (result === 'preview') {
        showToast('长按图片保存到相册');
      } else if (result === 'download') {
        showToast('小票已保存到下载文件夹');
      }
      if (result !== 'cancelled') haptic('success');
    } catch (err) {
      console.error('保存小票失败', err);
      showToast('保存失败，再试一次');
    }
  } finally {
    saving.value = false;
  }
}

function openStageForm() {
  sheets.openStageForm();
}

watch(
  [ready, () => currentStage.value?.id],
  ([isReady]) => {
    if (isReady && !currentStage.value && stageScope.value === 'current') {
      stageScope.value = 'all';
    }
  },
  { immediate: true }
);

watch([ready, month, scopeSignature, dataVersion], loadReport, { immediate: true });
</script>
