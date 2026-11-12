<template>
  <section class="report-page">
    <div class="report-bar">
      <button class="report-month-arrow" type="button" aria-label="上个月" @click="shiftMonth(-1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6"></path>
        </svg>
      </button>
      <span class="report-month-current">{{ monthText }}</span>
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

    <LoadingState v-if="loading" text="果冻在打这个月的小票…" />

    <div v-else-if="loadError" class="list-empty">
      <p>小票没打成</p>
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
      <div ref="receiptRef" :key="month" class="receipt-paper">
        <span class="receipt-slip-tag" aria-hidden="true">顾客联</span>
        <header class="receipt-head">
          <span class="receipt-brand">守财小果</span>
          <span class="receipt-brand-sub">MONTHLY RECEIPT</span>
          <span class="receipt-meta-line">
            <span>桌号 <b class="receipt-table-no">523</b></span>
            <em aria-hidden="true">·</em>
            <span>{{ printText }}</span>
          </span>
        </header>

        <div class="receipt-divider is-dashed" aria-hidden="true"></div>

        <div class="receipt-mood">
          <span class="receipt-cat" aria-hidden="true"><CatMood :mood="mood" /></span>
          <p class="receipt-say">
            <span class="receipt-say-label">果冻说</span>
            {{ narrative }}
          </p>
        </div>

        <div class="receipt-divider" aria-hidden="true"></div>

        <section class="receipt-block receipt-items" aria-label="消费类别">
          <div class="receipt-block-title">
            <strong>消费类别</strong>
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
              <span class="receipt-row-name">{{ item.category }}</span>
            </span>
            <span class="is-num">{{ item.count }}</span>
            <span class="is-num is-money"><i class="receipt-yen">¥</i>{{ formatAmount(item.price) }}</span>
            <span class="is-num is-money is-strong"><i class="receipt-yen">¥</i>{{ formatAmount(item.amount) }}</span>
          </div>
          <p v-if="!categoryRanking.length" class="receipt-empty">本月暂无消费记录</p>
          <div class="receipt-total-row">
            <span class="receipt-total-label">合计</span>
            <span class="receipt-total-count">{{ count }} 次</span>
            <span class="receipt-total-sum">
              <span class="receipt-sum-ink"><i class="receipt-yen">¥</i>{{ formatAmount(total) }}</span>
            </span>
          </div>
        </section>

        <div class="receipt-divider is-section" aria-hidden="true"></div>

        <section class="receipt-block" aria-label="本月之最">
          <div class="receipt-row">
            <span class="receipt-row-label">最贵一笔</span>
            <span class="receipt-row-dots" aria-hidden="true"></span>
            <span class="receipt-row-value"><i class="receipt-yen">¥</i>{{ largest ? formatAmount(largest.amount) : '0.00' }}</span>
          </div>
          <p class="receipt-row-note">
            <template v-if="largest">
              {{ largest.note || largest.category }} · {{ dayLabel(largest.spentAt) }}
              <template v-if="showStageName"> · {{ stageNameFor(largest) }}</template>
            </template>
            <template v-else>这个月还没花钱</template>
          </p>

          <div class="receipt-row">
            <span class="receipt-row-label">最常买</span>
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
            <span class="receipt-row-label">最贵的一天</span>
            <span class="receipt-row-dots" aria-hidden="true"></span>
            <span class="receipt-row-value"><i class="receipt-yen">¥</i>{{ busiestDay ? formatAmount(busiestDay.total) : '0.00' }}</span>
          </div>
          <p class="receipt-row-note">
            <template v-if="busiestDay">{{ dayLabel(busiestDay.key) }} · {{ busiestDay.count }} 笔</template>
            <template v-else>这个月还没花钱</template>
          </p>

          <div class="receipt-row">
            <span class="receipt-row-label">最常花钱</span>
            <span class="receipt-row-dots" aria-hidden="true"></span>
            <span class="receipt-row-value">{{ busiestWeekday ? busiestWeekday.label : '—' }}</span>
          </div>
          <p class="receipt-row-note">
            <template v-if="busiestWeekday">有 {{ busiestWeekday.days }} 天在花</template>
            <template v-else>还没有固定的节奏</template>
          </p>
        </section>

        <div class="receipt-divider is-section" aria-hidden="true"></div>

        <section class="receipt-block receipt-overview" aria-label="本月概况">
          <div class="receipt-row">
            <span class="receipt-row-label">花钱的日子</span>
            <span class="receipt-row-dots" aria-hidden="true"></span>
            <span class="receipt-row-value">{{ activeDays }} / {{ elapsedDays }} 天</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-row-label">无支出日</span>
            <span class="receipt-row-dots" aria-hidden="true"></span>
            <span class="receipt-row-value">{{ noSpendDays }} 天</span>
          </div>
        </section>

        <div class="receipt-divider is-dashed" aria-hidden="true"></div>

        <footer class="receipt-foot">
          <span class="receipt-thanks">谢谢惠顾</span>
          <span class="receipt-barcode" aria-hidden="true">
            <i
              v-for="(bar, index) in barcodeBars"
              :key="index"
              :style="{ width: `${bar.width}px`, marginRight: `${bar.gap}px` }"
            ></i>
          </span>
          <span class="receipt-barcode-no">No.{{ receiptNo }}</span>
          <small>电子凭证 · 请妥善保管</small>
        </footer>
      </div>
      </div>

      <section class="report-calendar" aria-label="本月花钱足迹">
        <div class="report-section-head">
          <h2>花钱足迹</h2>
          <span>{{ activeDays }} 天 · ¥{{ formatAmount(total) }}</span>
        </div>
        <div class="report-calendar-weekdays" aria-hidden="true">
          <span v-for="weekday in WEEKDAY_LABELS" :key="weekday">{{ weekday }}</span>
        </div>
        <div class="report-calendar-grid">
          <span
            v-for="(cell, index) in calendarCells"
            :key="cell ? cell.key : `pad-${index}`"
            class="report-calendar-cell"
            :class="{
              'is-empty': !cell,
              'is-future': cell?.isFuture,
              'is-today': cell?.isToday,
              [`level-${cell?.level || 0}`]: cell
            }"
            :title="cell && cell.amount ? `${cell.key} · ¥${formatAmount(cell.amount)}` : ''"
          >
            <template v-if="cell">
              <span class="report-calendar-day">{{ cell.day }}</span>
              <span v-if="cell.amount" class="report-calendar-amount">{{ compactAmount(cell.amount) }}</span>
            </template>
          </span>
        </div>
        <div class="report-calendar-legend" aria-hidden="true">
          <span>少</span>
          <i v-for="level in [0, 1, 2, 3, 4]" :key="level" :class="`level-${level}`"></i>
          <span>多</span>
        </div>
      </section>

      <div class="report-actions">
        <button class="secondary-btn" type="button" @click="openDetail">
          看看这个月的明细
        </button>
        <button class="secondary-btn report-save-btn" type="button" @click="saveReceipt">
          保存 / 分享小票
        </button>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { toPng } from 'html-to-image';
