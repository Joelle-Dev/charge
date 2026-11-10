<template>
  <span class="category-icon-visual">
    <span
      v-if="src"
      class="category-icon-mask"
      :style="maskStyle"
      aria-hidden="true"
    />
    <span v-else aria-hidden="true">{{ name || '·' }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { iconSourceFor } from '../utils/categoryIconSources';

const props = defineProps({
  name: { type: String, default: '' }
});

const src = computed(() => iconSourceFor(props.name));
const maskStyle = computed(() => (
  src.value ? { '--category-icon-src': `url("${src.value}")` } : undefined
));
</script>
