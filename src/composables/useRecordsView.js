import { ref } from 'vue';

const recordMonth = ref('');
const dailyOpen = ref(false);
const dailyDate = ref('');
const selectedMonth = ref('');
const selectedDate = ref('');
const stageId = ref(null);
const recentExpense = ref(null);

function markRecentExpense(expense) {
  if (!expense?.id) return;
  recentExpense.value = {
    id: expense.id,
    spentAt: expense.spentAt || '',
    at: Date.now()
  };
}

function clearRecentExpense() {
  recentExpense.value = null;
}

export function useRecordsView() {
  return {
    recordMonth,
    dailyOpen,
    dailyDate,
    selectedMonth,
    selectedDate,
    stageId,
    recentExpense,
    markRecentExpense,
    clearRecentExpense
  };
}
