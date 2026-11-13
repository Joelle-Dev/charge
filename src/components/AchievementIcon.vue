<template>
  <PawIcon v-if="type === 'paw'" />
  <svg v-else-if="type === 'bowl'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 11h16"></path>
    <path d="M6.5 11c0 4.6 2 7 5.5 7s5.5-2.4 5.5-7"></path>
    <path d="M9 8c.4-1.8 1.4-2.8 3-3.2"></path>
  </svg>
  <svg v-else-if="type === 'star'" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.4l6.3-.9L12 2.8Z"></path>
  </svg>
  <svg v-else-if="type === 'cake'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4.5 20h15v-5.5a2.5 2.5 0 0 0-2.5-2.5H7a2.5 2.5 0 0 0-2.5 2.5V20Z"></path>
    <path d="M4.5 15.5c1.4 1.1 2.3 1.1 3.7 0 1.3-1.1 2.3-1.1 3.6 0 1.4 1.1 2.3 1.1 3.7 0 1.3-1.1 2.3-1.1 3.6 0"></path>
    <path d="M12 9.5V7"></path>
    <path d="M12 7c.9-1 .6-2.1-.4-2.7-.8 1.3-.4 2.3.4 2.7Z" fill="currentColor" stroke="none"></path>
  </svg>
  <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4 8.5 8 12l4-6 4 6 4-3.5-1.5 9h-13L4 8.5Z"></path>
  </svg>
</template>

<script setup>
import PawIcon from './PawIcon.vue';

defineProps({
  type: { type: String, default: 'paw' }
});
</script>
