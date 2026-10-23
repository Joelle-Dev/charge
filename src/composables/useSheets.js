import { ref } from 'vue';

const showStages = ref(false);
const showStageForm = ref(false);
const showVoice = ref(false);
const showExpenseForm = ref(false);
const showSettings = ref(false);
const editingStage = ref(null);
const editingExpense = ref(null);

function openStages() {
  showStages.value = true;
}

function openStageForm(stage = null) {
  editingStage.value = stage || null;
  showStages.value = false;
  showStageForm.value = true;
}

function openVoice() {
  if (showStageForm.value) showStageForm.value = false;
  showVoice.value = true;
}

function openExpenseForm(expense = null) {
  editingExpense.value = expense || null;
  showExpenseForm.value = true;
}

function openSettings() {
  showSettings.value = true;
}

export function useSheets() {
  return {
    showStages,
    showStageForm,
    showVoice,
    showExpenseForm,
    showSettings,
    editingStage,
    editingExpense,
    openStages,
    openStageForm,
    openVoice,
    openExpenseForm,
    openSettings
  };
}
