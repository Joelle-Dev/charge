<template>
  <SheetFrame v-model:show="show" title="果冻的成就" max-height="92dvh">
    <div class="achievement-hero">
      <div class="achievement-cat"><CatMood :mood="'happy'" /></div>
      <div class="achievement-hero-copy">
        <span class="achievement-eyebrow">果冻现在的称号</span>
        <strong>{{ currentCatTitle }}</strong>
        <span>连续 {{ stats.streak }} 天 · 一共记了 {{ stats.totalCount }} 笔<template v-if="stats.yearsActive >= 1"> · 记账 {{ stats.yearsActive }} 年</template></span>
      </div>
      <span class="achievement-count">{{ unlockedCount }}/{{ achievements.length }}</span>
    </div>

    <section class="achievement-section">
      <h3 class="achievement-group-title">果冻的成就</h3>
      <div class="achievement-grid">
        <div
          v-for="achievement in regularAchievements"
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
    </section>

    <section class="achievement-section">
      <h3 class="achievement-group-title">人生里程碑</h3>
      <div class="achievement-grid">
        <div
          v-for="achievement in milestones"
          :key="achievement.id"
          class="achievement-badge milestone"
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
    </section>

    <p class="sheet-note">成就和爪印都住在你手机里；删掉支出后，已经拿到的爪印也不会消失。</p>
  </SheetFrame>
</template>

<script setup>
import { computed, watch } from 'vue';
import SheetFrame from './SheetFrame.vue';
import CatMood from './CatMood.vue';
import AchievementIcon from './AchievementIcon.vue';
import { useAchievements } from '../composables/useAchievements';
import { useLedger } from '../composables/useLedger';

const show = defineModel('show', { type: Boolean, default: false });
const { stats, achievements, unlockedCount, initAchievements } = useAchievements();
const { currentCatTitle } = useLedger();

const regularAchievements = computed(() => (
  achievements.value.filter((item) => item.group !== 'milestone')
));
const milestones = computed(() => (
  achievements.value.filter((item) => item.group === 'milestone')
));

watch(show, (visible) => {
  if (visible) initAchievements().catch((err) => console.error(err));
}, { immediate: true });
</script>
