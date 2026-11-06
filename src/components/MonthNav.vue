<template>
  <div :class="variant === 'record' ? 'record-month-nav' : 'month-nav'">
    <button :class="arrowClass" type="button" aria-label="上个月" @click="emit('shift', -1)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m15 18-6-6 6-6"></path>
      </svg>
    </button>
    <button :class="labelClass" type="button" @click="emit('pick')">
      {{ label }}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6"></path>
      </svg>
    </button>
    <button :class="arrowClass" type="button" aria-label="下个月" @click="emit('shift', 1)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m9 18 6-6-6-6"></path>
      </svg>
    </button>
    <div v-if="$slots.actions" class="month-nav-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: { type: String, required: true },
  variant: { type: String, default: 'page' }
});
const emit = defineEmits(['shift', 'pick']);

const arrowClass = computed(() => (props.variant === 'record' ? 'record-month-arrow' : 'month-arrow'));
const labelClass = computed(() => (props.variant === 'record' ? 'record-month-label' : 'month-label'));
</script>
