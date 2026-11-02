<template>
  <button
    class="record-leaf"
    type="button"
    :aria-label="`查看 ${expense.noteText || expense.category} ¥${formatMoney(expense.amount)}`"
    @click="emit('select', expense)"
  >
    <span class="record-leaf-top">
      <span class="record-leaf-content">
        <span class="record-leaf-category">{{ expense.category }}</span>
        <span class="record-expense-time">{{ formatTime(expense.spentAt) }}</span>
      </span>
      <span class="record-leaf-amount">¥{{ formatMoney(expense.amount) }}</span>
    </span>
    <span v-if="expense.noteText" class="record-leaf-note" :title="expense.noteText">{{ expense.noteText }}</span>
  </button>
</template>

<script setup>
import { formatMoney, formatTime } from '../utils/format';

defineProps({
  expense: { type: Object, required: true }
});
const emit = defineEmits(['select']);
</script>
