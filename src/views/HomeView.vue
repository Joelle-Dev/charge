<template>
  <div class="loading-state" v-if="!ready">
    <span class="loading-dot"></span>
    正在读取本地账本…
  </div>
  <EmptyState v-else-if="!currentStage" />
  <div v-else class="dashboard">
    <HeroSummary />
    <CategoryChart />
    <ExpenseList />
  </div>
</template>

<script setup>
import { useLedger } from '../composables/useLedger';
import EmptyState from '../components/EmptyState.vue';
import HeroSummary from '../components/HeroSummary.vue';
import CategoryChart from '../components/CategoryChart.vue';
import ExpenseList from '../components/ExpenseList.vue';

const { ready, currentStage } = useLedger();
</script>
