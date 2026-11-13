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
      <div class="receipt-body">
        <span class="receipt-slip-tag" aria-hidden="true">顾客联</span>
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
              <span class="receipt-item-text">
                <span class="receipt-row-name">{{ item.category }}</span>
                <small v-if="item.noteText" class="receipt-item-note">{{ item.noteText }}</small>
              </span>
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
      </div>

      <div class="report-actions">
        <button class="secondary-btn" type="button" @click="openDetail">
          看看这个月的明细
        </button>
        <button
          class="secondary-btn report-save-btn"
          type="button"
          :disabled="saving"
          @click="saveReceipt"
        >
          {{ saving ? '果冻在画画…' : '保存 / 分享小票' }}
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
import { computed, ref, watch } from 'vue';
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
import { dayKey, formatAmount, pad2 } from '../utils/format';
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

function openMonthPicker() {
  showMonthPicker.value = true;
  haptic('light');
}

function selectMonth(next) {
  const key = String(next || '') > currentMonthKey() ? currentMonthKey() : next;
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

watch([ready, month, scopeStageIds, dataVersion], loadReport, { immediate: true });
</script>
