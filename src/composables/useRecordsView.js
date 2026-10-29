import { ref } from 'vue';

const viewMode = ref('list');
const recordMode = ref('tree');
const recordMonth = ref('');
const selectedMonth = ref('');
const selectedDate = ref('');
const stageId = ref(null);

export function useRecordsView() {
  return {
    viewMode,
    recordMode,
    recordMonth,
    selectedMonth,
    selectedDate,
    stageId
  };
}
