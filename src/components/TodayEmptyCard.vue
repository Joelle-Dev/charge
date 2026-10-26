<template>
  <div class="today-empty">
    <div class="today-empty-cat"><CatMood mood="sleep" /></div>
    <div class="today-empty-copy">
      <strong>今天果冻还没花钱</strong>
      <span>有支出的话，记一笔就好</span>
    </div>
    <button class="today-empty-btn" type="button" @click="addToday">补一笔</button>
  </div>
</template>

<script setup>
import CatMood from './CatMood.vue';
import { useSheets } from '../composables/useSheets';
import { haptic } from '../utils/haptics';

const sheets = useSheets();

function addToday() {
  haptic('light');
  sheets.openExpenseForm();
}
</script>
