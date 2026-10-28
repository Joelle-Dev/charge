import { ref } from 'vue';

const showStages = ref(false);
const showStageForm = ref(false);
const showVoice = ref(false);
const showExpenseForm = ref(false);
const showSearch = ref(false);
const showAchievements = ref(false);
const showSummary = ref(false);
const editingStage = ref(null);
const editingExpense = ref(null);
const expenseDraft = ref(null);
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

function openExpenseForm(expense = null, draft = null) {
  showSearch.value = false;
  editingExpense.value = expense || null;
  expenseDraft.value = draft || null;
  showExpenseForm.value = true;
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
    showExpenseForm,
    showSearch,
    showAchievements,
    showSummary,
    editingStage,
    editingExpense,
    expenseDraft,
    summaryStage,
    voiceAutostart,
    voiceStopTick,
    openStages,
    openStageForm,
    openVoice,
    requestVoiceStop,
    openExpenseForm,
    openSearch,
    openAchievements,
    openSummary
  };
}
