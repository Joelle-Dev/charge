<template>
  <div class="avatar-crop">
    <p class="avatar-crop-hint">拖动调整位置，滑块缩放</p>

    <div
      ref="stageRef"
      class="avatar-crop-stage"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <img
        :src="state.previewUrl"
        alt=""
        draggable="false"
        :style="imageStyle"
      >
      <span class="avatar-crop-mask" aria-hidden="true"></span>
    </div>

    <label class="avatar-crop-zoom">
      <span>缩放</span>
      <input
        v-model.number="zoom"
        type="range"
        min="1"
        max="3"
        step="0.01"
        aria-label="缩放头像"
        @input="clampOffsets"
      >
    </label>

    <div class="avatar-crop-actions">
      <button class="secondary-btn" type="button" :disabled="busy" @click="emit('cancel')">先不裁</button>
      <button class="primary-btn" type="button" :disabled="busy" @click="confirm">
        {{ busy ? '果冻在裁…' : '就这张' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  avatarBaseScale,
  clampAvatarOffset,
  renderAvatarDataUrl
} from '../utils/avatarImage';
import { haptic } from '../utils/haptics';

const props = defineProps({
  state: { type: Object, required: true }
});
const emit = defineEmits(['cancel', 'done', 'error']);

const stageRef = ref(null);
const stageSize = ref(240);
const zoom = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);
const busy = ref(false);
let dragging = false;
let pointerId = null;
let startX = 0;
let startY = 0;
let originX = 0;
let originY = 0;
let observer = null;

const scale = computed(() => avatarBaseScale(props.state.width, props.state.height, stageSize.value) * zoom.value);

const imageStyle = computed(() => ({
  width: `${props.state.width * scale.value}px`,
  height: `${props.state.height * scale.value}px`,
  transform: `translate(-50%, -50%) translate(${offsetX.value}px, ${offsetY.value}px)`
}));

function measure() {
  const width = stageRef.value?.clientWidth || 0;
  if (width > 0) stageSize.value = width;
}

function clampOffsets() {
  const next = clampAvatarOffset(
    props.state.width,
    props.state.height,
    stageSize.value,
    zoom.value,
    offsetX.value,
    offsetY.value
  );
  offsetX.value = next.x;
  offsetY.value = next.y;
}

watch(stageSize, (size, previous) => {
  if (!previous || !size) return;
  const ratio = size / previous;
  offsetX.value *= ratio;
  offsetY.value *= ratio;
  clampOffsets();
});

watch(zoom, clampOffsets);

function onPointerDown(event) {
  if (busy.value || event.button > 0) return;
  dragging = true;
  pointerId = event.pointerId;
  startX = event.clientX;
  startY = event.clientY;
  originX = offsetX.value;
  originY = offsetY.value;
  stageRef.value?.setPointerCapture?.(pointerId);
}

function onPointerMove(event) {
  if (!dragging || event.pointerId !== pointerId) return;
  offsetX.value = originX + (event.clientX - startX);
  offsetY.value = originY + (event.clientY - startY);
  clampOffsets();
}

function onPointerUp(event) {
  if (!dragging || (event && event.pointerId !== pointerId)) return;
  dragging = false;
  stageRef.value?.releasePointerCapture?.(pointerId);
  pointerId = null;
}

async function confirm() {
  if (busy.value) return;
  busy.value = true;
  try {
    const dataUrl = await renderAvatarDataUrl(props.state.source, {
      stageSize: stageSize.value,
      zoom: zoom.value,
      offsetX: offsetX.value,
      offsetY: offsetY.value
    });
    haptic('light');
    emit('done', dataUrl);
  } catch (err) {
    emit('error', err);
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  measure();
  if (typeof ResizeObserver === 'function' && stageRef.value) {
    observer = new ResizeObserver(measure);
    observer.observe(stageRef.value);
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});
</script>
