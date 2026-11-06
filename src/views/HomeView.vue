<template>
  <div class="loading-state" v-if="!ready">
    <span class="loading-paw" aria-hidden="true"><PawIcon /></span>
    {{ loadingHint }}
  </div>
  <Transition v-else name="stage-fade" mode="out-in">
    <EmptyState v-if="!currentStage" key="empty" />
    <div v-else :key="currentStage.id" class="dashboard ledger-home" :class="{ 'is-entering': entering }">
      <header class="ledger-home-head">
        <div class="ledger-home-side">
        </div>
        <div class="ledger-home-title">
          <h1>{{ mergeMode ? '合并账本' : '我的账本' }}</h1>
        </div>
        <div class="ledger-home-actions">
          <button
            v-if="mergeMode"
            class="ledger-mode-btn is-active"
            type="button"
            @click="exitMergeMode"
          >
            退出合并
          </button>
          <button
            v-else-if="canMerge"
            class="ledger-mode-btn"
            type="button"
            @click="enterMergeMode"
          >
            合并账本
          </button>
        </div>
      </header>

      <HeroSummary />
      <StageLedgerList />
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useLedger } from '../composables/useLedger';
import EmptyState from '../components/EmptyState.vue';
import HeroSummary from '../components/HeroSummary.vue';
import StageLedgerList from '../components/StageLedgerList.vue';
import PawIcon from '../components/PawIcon.vue';

const {
  ready,
  loadingHint,
  currentStage,
  mergeMode,
  canMerge,
  enterMergeMode,
  exitMergeMode
} = useLedger();

const entering = ref(false);
let enteredOnce = false;
let enterTimer = 0;

watch(ready, (isReady) => {
  if (!isReady || enteredOnce) return;
  enteredOnce = true;
  entering.value = true;
  enterTimer = window.setTimeout(() => { entering.value = false; }, 1400);
}, { immediate: true });
</script>
