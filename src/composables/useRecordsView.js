import { ref } from 'vue';

const viewMode = ref('list');
const recordMode = ref('tree');
const selectedMonth = ref('');
const selectedDate = ref('');
const stageId = ref(null);

export function useRecordsView() {
  return {
    viewMode,
    recordMode,
    selectedMonth,
    selectedDate,
    stageId
  };
}
