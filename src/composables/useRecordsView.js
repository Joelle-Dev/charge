import { ref } from 'vue';

const viewMode = ref('list');
const recordMonth = ref('');
const dailyOpen = ref(false);
const selectedMonth = ref('');
const selectedDate = ref('');
const stageId = ref(null);

export function useRecordsView() {
  return {
    viewMode,
    recordMonth,
    dailyOpen,
    selectedMonth,
    selectedDate,
    stageId
  };
}
