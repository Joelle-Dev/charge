import { ref } from 'vue';

const showStages = ref(false);
const showStageForm = ref(false);
const showVoice = ref(false);
const showSearch = ref(false);
const showAchievements = ref(false);
const showSummary = ref(false);
const editingStage = ref(null);
const summaryStage = ref(null);
const voiceAutostart = ref(false);
const voiceStopTick = ref(0);

function openStages() {
  showStages.value = true;
}

function openStageForm(stage = null) {
  editingStage.value = stage || null;
  showStages.value = false;
  showStageForm.value = true;
}

function openVoice(autoStart = false) {
  if (showStageForm.value) showStageForm.value = false;
  voiceAutostart.value = autoStart;
  showVoice.value = true;
}

function requestVoiceStop() {
  voiceStopTick.value += 1;
}

function openSearch() {
  showSearch.value = true;
}

function openAchievements() {
  showAchievements.value = true;
}

function openSummary(stage) {
  showStages.value = false;
  summaryStage.value = stage;
  showSummary.value = true;
}

export function useSheets() {
  return {
    showStages,
    showStageForm,
    showVoice,
    showSearch,
    showAchievements,
    showSummary,
    editingStage,
    summaryStage,
    voiceAutostart,
    voiceStopTick,
    openStages,
    openStageForm,
    openVoice,
    requestVoiceStop,
    openSearch,
    openAchievements,
    openSummary
  };
}
