<template>
  <div class="loading-state" :class="{ 'is-inline': inline }" role="status" aria-live="polite">
    <span class="loading-orb" aria-hidden="true">
      <span class="loading-orb-paw"><PawIcon /></span>
      <span class="loading-orb-ring"></span>
    </span>
    <span class="loading-text">{{ text }}</span>
  </div>
</template>

<script setup>
import PawIcon from './PawIcon.vue';

defineProps({
  text: { type: String, default: '果冻在翻小账本…' },
  inline: { type: Boolean, default: false }
});
</script>
