<template>
  <SheetFrame v-model:show="show" title="果冻的成就" max-height="92dvh">
    <div class="achievement-hero">
      <div class="achievement-cat"><CatMood :mood="'happy'" /></div>
      <div class="achievement-hero-copy">
        <span class="achievement-eyebrow">果冻当前称号</span>
        <strong>{{ currentCatTitle }}</strong>
        <span>连续 {{ stats.streak }} 天 · 共记 {{ stats.totalCount }} 笔</span>
      </div>
      <span class="achievement-count">{{ unlockedCount }}/{{ achievements.length }}</span>
    </div>

    <div class="achievement-grid">
      <div
        v-for="achievement in achievements"
        :key="achievement.id"
        class="achievement-badge"
        :class="{ unlocked: achievement.unlocked }"
      >
        <span class="achievement-icon">
          <AchievementIcon :type="achievement.icon" />
        </span>
        <span class="achievement-copy">
          <strong>{{ achievement.name }}</strong>
          <small>{{ achievement.description }}</small>
          <span v-if="!achievement.unlocked" class="achievement-progress">
            {{ achievement.value }}/{{ achievement.target }}
          </span>
        </span>
      </div>
    </div>

    <p class="sheet-note">成就和解锁记录会保存在本机；删除支出后，已经拿到的爪印也不会消失。</p>
  </SheetFrame>
</template>

<script setup>
import SheetFrame from './SheetFrame.vue';
import CatMood from './CatMood.vue';
import AchievementIcon from './AchievementIcon.vue';
import { useAchievements } from '../composables/useAchievements';
import { useLedger } from '../composables/useLedger';

const show = defineModel('show', { type: Boolean, default: false });
const { stats, achievements, unlockedCount } = useAchievements();
const { currentCatTitle } = useLedger();
</script>
