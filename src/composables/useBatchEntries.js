import { computed, ref } from 'vue';
import { uid } from '../utils/format';

const entries = ref([]);

const count = computed(() => entries.value.length);
const total = computed(() => (
  entries.value.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)
));

function replaceEntries(list) {
  entries.value = list.map((entry) => ({
    id: uid('batch'),
    amount: Number(entry.amount) || 0,
    category: entry.category || '',
    note: String(entry.note || '').trim(),
    raw: String(entry.raw || ''),
    spentAt: entry.spentAt
  }));
}

function removeEntry(id) {
  entries.value = entries.value.filter((entry) => entry.id !== id);
}

function clearEntries() {
  entries.value = [];
}

export function useBatchEntries() {
  return {
    entries,
    count,
    total,
    replaceEntries,
    removeEntry,
    clearEntries
  };
}
