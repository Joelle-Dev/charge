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
        <span>{{ formatTime(expense.spentAt) }}</span>
      </span>
    </span>
    <span class="expense-amount">¥{{ amountLabel }}</span>
  </component>
</template>

<script setup>
import { computed } from 'vue';
import { usePrivacy } from '../composables/usePrivacy';
import { categoryColor, displayMoney, formatTime } from '../utils/format';

const props = defineProps({
  expense: { type: Object, required: true },
  readonly: { type: Boolean, default: false }
});

const emit = defineEmits(['select']);

const { hideAmount } = usePrivacy();

const title = computed(() => props.expense.note || props.expense.category);
const initial = computed(() => (props.expense.category || '其他').slice(0, 1));
const amountLabel = computed(() => displayMoney(props.expense.amount, hideAmount.value));
const itemLabel = computed(() => {
  const amount = `¥${amountLabel.value}`;
  return props.readonly ? `${title.value} ${amount}` : `编辑 ${title.value} ${amount}`;
});

function onClick() {
  if (props.readonly) return;
  emit('select', props.expense);
}
</script>
