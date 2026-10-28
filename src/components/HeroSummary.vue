<template>
  <section class="hero">
    <div class="hero-glow" aria-hidden="true"></div>
    <PawIcon class="hero-paw hero-paw-a" />
    <PawIcon class="hero-paw hero-paw-b" />
    <PawIcon class="hero-paw hero-paw-c" />

    <div class="hero-top">
      <span class="eyebrow">当前阶段</span>
      <div class="hero-side">
        <span class="hero-count">{{ currentStageStats.count }} 笔</span>
        <span class="hero-mood"><CatMood :mood="mood" /></span>
      </div>
    </div>

    <div class="hero-stage-row">
      <div class="hero-stage">{{ currentStage.name }}</div>
      <span class="hero-title">{{ currentCatTitle }}</span>
    </div>

    <div class="hero-amount">
      <span class="currency">¥</span><span>{{ formatMoney(total) }}</span>
    </div>
    <div class="hero-sub">{{ currentStageStats.count ? '这个阶段的总支出' : '还没有支出，说一句试试' }}</div>

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

    <div class="cat-note">
      <PawIcon class="cat-note-paw" />
      <span>{{ moodText }}</span>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import CatMood from './CatMood.vue';
import PawIcon from './PawIcon.vue';
import { useLedger } from '../composables/useLedger';
import { formatMoney } from '../utils/format';

const { currentStage, currentStageStats, total, currentCatTitle } = useLedger();

const budget = computed(() => Number(currentStage.value?.budget) || 0);
const remaining = computed(() => budget.value - total.value);
const progress = computed(() => {
  if (!budget.value) return 0;
  return Math.min(100, Math.max(0, (total.value / budget.value) * 100));
});

const moodState = computed(() => {
  if (!currentStageStats.value.count) {
    return { mood: 'watch', text: '说一句，果冻帮你记下' };
  }
  if (!budget.value) {
    return { mood: 'happy', text: '果冻陪你一起记，慢慢来' };
  }

  const ratio = total.value / budget.value;
  if (ratio > 1) return { mood: 'sad', text: '果冻的猫粮罐空了…下笔要克制呀' };
  if (ratio >= 0.8) return { mood: 'worried', text: '快见底啦，果冻有点担心' };
  if (ratio >= 0.5) return { mood: 'watch', text: '果冻在看着猫粮罐' };
  return { mood: 'happy', text: '猫粮还很足，慢慢花' };
});

const mood = computed(() => moodState.value.mood);
const moodText = computed(() => moodState.value.text);
</script>
