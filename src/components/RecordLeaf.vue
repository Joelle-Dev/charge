<template>
  <article class="timeline-item">
    <button
      class="timeline-avatar"
      type="button"
      :aria-label="`更多操作：${expense.noteText || expense.category} ${formatAmount(expense.amount)}元`"
      aria-haspopup="dialog"
      @click.stop="emit('menu', expense)"
    >
      {{ initial }}
    </button>

    <button
      class="timeline-entry"
      type="button"
      :aria-label="`查看 ${expense.noteText || expense.category} ${formatAmount(expense.amount)}元`"
      @click="emit('select', expense)"
    >
      <span class="timeline-entry-top">
        <span class="timeline-category-name">{{ expense.category }}</span>
        <span class="timeline-amount">{{ formatAmount(expense.amount) }}元</span>
      </span>
      <span v-if="expense.noteText" class="timeline-note">{{ expense.noteText }}</span>
    </button>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { formatAmount } from '../utils/format';

const props = defineProps({
  expense: { type: Object, required: true }
});
const emit = defineEmits(['select', 'menu']);

const initial = computed(() => (props.expense.category || '其他').slice(0, 1));
</script>
