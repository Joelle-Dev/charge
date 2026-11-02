import { ref } from 'vue';
import { getSetting, setSetting } from '../lib/db';

const RECORD_DONE_KEY = 'recordDoneBehavior';
const RECORD_DONE_DEFAULT = 'continue';

const recordDoneBehavior = ref(RECORD_DONE_DEFAULT);
let loadPromise = null;

function normalizeBehavior(value) {
  return value === 'close' ? 'close' : 'continue';
}

async function initPreferences() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const stored = await getSetting(RECORD_DONE_KEY, RECORD_DONE_DEFAULT);
    recordDoneBehavior.value = normalizeBehavior(stored);
    return recordDoneBehavior.value;
  })();
  return loadPromise;
}

async function setRecordDoneBehavior(value) {
  const next = normalizeBehavior(value);
  recordDoneBehavior.value = next;
  await setSetting(RECORD_DONE_KEY, next);
  return next;
}

export function usePreferences() {
  return {
    recordDoneBehavior,
    initPreferences,
    setRecordDoneBehavior
  };
}
