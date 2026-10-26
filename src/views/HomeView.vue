<template>
  <div class="loading-state" v-if="!ready">
    <span class="loading-dot"></span>
    正在读取本地账本…
  </div>
  <Transition v-else name="stage-fade" mode="out-in">
    <EmptyState v-if="!currentStage" key="empty" />
    <div v-else :key="currentStage.id" class="dashboard">
      <HeroSummary />
      <QuickAddChips />
      <CategoryChart />
      <RecentExpenses />
    </div>
  </Transition>
</template>

<script setup>
import { useLedger } from '../composables/useLedger';
import EmptyState from '../components/EmptyState.vue';
import HeroSummary from '../components/HeroSummary.vue';
import QuickAddChips from '../components/QuickAddChips.vue';
import CategoryChart from '../components/CategoryChart.vue';
import RecentExpenses from '../components/RecentExpenses.vue';

const { ready, currentStage } = useLedger();
</script>
