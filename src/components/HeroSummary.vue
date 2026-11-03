<template>
  <section class="hero">
    <div class="hero-glow" aria-hidden="true"></div>

    <div class="hero-top">
      <span class="eyebrow">{{ mergeMode ? '合并账本' : '账本总额' }}</span>
      <div class="hero-side">
        <span class="hero-count">{{ overviewStats.count }} 笔</span>
        <span class="hero-mood"><CatMood :mood="mood" /></span>
      </div>
    </div>

    <div class="hero-stage-row">
      <div class="hero-stage">{{ overviewStageLabel }}</div>
      <span v-if="mergeMode" class="hero-merge-badge">
        {{ mergedStages.length }} 个账本
      </span>
    </div>

    <div class="hero-amount">
      <span class="currency">¥</span><span>{{ formatMoney(spent) }}</span>
    </div>

    <p class="hero-caption">{{ moodLine }}</p>

    <div v-if="!mergeMode && overviewBudget > 0" class="budget-block">
      <div class="budget-line">
        <span class="budget-label">
          <span class="bowl-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 11h16"></path>
              <path d="M6.5 11c0 4.6 2 7 5.5 7s5.5-2.4 5.5-7"></path>
              <path d="M9 8c.4-1.8 1.4-2.8 3-3.2"></path>
            </svg>
          </span>
          猫粮罐 ¥<b>{{ formatMoney(overviewBudget) }}</b>
        </span>
        <span :class="{ over: remaining < 0 }">
          {{ remaining >= 0 ? `还剩 ¥${formatMoney(remaining)}` : `花超啦 ¥${formatMoney(Math.abs(remaining))}` }}
        </span>
      </div>
      <div class="progress">
        <div class="progress-fill" :class="{ over: spent > overviewBudget }" :style="{ width: `${progress}%` }"></div>
      </div>
    </div>

    <p v-else-if="mergeMode && mergedStages.length" class="hero-merge-note">
      合并后预算沿用目标账本
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import CatMood from './CatMood.vue';
import { useLedger } from '../composables/useLedger';
import { formatMoney } from '../utils/format';

const {
  currentStage,
  mergeMode,
  mergedStages,
  overviewStats,
  overviewStageLabel,
  overviewBudget
} = useLedger();

const spent = computed(() => overviewStats.value.total);
const ratio = computed(() => (overviewBudget.value ? spent.value / overviewBudget.value : 0));
const remaining = computed(() => overviewBudget.value - spent.value);
const progress = computed(() => Math.min(100, Math.max(0, ratio.value * 100)));

const mood = computed(() => {
  if (!overviewStats.value.count) return 'watch';
  if (mergeMode.value || !overviewBudget.value) return 'happy';
  if (ratio.value > 1) return 'sad';
  if (ratio.value >= 0.8) return 'worried';
  if (ratio.value >= 0.5) return 'watch';
  return 'happy';
});

const moodLine = computed(() => {
  if (mergeMode.value) {
    const n = mergedStages.value.length;
    return n === 0 ? '选两个账本，合并成一个'
      : n < 2 ? '再选一个账本就能合并'
      : '确认后会并入你选的目标账本';
  }
  if (!currentStage.value || !overviewStats.value.count) return '果冻还没花钱，真乖';
  if (!overviewBudget.value) return '果冻今天也把钱看得紧紧的';
  if (ratio.value > 1) return '猫粮罐见底啦，果冻有点慌';
  if (ratio.value >= 0.8) return '快碰到猫粮罐底啦，省着点花哦';
  if (ratio.value >= 0.5) return '果冻在盯着猫粮罐，慢慢花';
  return '果冻今天也没乱花钱，真棒';
});
</script>
