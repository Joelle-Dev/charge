<template>
  <component
    :is="readonly ? 'div' : 'button'"
    class="expense-item"
    :class="{ 'is-readonly': readonly }"
    :type="readonly ? null : 'button'"
    :style="{ '--swatch': categoryColor(expense.category) }"
    :aria-label="itemLabel"
    @click="onClick"
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
  </component>
</template>

<script setup>
import { computed } from 'vue';
import { categoryColor, dayKey, dayLabel, formatMoney, formatTime } from '../utils/format';

const props = defineProps({
  expense: { type: Object, required: true },
  showDate: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false }
});

const emit = defineEmits(['select']);

const title = computed(() => props.expense.note || props.expense.category);
const initial = computed(() => (props.expense.category || '其他').slice(0, 1));
const dateLabel = computed(() => dayLabel(dayKey(new Date(props.expense.spentAt))));
const itemLabel = computed(() => {
  const amount = `¥${formatMoney(props.expense.amount)}`;
  return props.readonly ? `${title.value} ${amount}` : `编辑 ${title.value} ${amount}`;
});

function onClick() {
  if (props.readonly) return;
  emit('select', props.expense);
}
</script>