import CatMood from '../components/CatMood.vue';
import LoadingState from '../components/LoadingState.vue';
import CategoryIcon from '../components/CategoryIcon.vue';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { useViewScope } from '../composables/useViewScope';
import { addMonths, currentMonthKey, monthBounds, monthLabel } from '../utils/months';
import { dayKey, formatAmount, pad2 } from '../utils/format';
import { haptic } from '../utils/haptics';
import { saveImage } from '../utils/saveImage';

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
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
let loadToken = 0;

const scopeStageIds = computed(() => {
  if (stageScope.value === 'all') return activeStages.value.map((stage) => stage.id);
  return currentStage.value ? [currentStage.value.id] : [];
});

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
  const now = new Date();
  const isCurrent = month.value === currentMonthKey();
  const [year, monthNumber] = month.value.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0);
  const date = isCurrent ? now : lastDay;
  const day = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const time = isCurrent ? `${pad2(now.getHours())}:${pad2(now.getMinutes())}` : '21:08';
  return `${day} ${time}`;
});
const isCurrentMonth = computed(() => month.value >= currentMonthKey());
const monthDateRange = computed(() => {
  const [year, monthNumber] = month.value.split('-').map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return {
    from: `${month.value}-01`,
    to: `${month.value}-${pad2(days)}`,
    days
  };
});
const elapsedDays = computed(() => {
  const nowMonth = currentMonthKey();
  if (month.value < nowMonth) return monthDateRange.value.days;
  if (month.value > nowMonth) return 1;
  return Math.min(monthDateRange.value.days, new Date().getDate());
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

const calendarCells = computed(() => {
  const { days } = monthDateRange.value;
  const [year, monthNumber] = month.value.split('-').map(Number);
  const firstWeekday = new Date(year, monthNumber - 1, 1).getDay();
  const leading = (firstWeekday + 6) % 7;
  const maxDay = Math.max(
    1,
    ...[...dayTotals.value.values()].map((bucket) => bucket.total)
  );
  const todayKey = dayKey(new Date());

  const cells = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= days; day += 1) {
    const key = `${month.value}-${pad2(day)}`;
    const bucket = dayTotals.value.get(key);
    const amount = bucket?.total || 0;
    let level = 0;
    if (amount > 0) {
      level = Math.min(4, Math.ceil(amount / maxDay * 4));
    }
    cells.push({
      key,
      day,
      amount,
      count: bucket?.count || 0,
      level,
      isFuture: key > todayKey,
      isToday: key === todayKey
    });
  }
  return cells;
});

const categoryRanking = computed(() => categoryItems.value.map((item) => ({
  ...item,
  price: item.count ? item.amount / item.count : 0
})));

const largest = computed(() => rows.value.reduce((peak, expense) => (
  !peak || (Number(expense.amount) || 0) > (Number(peak.amount) || 0) ? expense : peak
), null));

const topCategories = computed(() => categoryRanking.value.slice(0, 3));

const topCategory = computed(() => topCategories.value[0] || null);

const comparison = computed(() => {
  if (!previousTotal.value) {
    return {
      text: total.value ? '上月没花钱' : '—',
      tone: 'flat',
      percent: 0
    };
  }
  const diff = total.value - previousTotal.value;
  const percent = Math.round(diff / previousTotal.value * 100);
  return {
    text: `${diff >= 0 ? '+' : ''}${percent}%`,
    tone: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
    percent
  };
});

const mood = computed(() => {
  if (!total.value) return 'sleep';
  if (comparison.value.tone === 'up' && comparison.value.percent >= 30) return 'worried';
  if (noSpendDays.value >= 5 || comparison.value.tone === 'down') return 'happy';
  return 'watch';
});

const narrative = computed(() => {
  if (!total.value) return '这个月果冻一分钱都没花，猫粮罐稳稳的。';

  const bits = [];
  if (topCategory.value) bits.push(`在「${topCategory.value.category}」上花得最多`);
  if (largest.value?.note) bits.push(`最贵的一笔是「${largest.value.note}」`);
  if (busiestWeekday.value) bits.push(`${busiestWeekday.value.label}最容易掏钱包`);
  if (noSpendDays.value > 0) bits.push(`有 ${noSpendDays.value} 天没花钱`);

  if (comparison.value.tone === 'down') {
    bits.push(`比上月少花 ${Math.abs(comparison.value.percent)}%`);
  } else if (comparison.value.tone === 'up') {
    bits.push(`比上月多花 ${comparison.value.percent}%`);
  }

  return bits.length ? `果冻发现，${bits.join('，')}。` : '这个月过得刚刚好，果冻都记在小本本上啦。';
});

function stageNameFor(expense) {
  return stageNameById.value.get(expense.stageId) || '';
}

function compactAmount(value) {
  const amount = Number(value) || 0;
  if (!amount) return '';
  if (amount >= 10000) return `${(amount / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(amount));
}

function dayLabel(value) {
  const date = typeof value === 'string' && value.length === 10
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

async function loadReport() {
  if (!ready.value) {
    loading.value = true;
    return;
  }

  const stageIds = [...scopeStageIds.value];
  if (!stageIds.length) {
    rows.value = [];
    categoryItems.value = [];
    total.value = 0;
    count.value = 0;
    previousTotal.value = 0;
    loading.value = false;
    loadError.value = false;
    return;
  }

  const token = ++loadToken;
  loading.value = true;
  loadError.value = false;
  const [fromIso, toIso] = monthBounds(month.value);
  const previousMonth = addMonths(month.value, -1);
  const [prevFromIso, prevToIso] = monthBounds(previousMonth);

  try {
    const found = await searchExpenses({
      stageIds,
      fromIso,
      toIso,
      limit: 5000
    });
    if (token !== loadToken) return;

    const [previous, categories] = await Promise.all([
      searchExpenses({
        stageIds,
        fromIso: prevFromIso,
        toIso: prevToIso,
        limit: 1
      }),
      loadCategoryTotals({
        stageId: stageScope.value === 'all' ? null : currentStage.value?.id || null,
        stageIds: stageScope.value === 'all' ? stageIds : null,
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
    if (token === loadToken) {
      console.error('加载小票失败', err);
      rows.value = [];
      categoryItems.value = [];
      total.value = 0;
      count.value = 0;
      previousTotal.value = 0;
      loadError.value = true;
    }
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
  if (next > currentMonthKey()) return;
  month.value = next;
  haptic('light');
}

function goCurrentMonth() {
  month.value = currentMonthKey();
  haptic('light');
}

function openDetail() {
  const range = monthDateRange.value;
  setDetailContext(range.from, range.to);
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

async function saveReceipt() {
  const node = receiptRef.value;
  if (!node) return;
  haptic('light');
  try {
    const dataUrl = await toPng(node, {
      pixelRatio: 3,
      cacheBust: true,
      style: {
        margin: '0',
        opacity: '1',
        transform: 'none',
        animation: 'none',
        filter: 'none',
        boxShadow: 'none'
      }
    });
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

watch([ready, month, scopeStageIds, dataVersion], loadReport, { immediate: true });
</script>
