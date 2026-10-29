<template>
  <div class="loading-state" v-if="!ready">
    <span class="loading-dot"></span>
    {{ loadingHint }}
  </div>
  <Transition v-else name="stage-fade" mode="out-in">
    <EmptyState v-if="!currentStage" key="empty" />
    <div v-else :key="currentStage.id" class="dashboard">
      <HeroSummary />
    </div>
  </Transition>
</template>

<script setup>
import { useLedger } from '../composables/useLedger';
import EmptyState from '../components/EmptyState.vue';
import HeroSummary from '../components/HeroSummary.vue';

const { ready, loadingHint, currentStage } = useLedger();
</script>
