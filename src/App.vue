<template>
  <div class="app-shell">
    <AppHeader />
    <main class="main">
      <RouterView />
    </main>
    <ActionBar />

    <StageSheet v-model:show="showStages" />
    <StageFormSheet v-model:show="showStageForm" />
    <VoiceSheet v-model:show="showVoice" />
    <ExpenseFormSheet v-model:show="showExpenseForm" />
    <SettingsSheet v-model:show="showSettings" />
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
import SettingsSheet from './components/SettingsSheet.vue';
import { useLedger } from './composables/useLedger';
import { useSheets } from './composables/useSheets';

const { init } = useLedger();
const {
  showStages,
  showStageForm,
  showVoice,
  showExpenseForm,
  showSettings
} = useSheets();

onMounted(() => {
  init();
});
</script>
