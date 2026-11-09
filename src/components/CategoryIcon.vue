<template>
  <span class="category-icon-visual">
    <img v-if="src" :src="src" alt="" draggable="false" />
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
</script>
