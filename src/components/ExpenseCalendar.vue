<template>
  <div class="calendar-card">
    <div class="calendar-weekdays" aria-hidden="true">
      <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
    </div>
    <div class="calendar-grid">
      <template v-for="cell in cells" :key="cell.dateKey">
        <span v-if="!cell.inMonth" class="calendar-blank" aria-hidden="true"></span>
        <button
          v-else
          class="calendar-day"
          :class="{
            today: cell.isToday,
            selected: cell.dateKey === selectedDate,
            weekend: cell.isWeekend,
            'has-spend': cell.amount > 0,
            [`heat-${cell.heat}`]: cell.amount > 0
          }"
          type="button"
          :data-date="cell.dateKey"
          :aria-pressed="cell.dateKey === selectedDate"
          :aria-label="cell.ariaLabel"
          @click="$emit('select-day', cell.dateKey)"
        >
          <span class="calendar-day-number">{{ cell.day }}</span>
          <span v-if="cell.amount > 0" class="calendar-day-amount" aria-hidden="true">
            {{ cell.amountLabel }}
          </span>
          <span v-else class="calendar-day-empty" aria-hidden="true"></span>
        </button>
      </template>
    </div>
    <div class="calendar-legend" aria-hidden="true">
      <span>少</span>
      <i class="legend-1"></i>
      <i class="legend-2"></i>
      <i class="legend-3"></i>
      <i class="legend-4"></i>
      <span>多</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { buildCalendarGrid, fullDayLabel } from '../utils/months';
import { dayKey, formatMoney } from '../utils/format';

const props = defineProps({
  month: { type: String, required: true },
  expenses: { type: Array, default: () => [] },
  selectedDate: { type: String, default: '' }
});

defineEmits(['select-day']);

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

const dailyTotals = computed(() => {
  const totals = new Map();
  for (const expense of props.expenses) {
    const key = dayKey(new Date(expense.spentAt));
    totals.set(key, (totals.get(key) || 0) + (Number(expense.amount) || 0));
  }
  return totals;
});

const maxDaily = computed(() => Math.max(1, ...dailyTotals.value.values()));

const cells = computed(() => {
  const max = maxDaily.value;
  return buildCalendarGrid(props.month).map((cell) => {
    if (!cell.inMonth) {
      return { ...cell, amount: 0, heat: 0, amountLabel: '', ariaLabel: '' };
    }

    const amount = dailyTotals.value.get(cell.dateKey) || 0;
    return {
      ...cell,
      amount,
      heat: heatForAmount(amount, max),
      amountLabel: compactAmount(amount),
      ariaLabel: `${fullDayLabel(cell.dateKey)}${amount ? `，支出 ¥${formatMoney(amount)}` : '，没有支出'}`
    };
  });
});

function heatForAmount(amount, max) {
  if (!amount) return 0;
  const ratio = amount / max;
  if (ratio >= 0.8) return 4;
  if (ratio >= 0.55) return 3;
  if (ratio >= 0.3) return 2;
  return 1;
}

function compactAmount(amount) {
  if (!amount) return '';
  if (amount >= 1000) {
    const value = amount >= 10000
      ? String(Math.round(amount / 1000))
      : (amount / 1000).toFixed(1).replace(/\.0$/, '');
    return `¥${value}k`;
  }
  return `¥${Math.round(amount)}`;
}
</script>
