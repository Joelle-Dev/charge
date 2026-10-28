<template>
  <section class="year-page">
    <div class="section-head year-head">
      <div class="section-title">
        <button class="records-back" type="button" aria-label="返回明细" @click="goRecords">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6"></path>
          </svg>
        </button>
        <h2>年度汇总</h2>
        <span class="section-count">{{ selectedYear }} 年</span>
      </div>
      <button class="text-btn" type="button" @click="goRecords">返回明细</button>
    </div>

    <div class="year-nav">
      <button class="month-arrow" type="button" aria-label="上一年" @click="shiftYear(-1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6"></path>
        </svg>
      </button>
      <strong class="year-label">{{ selectedYear }} 年</strong>
      <button class="month-arrow" type="button" aria-label="下一年" @click="shiftYear(1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6"></path>
        </svg>
      </button>
      <button v-if="selectedYear !== currentYear" class="text-btn" type="button" @click="goCurrentYear">
        回到今年
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <span class="loading-dot"></span>
      正在汇总…
    </div>

    <template v-else>
    <div class="year-hero">
      <span class="year-eyebrow">{{ selectedYear }} 年总支出</span>
      <strong class="year-total">¥{{ formatMoney(summary.total) }}</strong>
      <span class="year-sub">{{ summary.count }} 笔 · {{ summary.monthsWithData }} 个月有支出</span>
      <div class="year-hero-stats">
        <div>
          <span>月均</span>
          <b>¥{{ formatMoney(summary.averagePerMonth) }}</b>
        </div>
        <div>
          <span>最高分类</span>
          <b>{{ summary.topCategory?.category || '—' }}</b>
        </div>
        <div>
          <span>最大单笔</span>
          <b>{{ summary.largest ? `¥${formatMoney(summary.largest.amount)}` : '—' }}</b>
        </div>
      </div>
    </div>

    <template v-if="summary.count">
      <div class="year-card">
        <div class="card-head">
          <h2>月度趋势</h2>
          <span class="muted">点月份看明细</span>
        </div>
        <div class="year-bars" role="group" aria-label="月度支出">
          <button
            v-for="month in summary.months"
            :key="month.month"
            class="year-bar"
            :class="{ active: selectedMonth === month.month, empty: !month.amount }"
            type="button"
            :aria-label="`${month.month} 月，${month.count} 笔，${formatMoney(month.amount)} 元`"
            @click="selectedMonth = month.month"
          >
            <span class="year-bar-track">
              <span class="year-bar-fill" :style="{ height: barHeight(month.amount) }"></span>
            </span>
            <span class="year-bar-month">{{ month.month }}</span>
          </button>
        </div>

        <div class="year-month-detail">
          <div class="year-month-head">
            <strong>{{ selectedMonth }} 月</strong>
            <span>{{ selectedMonthData.count }} 笔 · ¥{{ formatMoney(selectedMonthData.amount) }}</span>
          </div>
          <div v-if="monthCategories.length" class="year-month-cats">
            <span v-for="item in monthCategories" :key="item.category">
              {{ item.category }} ¥{{ formatMoney(item.amount) }}
            </span>
          </div>
          <span v-else class="muted">这个月没有支出</span>
        </div>
      </div>

      <div class="year-card">
        <div class="card-head">
          <h2>全年分类</h2>
          <span class="muted">{{ summary.categories.length }} 类</span>
        </div>
        <div class="year-category-list">
          <div
            v-for="item in summary.categories"
            :key="item.category"
            class="year-category-row"
            :style="{ '--swatch': categoryColor(item.category) }"
          >
            <div class="year-category-head">
              <span class="year-category-name">
                <span class="category-swatch"></span>
                {{ item.category }}
              </span>
              <span class="year-category-value">¥{{ formatMoney(item.amount) }} · {{ Math.round(item.percent) }}%</span>
            </div>
            <div class="category-track">
              <div class="category-fill" :style="{ width: `${item.percent}%` }"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="year-card">
        <div class="card-head">
          <h2>阶段排行</h2>
          <span class="muted">{{ summary.stages.length }} 个阶段</span>
        </div>
        <div class="year-stage-list">
          <div v-for="item in summary.stages" :key="item.stageId" class="year-stage-row">
            <span class="year-stage-name">
              {{ item.name }}
              <span v-if="stageArchived(item.stageId)" class="year-stage-badge">已归档</span>
            </span>
            <span class="year-stage-meta">{{ item.count }} 笔</span>
            <strong class="year-stage-amount">¥{{ formatMoney(item.amount) }}</strong>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="year-empty">
      <p>{{ selectedYear }} 年还没有支出</p>
      <span>换个年份看看，或者去明细记一笔</span>
      <button class="secondary-btn" type="button" @click="goRecords">去明细</button>
    </div>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useLedger } from '../composables/useLedger';
import { categoryColor, formatMoney } from '../utils/format';
import { buildAnnualSummary } from '../utils/annualSummary';

const router = useRouter();
const { stages, dataYears, dataVersion, loadYearExpenses } = useLedger();
const currentYear = new Date().getFullYear();
const years = computed(() => dataYears.value);
const selectedYear = ref(years.value.includes(currentYear) ? currentYear : years.value[0] || currentYear);
const selectedMonth = ref(new Date().getMonth() + 1);
const yearExpenses = ref([]);
const loading = ref(false);

const summary = computed(() => buildAnnualSummary(selectedYear.value, yearExpenses.value, stages.value));
const stageMap = computed(() => new Map(stages.value.map((stage) => [stage.id, stage])));

async function loadYear() {
  loading.value = true;
  try {
    yearExpenses.value = await loadYearExpenses(selectedYear.value);
  } finally {
    loading.value = false;
  }
}

watch([selectedYear, dataVersion], loadYear, { immediate: true });

const selectedMonthData = computed(() => (
  summary.value.months[selectedMonth.value - 1] || { amount: 0, count: 0, items: [] }
));

const monthCategories = computed(() => {
  const totals = new Map();
  for (const expense of selectedMonthData.value.items) {
    const category = expense.category || '其他';
    totals.set(category, (totals.get(category) || 0) + (Number(expense.amount) || 0));
  }
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
});

watch(summary, (value) => {
  if (!value.months[selectedMonth.value - 1]?.count) {
    selectedMonth.value = value.months.find((month) => month.count)?.month || new Date().getMonth() + 1;
  }
}, { immediate: true });

function barHeight(amount) {
  if (!amount) return '3px';
  const max = summary.value.maxMonthAmount || 1;
  return `${Math.max(6, Math.round((amount / max) * 100))}%`;
}

function stageArchived(stageId) {
  return Boolean(stageMap.value.get(stageId)?.archived);
}

function shiftYear(delta) {
  selectedYear.value += delta;
}

function goCurrentYear() {
  selectedYear.value = currentYear;
}

function goRecords() {
  router.push('/records');
}
</script>
