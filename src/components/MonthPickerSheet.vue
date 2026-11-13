<template>
  <SheetFrame v-model:show="show" :title="footprint ? '花钱足迹' : '翻到哪个月'" max-height="86dvh">
    <template v-if="footprint">
      <div class="month-picker-year is-compact">
        <button
          class="month-year-arrow"
          type="button"
          aria-label="上一年"
          :disabled="!canPrevYear"
          @click="stepYear(-1)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6"></path>
          </svg>
        </button>
        <strong>{{ selectedYear }}年</strong>
        <button
          class="month-year-arrow"
          type="button"
          aria-label="下一年"
          :disabled="!canNextYear"
          @click="stepYear(1)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6"></path>
          </svg>
        </button>
      </div>

      <div ref="stripRef" class="month-strip" role="tablist" aria-label="选择月份">
        <button
          v-for="chip in monthChips"
          :key="chip.key"
          class="month-chip"
          :class="{ active: chip.key === selectedMonth }"
          type="button"
          role="tab"
          :aria-selected="chip.key === selectedMonth"
          :aria-label="`${chip.year}年${chip.month}月`"
          :disabled="chip.disabled"
          @click="selectChip(chip.key)"
        >
          <strong>{{ chip.month }}月</strong>
        </button>
      </div>

      <div class="month-footprint" :class="{ 'is-loading': loading }">
        <div class="month-footprint-head">
          <strong>{{ monthLabel(selectedMonth) }}</strong>
          <div class="report-calendar-legend" aria-hidden="true">
            <span>少</span>
            <i v-for="level in [0, 1, 2, 3, 4]" :key="level" :class="`level-${level}`"></i>
            <span>多</span>
          </div>
        </div>
        <div class="report-calendar-weekdays" aria-hidden="true">
          <span v-for="weekday in WEEKDAY_LABELS" :key="weekday">{{ weekday }}</span>
        </div>
        <div class="report-calendar-grid">
          <button
            v-for="(cell, index) in dayCells"
            :key="cell ? cell.key : `pad-${index}`"
            class="report-calendar-cell"
            :class="{
              'is-empty': !cell,
              'is-future': cell?.isFuture,
              'is-today': cell?.isToday,
              [`level-${cell?.level || 0}`]: cell
            }"
            type="button"
            :disabled="!cell || !cell.amount"
            :aria-label="dayCellLabel(cell)"
            @click="pickDay(cell)"
          >
            <template v-if="cell">
              <span class="report-calendar-day">{{ cell.day }}</span>
              <span v-if="cell.amount" class="report-calendar-amount">{{ compactAmount(cell.amount) }}</span>
            </template>
          </button>
        </div>
        <p class="month-footprint-hint">点有消费的日子，直接看当天的明细</p>
      </div>

      <div v-if="selectedMonth !== currentMonthKey()" class="month-picker-footer">
        <button class="secondary-btn" type="button" @click="selectChip(currentMonthKey())">
          回到这个月
        </button>
      </div>
    </template>

    <template v-else>
      <div class="month-picker-year">
        <button class="month-year-arrow" type="button" aria-label="上一年" @click="pickerYear -= 1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6"></path>
          </svg>
        </button>
        <strong>{{ pickerYear }}年</strong>
        <button class="month-year-arrow" type="button" aria-label="下一年" @click="pickerYear += 1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6"></path>
          </svg>
        </button>
      </div>

      <div class="month-grid">
        <button
          v-for="item in monthCells"
          :key="item.key"
          class="month-cell"
          :class="{ selected: item.key === selectedMonth, empty: !item.count }"
          type="button"
          @click="choose(item.key)"
        >
          <strong>{{ item.label }}</strong>
          <span>{{ item.count ? `${item.count} 笔` : '空空的' }}</span>
        </button>
      </div>

      <div class="month-picker-footer">
        <button class="secondary-btn" type="button" @click="choose(currentMonthKey())">回到这个月</button>
        <button v-if="selectedMonth !== currentMonthKey()" class="text-btn" type="button" @click="show = false">
          取消
        </button>
      </div>
    </template>
  </SheetFrame>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import SheetFrame from './SheetFrame.vue';
import { useLedger } from '../composables/useLedger';
import { currentMonthKey, monthLabel } from '../utils/months';
import { compactAmount, dayKey, formatAmount } from '../utils/format';

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

