import { ref } from 'vue';

const viewMode = ref('list');
const selectedMonth = ref('');
const selectedDate = ref('');
const stageId = ref(null);

export function useRecordsView() {
  return {
    viewMode,
    selectedMonth,
    selectedDate,
    stageId
  };
}
