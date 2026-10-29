<template>
  <section class="hero">
    <div class="hero-glow" aria-hidden="true"></div>

    <div class="hero-top">
      <span class="eyebrow">当前阶段</span>
      <div class="hero-side">
        <span class="hero-count">{{ currentStageStats.count }} 笔</span>
        <span class="hero-mood"><CatMood :mood="mood" /></span>
      </div>
    </div>

    <div class="hero-stage-row">
      <div class="hero-stage">{{ currentStage.name }}</div>
    </div>

    <div class="hero-amount">
      <span class="currency">¥</span><span>{{ formatMoney(total) }}</span>
    </div>

    <div v-if="budget > 0" class="budget-block">
      <div class="budget-line">
        <span class="budget-label">
          <span class="bowl-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 11h16"></path>
              <path d="M6.5 11c0 4.6 2 7 5.5 7s5.5-2.4 5.5-7"></path>
              <path d="M9 8c.4-1.8 1.4-2.8 3-3.2"></path>
            </svg>
          </span>
          猫粮罐 ¥<b>{{ formatMoney(budget) }}</b>
        </span>
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
import CatMood from './CatMood.vue';
import { useLedger } from '../composables/useLedger';
import { formatMoney } from '../utils/format';

const { currentStage, currentStageStats, total } = useLedger();

const budget = computed(() => Number(currentStage.value?.budget) || 0);
const remaining = computed(() => budget.value - total.value);
const progress = computed(() => {
  if (!budget.value) return 0;
  return Math.min(100, Math.max(0, (total.value / budget.value) * 100));
});

const mood = computed(() => {
  if (!currentStageStats.value.count) return 'watch';
  if (!budget.value) return 'happy';

  const ratio = total.value / budget.value;
  if (ratio > 1) return 'sad';
  if (ratio >= 0.8) return 'worried';
  if (ratio >= 0.5) return 'watch';
  return 'happy';
});
</script>
