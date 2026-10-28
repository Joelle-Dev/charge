<template>
  <SheetFrame v-model:show="show" title="选择月份" max-height="86dvh">
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
        <span>{{ item.count ? `${item.count} 笔` : '暂无' }}</span>
      </button>
    </div>

    <div class="month-picker-footer">
      <button class="secondary-btn" type="button" @click="choose(currentMonthKey())">回到本月</button>
      <button v-if="selectedMonth !== currentMonthKey()" class="text-btn" type="button" @click="choose(selectedMonth)">
        取消
      </button>
    </div>
  </SheetFrame>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import SheetFrame from './SheetFrame.vue';
import { useLedger } from '../composables/useLedger';
import { currentMonthKey } from '../utils/months';

const show = defineModel('show', { type: Boolean, default: false });
const props = defineProps({
  selectedMonth: { type: String, required: true }
});
const emit = defineEmits(['select']);

const { currentStageMonthStats } = useLedger();
const pickerYear = ref(Number(props.selectedMonth.split('-')[0]));

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

watch(show, (visible) => {
  if (visible) pickerYear.value = Number(props.selectedMonth.split('-')[0]);
});

function choose(key) {
  emit('select', key);
  show.value = false;
}
</script>
