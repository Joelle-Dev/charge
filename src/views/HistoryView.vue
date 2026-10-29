<template>
  <section class="history-page">
    <header class="history-head">
      <button class="records-back" type="button" aria-label="返回" @click="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6"></path>
        </svg>
      </button>
      <div class="history-title">
        <span class="history-eyebrow">账本</span>
        <h1>历史支出</h1>
      </div>
    </header>

    <section class="history-range">
      <div class="history-range-head">
        <span class="history-range-label">查询范围</span>
        <div class="history-presets">
          <button class="history-preset" type="button" @click="useRecentRange">近一年</button>
          <button class="history-preset" type="button" @click="useThisYear">今年</button>
          <button class="history-preset" type="button" @click="useAllRange">全部</button>
        </div>
      </div>
      <div class="history-range-fields">
        <div class="history-date">
          <span>开始</span>
          <DateTimeField v-model="startDate" type="date" label="开始日期" title="选择开始日期" />
        </div>
        <span class="history-range-dash" aria-hidden="true">—</span>
        <div class="history-date">
          <span>结束</span>
          <DateTimeField v-model="endDate" type="date" label="结束日期" title="选择结束日期" />
        </div>
      </div>
      <p v-if="!loading && range.count" class="history-range-summary">
        范围内 {{ range.count }} 笔 · ¥{{ formatMoney(range.total) }}
      </p>
    </section>

    <div v-if="loading" class="loading-state">
      <span class="loading-dot"></span>
      正在整理历史…
    </div>

    <template v-else-if="selection">
      <section class="history-hero">
        <div class="history-hero-top">
          <div>
            <span class="history-hero-eyebrow">{{ selection.isMonth ? '月度支出' : '年度支出' }}</span>
            <h2>{{ selection.label }}</h2>
          </div>
          <span class="history-hero-count">{{ selection.count }} 笔</span>
        </div>
        <strong class="history-hero-total">
          <span class="currency">¥</span>{{ formatMoney(selection.total) }}
        </strong>
        <div class="history-stats">
          <div class="history-stat">
            <span>{{ selection.isMonth ? '日均' : '月均' }}</span>
            <b>¥{{ formatMoney(selection.average) }}</b>
            <small>{{ selection.isMonth ? `按 ${selection.days} 天` : `按 ${selection.months} 个月` }}</small>
          </div>
          <div class="history-stat">
            <span>有支出</span>
            <b>{{ selection.isMonth ? `${selection.activeDays} 天` : `${selection.activeMonths} 个月` }}</b>
          </div>
          <div class="history-stat">
            <span>{{ selection.isMonth ? '较上月' : '较上年' }}</span>
            <b :class="`history-compare-${selection.comparison.tone}`">{{ selection.comparison.text }}</b>
            <small v-if="selection.comparison.previous">
              {{ selection.previousLabel }} ¥{{ formatMoney(selection.comparison.previous) }}
            </small>
            <small v-else-if="selection.comparison.note">{{ selection.comparison.note }}</small>
          </div>
        </div>
      </section>

      <section class="history-timeline" aria-label="支出时间轴">
        <div ref="yearRailRef" class="history-year-rail" aria-label="年份">
          <button
            v-for="year in yearRail"
            :key="year.year"
            class="history-year-chip"
            :class="{ active: selectedYear === year.year }"
            type="button"
            @click="selectYear(year)"
          >
            <span class="history-year-dot" aria-hidden="true"></span>
            <span class="history-year-year">{{ year.year }}</span>
            <span class="history-year-total">¥{{ formatMoney(year.total) }}</span>
            <span class="history-year-count">{{ year.count }} 笔</span>
          </button>
        </div>

        <div
          v-if="selectedYearData"
          ref="monthRailRef"
          class="history-month-rail"
          aria-label="月份"
        >
          <button
            v-for="month in selectedMonths"
            :key="month.key"
            class="history-month"
            :class="{ active: selectedMonthKey === month.key, empty: !month.total }"
            type="button"
            @click="selectMonth(month)"
          >
            <span class="history-month-bar" aria-hidden="true">
              <span :style="{ height: `${month.percent}%` }"></span>
            </span>
            <span class="history-month-name">{{ month.month }}月</span>
            <span class="history-month-amount">{{ month.total ? `¥${formatMoney(month.total)}` : '—' }}</span>
          </button>
        </div>
      </section>
    </template>

    <div v-else class="history-empty">
      <p>这个时间范围还没有支出</p>
      <button class="secondary-btn" type="button" @click="useAllRange">查看全部历史</button>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import DateTimeField from '../components/DateTimeField.vue';
