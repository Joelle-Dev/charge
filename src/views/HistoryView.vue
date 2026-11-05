<template>
  <section class="history-page">
    <header class="history-head" :class="{ 'is-embedded': embedded }">
      <button
        class="records-back"
        type="button"
        :aria-label="embedded ? '返回记账' : '返回'"
        @click="goBack"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6"></path>
        </svg>
      </button>
      <div class="history-title">
        <h1>花过的钱</h1>
      </div>
      <span v-if="embedded" class="history-head-spacer" aria-hidden="true"></span>
    </header>

    <section class="history-range">
      <div class="history-scope">
        <div class="history-scope-switch" role="group" aria-label="统计范围">
          <button
            type="button"
            :disabled="!currentStage"
            :class="{ active: stageScope === 'current' }"
            @click="setScope('current')"
          >
            当前账本
          </button>
          <button
            type="button"
            :class="{ active: stageScope === 'all' }"
            @click="setScope('all')"
          >
            全部账本
          </button>
        </div>
        <span class="history-scope-note">
          {{ stageScope === 'current'
            ? `只看「${currentStage?.name || '当前账本'}」`
            : '全部账本都算上（含已归档）' }}
        </span>
      </div>
      <div class="history-range-head">
        <span class="history-range-label">想翻哪段时间</span>
        <div class="history-presets">
          <button
            class="history-preset"
            :class="{ active: activePreset === 'recent' }"
            type="button"
            @click="useRecentRange"
          >
            近一年
          </button>
          <button
            class="history-preset"
            :class="{ active: activePreset === 'year' }"
            type="button"
            @click="useThisYear"
          >
            今年
          </button>
          <button
            class="history-preset"
            :class="{ active: activePreset === 'all' }"
            type="button"
            @click="useAllRange"
          >
            全部
          </button>
        </div>
      </div>
      <div class="history-range-fields">
        <div class="history-date">
          <span>从</span>
          <DateTimeField v-model="startDate" type="date" label="开始" title="挑个开始日子" />
        </div>
        <span class="history-range-dash" aria-hidden="true">—</span>
        <div class="history-date">
          <span>到</span>
          <DateTimeField v-model="endDate" type="date" label="结束" title="挑个结束日子" />
        </div>
      </div>
      <p v-if="!loading && range.count" class="history-range-summary">
        这段时间 {{ range.count }} 笔 · ¥{{ displayMoney(range.total, hideAmount) }}
      </p>
    </section>

    <div v-if="loading" class="loading-state">
      <span class="loading-dot"></span>
      果冻在翻旧账本…
    </div>

    <template v-else-if="selection">
      <section class="history-hero">
        <div class="history-hero-top">
          <div>
            <span class="history-hero-eyebrow">{{ selection.isMonth ? '这个月花了' : '这一年花了' }}</span>
            <h2>{{ selection.label }}</h2>
          </div>
          <div class="history-hero-side">
            <span class="history-hero-count">{{ selection.count }} 笔</span>
            <PrivacyToggle class="history-eye" />
          </div>
        </div>
        <strong class="history-hero-total">
          <span class="currency">¥</span>{{ displayMoney(selection.total, hideAmount) }}
        </strong>
        <div class="history-stats">
          <div class="history-stat">
            <span>{{ selection.isMonth ? '日均' : '月均' }}</span>
            <b>¥{{ displayMoney(selection.average, hideAmount) }}</b>
            <small>{{ selection.isMonth ? `按 ${selection.days} 天` : `按 ${selection.months} 个月` }}</small>
          </div>
          <div class="history-stat">
            <span>{{ selection.isMonth ? '花钱的日子' : '花钱的月份' }}</span>
            <b>{{ selection.isMonth ? `${selection.activeDays} 天` : `${selection.activeMonths} 个月` }}</b>
          </div>
          <div class="history-stat">
            <span>{{ selection.isMonth ? '较上月' : '较上年' }}</span>
            <b :class="`history-compare-${selection.comparison.tone}`">{{ selection.comparison.text }}</b>
            <small v-if="selection.comparison.previous">
              {{ selection.previousLabel }} ¥{{ displayMoney(selection.comparison.previous, hideAmount) }}
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
            <span class="history-year-total">¥{{ displayMoney(year.total, hideAmount) }}</span>
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
            <span class="history-month-amount">{{ month.total ? `¥${displayMoney(month.total, hideAmount)}` : '—' }}</span>
          </button>
        </div>
      </section>
    </template>

    <div v-else class="history-empty">
      <p>这段时间果冻没花钱</p>
      <button class="secondary-btn" type="button" @click="showAllHistory">
        {{ stageScope === 'current' && !allDays.length ? '看看全部账本' : '看看全部历史' }}
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import DateTimeField from '../components/DateTimeField.vue';
import PrivacyToggle from '../components/PrivacyToggle.vue';
import { useLedger } from '../composables/useLedger';
import { useLedgerPanes } from '../composables/useLedgerPanes';
import { loadDayStats } from '../lib/stats';
import { displayMoney, pad2, toDateInput } from '../utils/format';
import { addMonths, monthLabel } from '../utils/months';
import { haptic } from '../utils/haptics';
import { usePrivacy } from '../composables/usePrivacy';

