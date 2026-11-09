<template>
  <article class="timeline-item">
    <button
      class="timeline-avatar"
      type="button"
      :aria-label="`更多操作：${expense.noteText || expense.category} ¥${amountLabel}`"
      @click.stop="emit('menu', expense)"
    >
      <CategoryIcon :name="icon" />
    </button>

    <button
      class="timeline-entry"
      type="button"
      :aria-label="`查看 ${expense.noteText || expense.category} ¥${amountLabel}`"
      @click="emit('select', expense)"
    >
      <span class="timeline-entry-top">
        <span class="timeline-category-name">{{ expense.category }}</span>
        <span class="timeline-amount">¥{{ amountLabel }}</span>
      </span>
      <span v-if="expense.noteText" class="timeline-note">{{ expense.noteText }}</span>
    </button>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import CategoryIcon from './CategoryIcon.vue';
import { useLedger } from '../composables/useLedger';
import { usePrivacy } from '../composables/usePrivacy';
import { displayMoney } from '../utils/format';

const props = defineProps({
  expense: { type: Object, required: true }
});
const emit = defineEmits(['select', 'menu']);

const { hideAmount } = usePrivacy();

const { iconFor } = useLedger();
const icon = computed(() => iconFor(props.expense.category || '其他'));
const amountLabel = computed(() => displayMoney(props.expense.amount, hideAmount.value));
</script>
