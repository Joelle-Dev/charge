<template>
  <div
    class="app-shell"
    :class="{ 'is-immersive': isImmersive, 'is-record-immersive': hideHeader }"
  >
    <AppHeader v-if="!isImmersive && !hideHeader" />
    <main class="main">
      <RouterView v-slot="{ Component }">
        <Transition :name="pageTransition" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
    <ActionBar v-if="!isImmersive" />
    <UndoSnackbar />

    <StageSheet v-model:show="showStages" />
    <StageFormSheet v-model:show="showStageForm" />
    <MergeStageSheet v-model:show="showMerge" />
    <AchievementsSheet v-model:show="showAchievements" />
    <StageSummarySheet v-model:show="showSummary" />
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppHeader from './components/AppHeader.vue';
import ActionBar from './components/ActionBar.vue';
import StageSheet from './components/StageSheet.vue';
import StageFormSheet from './components/StageFormSheet.vue';
import MergeStageSheet from './components/MergeStageSheet.vue';
import AchievementsSheet from './components/AchievementsSheet.vue';
import StageSummarySheet from './components/StageSummarySheet.vue';
import UndoSnackbar from './components/UndoSnackbar.vue';
import { useLedger } from './composables/useLedger';
import { useRecordEntry } from './composables/useRecordEntry';
import { useSheets } from './composables/useSheets';
import { useVoiceEntry } from './composables/useVoiceEntry';
import { useAchievements } from './composables/useAchievements';
import { useProfile } from './composables/useProfile';
import { requestPersistence } from './lib/storage';

const { init, currentStage } = useLedger();
const { initProfile } = useProfile();
const { initAchievements } = useAchievements();
const sheets = useSheets();
const record = useRecordEntry();
const voice = useVoiceEntry();
const route = useRoute();
const isImmersive = computed(() => Boolean(route.meta.immersive));
const hideHeader = computed(() => !isImmersive.value && route.path === '/');
const isAppShellFixed = computed(() => route.path === '/');
const pageTransition = computed(() => route.meta.transition || 'page-fade');
const {
  showStages,
  showStageForm,
  showMerge,
  showAchievements,
  showSummary
} = sheets;

function scheduleAchievements() {
  initAchievements().catch((err) => console.error(err));
}

watch(
  isAppShellFixed,
  (fixed) => {
    document.body.classList.toggle('is-app-fixed', fixed);
    document.documentElement.classList.toggle('is-app-fixed', fixed);
  },
  { immediate: true }
);

onMounted(async () => {
  const profileReady = initProfile().catch((err) => console.error(err));
  await init();
  await profileReady;
  requestPersistence().catch(() => {});
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
  if (action === 'voice') voice.openVoice(true);
  if (action === 'manual') record.openRecord();
});
</script>
