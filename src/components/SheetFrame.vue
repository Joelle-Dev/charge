<template>
  <van-popup
    v-model:show="show"
    position="bottom"
    round
    teleport="body"
    class="sheet-popup"
    :style="{ maxHeight }"
  >
    <div class="sheet-page" :style="pageStyle">
      <div
        class="sheet-grab"
        aria-hidden="true"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
      ></div>
      <header class="sheet-head">
        <h2>{{ title }}</h2>
        <button class="icon-btn" type="button" aria-label="关闭" @click="show = false">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"></path>
          </svg>
        </button>
      </header>
      <div class="sheet-body">
        <slot />
      </div>
      <slot name="overlay" />
    </div>
  </van-popup>
</template>

<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  title: { type: String, default: '' },
  maxHeight: { type: String, default: '92dvh' }
});

const show = defineModel('show', { type: Boolean, default: false });
const dragY = ref(0);
const dragging = ref(false);
let startY = 0;
let startTime = 0;

const pageStyle = computed(() => ({
  maxHeight: props.maxHeight,
  transform: `translateY(${dragY.value}px)`,
  transition: dragging.value ? 'none' : 'transform 0.22s var(--ease-out)'
}));

function onTouchStart(event) {
  if (event.touches.length !== 1) return;
  dragging.value = true;
  startY = event.touches[0].clientY;
  startTime = performance.now();
}

function onTouchMove(event) {
  if (!dragging.value || event.touches.length !== 1) return;
  const delta = Math.max(0, event.touches[0].clientY - startY);
  dragY.value = delta;
  if (delta > 0 && event.cancelable) event.preventDefault();
}

function onTouchEnd() {
  if (!dragging.value) return;
  dragging.value = false;
  const delta = dragY.value;
  const duration = performance.now() - startTime;
  const shouldClose = delta > 90 || (delta > 32 && duration < 260);

  if (shouldClose) {
    show.value = false;
    setTimeout(() => {
      dragY.value = 0;
    }, 250);
  } else {
    dragY.value = 0;
  }
}

watch(show, (visible) => {
  if (visible) dragY.value = 0;
});
</script>
