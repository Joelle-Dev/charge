<template>
  <button
    class="expense-item"
    type="button"
    :style="{ '--swatch': categoryColor(expense.category) }"
    :aria-label="`编辑 ${title} ¥${formatMoney(expense.amount)}`"
    @click="$emit('select', expense)"
  >
    <span class="category-icon">{{ initial }}</span>
    <span class="expense-main">
      <span class="expense-title">{{ title }}</span>
      <span class="expense-meta">
        <span>{{ expense.category }}</span>
        <span class="dot"></span>
        <template v-if="showDate">
          <span>{{ dateLabel }}</span>
          <span class="dot"></span>
        </template>
        <span>{{ formatTime(expense.spentAt) }}</span>
      </span>
    </span>
    <span class="expense-amount">¥{{ formatMoney(expense.amount) }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue';
import { categoryColor, dayKey, dayLabel, formatMoney, formatTime } from '../utils/format';

const props = defineProps({
  expense: { type: Object, required: true },
  showDate: { type: Boolean, default: false }
});

defineEmits(['select']);

const title = computed(() => props.expense.note || props.expense.category);
const initial = computed(() => (props.expense.category || '其他').slice(0, 1));
const dateLabel = computed(() => dayLabel(dayKey(new Date(props.expense.spentAt))));
</script>
