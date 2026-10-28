<template>
  <div class="app-shell">
    <AppHeader />
    <main class="main">
      <RouterView v-slot="{ Component }">
        <Transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
    <ActionBar />

    <StageSheet v-model:show="showStages" />
    <StageFormSheet v-model:show="showStageForm" />
    <VoiceSheet v-model:show="showVoice" />
    <ExpenseFormSheet v-model:show="showExpenseForm" />
    <SearchSheet v-model:show="showSearch" />
    <AchievementsSheet v-model:show="showAchievements" />
    <StageSummarySheet v-model:show="showSummary" />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import AppHeader from './components/AppHeader.vue';
import ActionBar from './components/ActionBar.vue';
import StageSheet from './components/StageSheet.vue';
import StageFormSheet from './components/StageFormSheet.vue';
import VoiceSheet from './components/VoiceSheet.vue';
import ExpenseFormSheet from './components/ExpenseFormSheet.vue';
import SearchSheet from './components/SearchSheet.vue';
import AchievementsSheet from './components/AchievementsSheet.vue';
import StageSummarySheet from './components/StageSummarySheet.vue';
import { useLedger } from './composables/useLedger';
import { useSheets } from './composables/useSheets';
import { useAchievements } from './composables/useAchievements';

const { init, currentStage } = useLedger();
const { initAchievements } = useAchievements();
const sheets = useSheets();
const {
  showStages,
  showStageForm,
  showVoice,
  showExpenseForm,
  showSearch,
  showAchievements,
  showSummary
} = sheets;

function scheduleAchievements() {
  initAchievements().catch((err) => console.error(err));
}

onMounted(async () => {
  await init();
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(scheduleAchievements, { timeout: 5000 });
  } else {
    window.setTimeout(scheduleAchievements, 5000);
  }

  const action = new URLSearchParams(window.location.search).get('action');
  if (!action) return;

  window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
  if (!currentStage.value) {
    sheets.openStageForm();
    return;
  }
  if (action === 'voice') sheets.openVoice();
  if (action === 'manual') sheets.openExpenseForm();
});
</script>
