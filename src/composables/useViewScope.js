import { ref } from 'vue';

const stageScope = ref('current');
const detailFrom = ref('');
const detailTo = ref('');
const detailCategory = ref('');

export function useViewScope() {
  return {
    stageScope,
    detailFrom,
    detailTo,
    detailCategory,
    setDetailContext(from = '', to = '', category = '') {
      detailFrom.value = from || '';
      detailTo.value = to || '';
      detailCategory.value = category || '';
    }
  };
}
