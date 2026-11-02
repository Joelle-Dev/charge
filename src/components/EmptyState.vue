<template>
  <section class="empty-state">
    <div class="empty-card">
      <div class="empty-art" aria-hidden="true">
        <span class="empty-ring"></span>
        <span class="empty-paw empty-paw-a"><PawIcon /></span>
        <span class="empty-paw empty-paw-b"><PawIcon /></span>
        <span class="empty-cat"><img class="empty-cat-image" :src="brandIcon" alt=""></span>
      </div>

      <span class="empty-eyebrow">果冻在这里</span>
      <h1>先给果冻一个阶段吧</h1>
      <p>旅行、装修、这个月的日常……<br>把钱钱都装进同一个阶段里。</p>

      <div class="empty-examples" aria-label="阶段示例">
        <button
          v-for="example in examples"
          :key="example"
          class="empty-example"
          type="button"
          @click="useExample(example)"
        >
          {{ example }}
        </button>
      </div>

      <button class="primary-btn" type="button" @click="openStageForm">建个阶段</button>
      <p class="empty-note">建好后随时可以换着用</p>
    </div>
  </section>
</template>

<script setup>
import PawIcon from './PawIcon.vue';
import brandIcon from '../assets/brand-icon.png';
import { useSheets } from '../composables/useSheets';
import { haptic } from '../utils/haptics';

const examples = ['旅行', '装修', '本月日常'];
const sheets = useSheets();

function openStageForm() {
  sheets.openStageForm();
}

function useExample(name) {
  haptic('light');
  sheets.openStageForm(null, name);
}
</script>