const show = defineModel('show', { type: Boolean, default: false });
const props = defineProps({
  selectedMonth: { type: String, required: true },
  footprint: { type: Boolean, default: false },
  dayTotals: { type: Map, default: null },
  loading: { type: Boolean, default: false }
});
const emit = defineEmits(['select', 'pick-day']);

const { currentStageMonthStats, globalStats } = useLedger();
const pickerYear = ref(Number(props.selectedMonth.split('-')[0]));
const stripRef = ref(null);

const monthCells = computed(() =>
  Array.from({ length: 12 }, (_, index) => {
    const key = `${pickerYear.value}-${String(index + 1).padStart(2, '0')}`;
    return {
      key,
      label: `${index + 1}月`,
      count: currentStageMonthStats.value.get(key)?.count || 0
    };
  })
);

const selectedYear = computed(() => Number(props.selectedMonth.split('-')[0]));
const currentYear = computed(() => Number(currentMonthKey().split('-')[0]));
const earliestYear = computed(() => {
  const minDate = String(globalStats.value?.minDate || '');
  return /^\d{4}/.test(minDate) ? Number(minDate.slice(0, 4)) : currentYear.value;
});
const canPrevYear = computed(() => selectedYear.value > earliestYear.value);
const canNextYear = computed(() => selectedYear.value < currentYear.value);

const monthChips = computed(() =>
  Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const key = `${selectedYear.value}-${String(month).padStart(2, '0')}`;
    return {
      key,
      year: selectedYear.value,
      month,
      disabled: key > currentMonthKey()
    };
  })
);

const dayCells = computed(() => {
  const [year, monthNumber] = props.selectedMonth.split('-').map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  const firstWeekday = new Date(year, monthNumber - 1, 1).getDay();
  const leading = (firstWeekday + 6) % 7;
  const totals = props.dayTotals;
  const maxDay = totals && totals.size
    ? Math.max(1, ...[...totals.values()].map((bucket) => bucket.total))
    : 1;
  const todayKey = dayKey(new Date());

  const cells = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= days; day += 1) {
    const key = `${props.selectedMonth}-${String(day).padStart(2, '0')}`;
    const bucket = totals?.get(key);
    const amount = bucket?.total || 0;
    let level = 0;
    if (amount > 0) {
      level = Math.min(4, Math.ceil(amount / maxDay * 4));
    }
    cells.push({
      key,
      day,
      amount,
      level,
      isFuture: key > todayKey,
      isToday: key === todayKey
    });
  }
  return cells;
});

watch(show, (visible) => {
  if (!visible) return;
  pickerYear.value = Number(props.selectedMonth.split('-')[0]);
  if (props.footprint) scrollActiveChip();
});

watch(() => props.selectedMonth, () => {
  if (show.value && props.footprint) scrollActiveChip();
});

async function scrollActiveChip() {
  await nextTick();
  const strip = stripRef.value;
  if (!strip) return;
  const active = strip.querySelector('.month-chip.active');
  if (!active) return;
  const width = strip.clientWidth;
  if (!width) {
    window.requestAnimationFrame(() => {
      const left = active.offsetLeft - strip.clientWidth / 2 + active.offsetWidth / 2;
      strip.scrollLeft = Math.max(0, left);
    });
    return;
  }
  const left = active.offsetLeft - width / 2 + active.offsetWidth / 2;
  strip.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
}

function dayCellLabel(cell) {
  if (!cell) return '';
  if (!cell.amount) return cell.key;
  return `${cell.key}，花费 ${formatAmount(cell.amount)}，点开看当天明细`;
}

function selectChip(key) {
  if (key > currentMonthKey() || key === props.selectedMonth) return;
  emit('select', key);
}

function stepYear(delta) {
  const targetYear = selectedYear.value + delta;
  if (targetYear < earliestYear.value || targetYear > currentYear.value) return;
  const monthPart = props.selectedMonth.slice(5);
  let key = `${targetYear}-${monthPart}`;
  if (key > currentMonthKey()) key = currentMonthKey();
  if (key === props.selectedMonth) return;
  emit('select', key);
}

function choose(key) {
  emit('select', key);
  show.value = false;
}

function pickDay(cell) {
  if (!cell || !cell.amount) return;
  emit('pick-day', cell.key);
  show.value = false;
}
</script>
