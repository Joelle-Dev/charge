import { ref } from 'vue';
import router from '../router';
import { clampPull } from '../utils/pullGesture';
import { goToPane } from './useLedgerPanes';

const editingExpense = ref(null);
const expenseDraft = ref(null);
const curtainOpen = ref(false);
const curtainPull = ref(0);
const curtainDragging = ref(false);
const recordSession = ref(0);
const returnTo = ref('');

function openRecord(expense = null, draft = null, options = {}) {
  const current = router.currentRoute.value;
  returnTo.value = current.path === '/' ? '' : current.fullPath;

  editingExpense.value = expense || null;
  expenseDraft.value = draft || null;
  recordSession.value += 1;
  curtainDragging.value = false;
  curtainOpen.value = options.openCurtain !== false;
  curtainPull.value = curtainOpen.value ? 1 : 0;

  if (current.path !== '/') router.push('/');
  goToPane('record');
}

function openCurtain() {
  goToPane('record');
  curtainDragging.value = false;
  curtainPull.value = 1;
  curtainOpen.value = true;
}

function closeCurtain() {
  curtainDragging.value = false;
  curtainPull.value = 0;
  curtainOpen.value = false;
}

function beginCurtainPull() {
  curtainDragging.value = true;
}

function updateCurtainPull(progress) {
  curtainPull.value = clampPull(progress);
}

function endCurtainPull(open) {
  curtainDragging.value = false;
  curtainOpen.value = Boolean(open);
  curtainPull.value = open ? 1 : 0;
}

function toggleCurtain() {
  if (curtainOpen.value) closeCurtain();
  else openCurtain();
}

function resetRecord() {
  editingExpense.value = null;
  expenseDraft.value = null;
  returnTo.value = '';
  closeCurtain();
}

export function useRecordEntry() {
  return {
    editingExpense,
    expenseDraft,
    curtainOpen,
    curtainPull,
    curtainDragging,
    recordSession,
    returnTo,
    openRecord,
    openCurtain,
    closeCurtain,
    beginCurtainPull,
    updateCurtainPull,
    endCurtainPull,
    toggleCurtain,
    resetRecord
  };
}