import { useLedger } from '../composables/useLedger';
import { loadDayStats } from '../lib/stats';
import { formatMoney, pad2, toDateInput } from '../utils/format';
import { addMonths, monthLabel } from '../utils/months';
import { haptic } from '../utils/haptics';

const router = useRouter();
const { ready, dataVersion } = useLedger();
const today = toDateInput(new Date());

const loading = ref(true);
const initialized = ref(false);
const allDays = ref([]);
const minDate = ref('');
const maxDate = ref('');
const startDate = ref('');
const endDate = ref('');
const selectedYear = ref(null);
const selectedMonthKey = ref('');
const yearRailRef = ref(null);
const monthRailRef = ref(null);

const earliestDay = computed(() => minDate.value || allDays.value[0]?.key || '');
const latestDay = computed(() => maxDate.value || allDays.value[allDays.value.length - 1]?.key || '');

function parseKey(key) {
  return new Date(`${key}T12:00:00`);
}

function daysBetween(startKey, endKey) {
  if (!startKey || !endKey || startKey > endKey) return 0;
  const [sy, sm, sd] = startKey.split('-').map(Number);
  const [ey, em, ed] = endKey.split('-').map(Number);
  return Math.floor((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000) + 1;
}

function monthDays(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

function monthRangeDays(key) {
  const monthStart = `${key}-01`;
  const monthEnd = `${key}-${pad2(monthDays(key))}`;
  const from = startDate.value > monthStart ? startDate.value : monthStart;
  const to = endDate.value < monthEnd ? endDate.value : monthEnd;
  return daysBetween(from, to);
}

function listRangeMonths(from, to) {
  if (!from || !to || from > to) return [];
  const [startYear, startMonth] = from.split('-').map(Number);
  const [endYear, endMonth] = to.split('-').map(Number);
  const months = [];
  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${pad2(month)}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function shiftYear(key, delta) {
  const date = parseKey(key);
  date.setFullYear(date.getFullYear() + delta);
  return toDateInput(date);
}

function setRange(from, to) {
  if (!from || !to) return;
  if (from > to) {
    startDate.value = to;
    endDate.value = from;
  } else {
    startDate.value = from;
    endDate.value = to;
  }
  haptic('light');
}

function useRecentRange() {
  const end = latestDay.value || today;
  const from = shiftYear(end, -1);
  setRange(earliestDay.value && from < earliestDay.value ? earliestDay.value : from, end);
}

function useThisYear() {
  const end = today;
  setRange(`${end.slice(0, 4)}-01-01`, end);
}

function useAllRange() {
  setRange(earliestDay.value || today, latestDay.value || today);
}

const allTotals = computed(() => {
  const months = new Map();
  const years = new Map();
  for (const day of allDays.value) {
    const amount = Number(day.total) || 0;
    const month = day.key.slice(0, 7);
    const year = Number(day.key.slice(0, 4));
    months.set(month, (months.get(month) || 0) + amount);
    years.set(year, (years.get(year) || 0) + amount);
  }
  return { months, years };
});

const range = computed(() => {
  if (!startDate.value || !endDate.value || startDate.value > endDate.value) {
    return { years: [], total: 0, count: 0 };
  }

  const monthKeys = listRangeMonths(startDate.value, endDate.value);
  const yearMap = new Map();

  for (const key of monthKeys) {
    const year = Number(key.slice(0, 4));
    if (!yearMap.has(year)) {
      yearMap.set(year, { year, total: 0, count: 0, months: [] });
    }
    yearMap.get(year).months.push({
      key,
      month: Number(key.slice(5)),
      total: 0,
      count: 0,
      activeDays: 0,
      daysInRange: monthRangeDays(key)
    });
  }

  for (const day of allDays.value) {
    if (day.key < startDate.value || day.key > endDate.value) continue;
    const year = yearMap.get(Number(day.key.slice(0, 4)));
    if (!year) continue;
    const month = year.months.find((item) => item.key === day.key.slice(0, 7));
    if (!month) continue;

    const amount = Number(day.total) || 0;
    const count = Number(day.count) || 0;
    month.total += amount;
    month.count += count;
    if (count > 0) month.activeDays += 1;
    year.total += amount;
    year.count += count;
  }

  const years = [...yearMap.values()]
    .filter((year) => year.count > 0)
    .map((year) => ({
      ...year,
      months: year.months.sort((a, b) => a.month - b.month),
      activeMonths: year.months.filter((month) => month.count > 0).length
    }))
    .sort((a, b) => b.year - a.year);

  const max = Math.max(1, ...years.map((year) => year.total));
  for (const year of years) year.percent = Math.round((year.total / max) * 100);

  return {
    years,
    total: years.reduce((sum, year) => sum + year.total, 0),
    count: years.reduce((sum, year) => sum + year.count, 0)
  };
});

const selectedYearData = computed(() => (
  range.value.years.find((year) => year.year === selectedYear.value) || null
));

const yearRail = computed(() => [...range.value.years].sort((a, b) => a.year - b.year));

const selectedMonths = computed(() => {
  const year = selectedYearData.value;
  if (!year) return [];
  const max = Math.max(1, ...year.months.map((month) => month.total));
  return year.months.map((month) => ({
    ...month,
    percent: Math.round((month.total / max) * 100)
  }));
});

function centerRail(railRef) {
  const rail = railRef.value;
  if (!rail) return;
  const active = rail.querySelector('.active');
  if (!active) return;
  const left = active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2;
  rail.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
}

watch([selectedYear, selectedMonthKey], () => {
  nextTick(() => {
    centerRail(yearRailRef);
    if (selectedMonthKey.value) centerRail(monthRailRef);
    else if (monthRailRef.value) monthRailRef.value.scrollTo({ left: 0, behavior: 'smooth' });
  });
});

function compare(current, previous) {
  if (!previous) {
    return {
      text: '—',
      tone: 'flat',
      previous: 0,
      note: current ? '前期无支出' : ''
    };
  }

  const diff = current - previous;
  const percent = Math.round((diff / previous) * 100);
  return {
    text: `${diff >= 0 ? '+' : ''}${percent}%`,
    tone: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
    previous,
    note: ''
  };
}

const selection = computed(() => {
  const years = range.value.years;
  if (!years.length) return null;

  if (selectedMonthKey.value) {
    for (const year of years) {
      const month = year.months.find((item) => item.key === selectedMonthKey.value);
      if (!month) continue;
      const previous = allTotals.value.months.get(addMonths(month.key, -1)) || 0;
      return {
        isMonth: true,
        label: monthLabel(month.key),
        total: month.total,
        count: month.count,
        average: month.total / (month.daysInRange || 1),
        days: month.daysInRange,
        activeDays: month.activeDays,
        previousLabel: '上月',
        comparison: compare(month.total, previous)
      };
    }
  }

  const year = years.find((item) => item.year === selectedYear.value) || years[0];
  const previous = allTotals.value.years.get(year.year - 1) || 0;
  return {
    isMonth: false,
    label: `${year.year} 年`,
    total: year.total,
    count: year.count,
    average: year.total / (year.months.length || 1),
    months: year.months.length,
    activeMonths: year.activeMonths,
    previousLabel: '上年',
    comparison: compare(year.total, previous)
  };
});

watch(
  [ready, dataVersion],
  async () => {
    if (!ready.value) {
      loading.value = true;
      return;
    }

    loading.value = true;
    try {
      const state = await loadDayStats();
      allDays.value = [...state.days.entries()]
        .map(([key, bucket]) => ({ ...bucket, key }))
        .sort((a, b) => a.key.localeCompare(b.key));
      minDate.value = state.minDate;
      maxDate.value = state.maxDate;

      if (!initialized.value) {
        initialized.value = true;
        if (allDays.value.length) {
          endDate.value = latestDay.value;
          const recentStart = shiftYear(endDate.value, -1);
          startDate.value = earliestDay.value && recentStart < earliestDay.value
            ? earliestDay.value
            : recentStart;
        } else {
          startDate.value = today;
          endDate.value = today;
        }
      }
    } finally {
      loading.value = false;
    }
  },
  { immediate: true }
);

watch(startDate, (value) => {
  if (value && endDate.value && value > endDate.value) endDate.value = value;
});

watch(endDate, (value) => {
  if (value && startDate.value && value < startDate.value) startDate.value = value;
});

watch(range, (value) => {
  const years = value.years;
  if (!years.length) {
    selectedYear.value = null;
    selectedMonthKey.value = '';
    return;
  }

  if (selectedMonthKey.value && !years.some((year) =>
    year.months.some((month) => month.key === selectedMonthKey.value)
  )) {
    selectedMonthKey.value = '';
  }

  if (!years.some((year) => year.year === selectedYear.value)) {
    selectedYear.value = years[0].year;
    selectedMonthKey.value = '';
  }
}, { immediate: true });

function selectYear(year) {
  haptic('light');
  selectedYear.value = year.year;
  selectedMonthKey.value = '';
}

function selectMonth(month) {
  haptic('light');
  selectedMonthKey.value = month.key;
}

function goBack() {
  if (window.history.length > 1) router.back();
  else router.push('/records');
}
</script>
