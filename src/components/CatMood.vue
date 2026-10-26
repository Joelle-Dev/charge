<template>
  <span class="cat-avatar" :class="`mood-${mood}`">
    <img :src="brandIcon" alt="">
  </span>
</template>

<script setup>
import brandIcon from '../assets/brand-icon.png';

defineProps({
  mood: {
    type: String,
    default: 'happy'
  }
});
</script>

<style scoped>
.cat-avatar {
  display: block;
  width: 100%;
  height: 100%;
}

.cat-avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform-origin: 50% 80%;
}

.mood-happy img {
  transform: rotate(-2deg);
}

.mood-watch img {
  transform: rotate(1.5deg);
}

.mood-worried img {
  transform: translateY(1px) rotate(-1deg);
}

.mood-sad img {
  transform: translateY(2px) rotate(-3deg);
  filter: saturate(0.9);
}

.mood-sleep img {
  transform: translateY(2px) rotate(-7deg) scale(0.98);
  opacity: 0.92;
}
</style>
