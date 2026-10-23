<template>
  <section class="empty-state">
    <div class="empty-art" aria-hidden="true">
      <span class="empty-ring"></span>
      <span class="empty-paw empty-paw-a"><PawIcon /></span>
      <span class="empty-paw empty-paw-b"><PawIcon /></span>
      <span class="empty-paw empty-paw-c"><PawIcon /></span>
      <span class="empty-cat"><CatIcon /></span>
    </div>
    <h1>先建一个阶段</h1>
    <p>旅行、装修、某月日常……<br>把钱都记进同一个阶段里。</p>
    <button class="primary-btn" type="button" @click="sheets.openStageForm()">新建阶段</button>
  </section>
</template>

<script setup>
import CatIcon from './CatIcon.vue';
import PawIcon from './PawIcon.vue';
import { useSheets } from '../composables/useSheets';

const sheets = useSheets();
</script>
