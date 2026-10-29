import { ref } from 'vue';

const showStages = ref(false);
const showStageForm = ref(false);
const showSearch = ref(false);
const showAchievements = ref(false);
const showSummary = ref(false);
const editingStage = ref(null);
const stageDraftName = ref('');
const summaryStage = ref(null);

function openStages() {
  showStages.value = true;
}

function openStageForm(stage = null, presetName = '') {
  editingStage.value = stage || null;
  stageDraftName.value = stage ? '' : presetName;
  showStages.value = false;
  showStageForm.value = true;
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
    showSearch,
    showAchievements,
    showSummary,
    editingStage,
    stageDraftName,
    summaryStage,
    openStages,
    openStageForm,
    openSearch,
    openAchievements,
    openSummary
  };
}