const router = useRouter();
const props = defineProps({
  embedded: { type: Boolean, default: false },
  active: { type: Boolean, default: true }
});
const { ready, dataVersion, currentStage } = useLedger();
const { goToPane } = useLedgerPanes();
const { hideAmount } = usePrivacy();
const today = toDateInput(new Date());

const loading = ref(true);
const initialized = ref(false);
const stageScope = ref('all');
const allDays = ref([]);
const minDate = ref('');
const maxDate = ref('');
const startDate = ref('');
const endDate = ref('');
const selectedYear = ref(null);
const selectedMonthKey = ref('');
const presetChoice = ref('');
const yearRailRef = ref(null);
const monthRailRef = ref(null);
let initializedScope = '';

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

function recentRange() {
  const end = latestDay.value || today;
  const from = shiftYear(end, -1);
  return {
    from: earliestDay.value && from < earliestDay.value ? earliestDay.value : from,
    to: end
  };
}

function thisYearRange() {
  const end = today;
  return { from: `${end.slice(0, 4)}-01-01`, to: end };
}

function allRange() {
  return { from: earliestDay.value || today, to: latestDay.value || today };
}

function useRecentRange() {
  presetChoice.value = 'recent';
  const rangeValue = recentRange();
  setRange(rangeValue.from, rangeValue.to);
}

function useThisYear() {
  presetChoice.value = 'year';
  const rangeValue = thisYearRange();
  setRange(rangeValue.from, rangeValue.to);
}

function useAllRange() {
  presetChoice.value = 'all';
  const rangeValue = allRange();
  setRange(rangeValue.from, rangeValue.to);
}

function presetRanges() {
  return {
    recent: recentRange(),
    year: thisYearRange(),
    all: allRange()
  };
}

const activePreset = computed(() => {
  if (!startDate.value || !endDate.value) return '';
  const ranges = presetRanges();
  const chosen = ranges[presetChoice.value];
  if (chosen && startDate.value === chosen.from && endDate.value === chosen.to) {
    return presetChoice.value;
  }
  if (startDate.value === ranges.recent.from && endDate.value === ranges.recent.to) return 'recent';
  if (startDate.value === ranges.year.from && endDate.value === ranges.year.to) return 'year';
  if (startDate.value === ranges.all.from && endDate.value === ranges.all.to) return 'all';
  return '';
});

function setScope(scope) {
  if (scope === 'current' && !currentStage.value) return;
  if (stageScope.value === scope) return;
  stageScope.value = scope;
  presetChoice.value = '';
  haptic('light');
}

function showAllHistory() {
  if (stageScope.value === 'current' && !allDays.value.length) {
    stageScope.value = 'all';
    return;
  }
  useAllRange();
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
      note: current ? '之前没花钱' : ''
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
  [ready, dataVersion, () => props.active, stageScope, () => currentStage.value?.id],
  async () => {
    if (props.embedded && !props.active) return;
    if (!ready.value) {
      loading.value = true;
      return;
    }

    const stageId = stageScope.value === 'current' ? currentStage.value?.id : null;
    if (stageScope.value === 'current' && !stageId) {
      allDays.value = [];
      minDate.value = '';
      maxDate.value = '';
      startDate.value = today;
      endDate.value = today;
      initialized.value = false;
      initializedScope = '';
      loading.value = false;
      return;
    }

    loading.value = true;
    try {
      const state = await loadDayStats(stageId ? { stageId } : {});
      allDays.value = [...state.days.entries()]
        .map(([key, bucket]) => ({ ...bucket, key }))
        .sort((a, b) => a.key.localeCompare(b.key));
      minDate.value = state.minDate;
      maxDate.value = state.maxDate;

      const scopeKey = stageId || 'all';
      if (initializedScope !== scopeKey) {
        initializedScope = scopeKey;
        initialized.value = false;
      }

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

watch([startDate, endDate], () => {
  if (!presetChoice.value) return;
  const chosen = presetRanges()[presetChoice.value];
  if (!chosen || startDate.value !== chosen.from || endDate.value !== chosen.to) {
    presetChoice.value = '';
  }
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
  haptic('light');
  if (props.embedded) {
    goToPane('record');
    return;
  }
  if (window.history.length > 1) router.back();
  else router.push('/records');
}
</script>
