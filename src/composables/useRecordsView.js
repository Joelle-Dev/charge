import { ref } from 'vue';

const viewMode = ref('calendar');
const selectedMonth = ref('');
const selectedDate = ref('');
const selectedCategory = ref('all');
const stageId = ref(null);

export function useRecordsView() {
  return {
    viewMode,
    selectedMonth,
    selectedDate,
    selectedCategory,
    stageId
  };
}
