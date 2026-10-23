<template>
  <van-popup
    v-model:show="show"
    position="bottom"
    round
    teleport="body"
    class="sheet-popup"
    :style="{ maxHeight }"
  >
    <div class="sheet-page" :style="{ maxHeight }">
      <div class="sheet-grab" aria-hidden="true"></div>
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
    </div>
  </van-popup>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  maxHeight: { type: String, default: '92dvh' }
});

const show = defineModel('show', { type: Boolean, default: false });
</script>
