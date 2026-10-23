<template>
  <section class="hero">
    <div class="hero-glow" aria-hidden="true"></div>
    <PawIcon class="hero-paw hero-paw-a" />
    <PawIcon class="hero-paw hero-paw-b" />
    <PawIcon class="hero-paw hero-paw-c" />
    <div class="hero-top">
      <span class="eyebrow">当前阶段</span>
      <span class="hero-count">{{ currentExpenses.length }} 笔</span>
    </div>
    <div class="hero-stage">{{ currentStage.name }}</div>
    <div class="hero-amount">
      <span class="currency">¥</span><span>{{ formatMoney(total) }}</span>
    </div>
    <div class="hero-sub">{{ currentExpenses.length ? '这个阶段的总支出' : '还没有支出，说一句试试' }}</div>

    <div v-if="budget > 0" class="budget-block">
      <div class="budget-line">
        <span>预算 ¥<b>{{ formatMoney(budget) }}</b></span>
        <span :class="{ over: remaining < 0 }">
          {{ remaining >= 0 ? `剩余 ¥${formatMoney(remaining)}` : `超支 ¥${formatMoney(Math.abs(remaining))}` }}
        </span>
      </div>
      <div class="progress">
        <div class="progress-fill" :class="{ over: total > budget }" :style="{ width: `${progress}%` }"></div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import PawIcon from './PawIcon.vue';
import { useLedger } from '../composables/useLedger';
import { formatMoney } from '../utils/format';

const { currentStage, currentExpenses, total } = useLedger();

const budget = computed(() => Number(currentStage.value?.budget) || 0);
const remaining = computed(() => budget.value - total.value);
const progress = computed(() => {
  if (!budget.value) return 0;
  return Math.min(100, Math.max(0, (total.value / budget.value) * 100));
});
</script>
