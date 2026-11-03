import { ref } from 'vue';
import router from '../router';

const showStages = ref(false);
const showStageForm = ref(false);
const showAchievements = ref(false);
const showSummary = ref(false);
const showMerge = ref(false);
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
  if (router.currentRoute.value.path !== '/search') router.push('/search');
}

function openAchievements() {
  showAchievements.value = true;
}

function openMerge() {
  showStages.value = false;
  showMerge.value = true;
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
    showAchievements,
    showSummary,
    showMerge,
    editingStage,
    stageDraftName,
    summaryStage,
    openStages,
    openStageForm,
    openSearch,
    openAchievements,
    openMerge,
    openSummary
  };
}
