<template>
  <button
    type="button"
    :aria-label="hidden ? '显示金额' : '隐藏金额'"
    :aria-pressed="hidden"
    @click="toggle"
  >
    <svg v-if="!hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19"></path>
      <path d="M6.61 6.61A18.5 18.5 0 0 0 2 12s3.5 8 10 8a9.12 9.12 0 0 0 5.39-1.61"></path>
      <line x1="2" x2="22" y1="2" y2="22"></line>
    </svg>
  </button>
</template>

<script setup>
import { computed } from 'vue';
import { usePrivacy } from '../composables/usePrivacy';

const props = defineProps({
  scope: { type: String, default: '' }
});

const { activeScope, scopes, toggleHideAmount } = usePrivacy();
const ownScope = computed(() => props.scope || activeScope.value);
const hidden = computed(() => Boolean(scopes[ownScope.value]));

function toggle() {
  toggleHideAmount(ownScope.value);
}
</script>
