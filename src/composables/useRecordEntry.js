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
let closeGuard = null;
let closePending = false;

function openRecord(expense = null, draft = null, options = {}) {
  const current = router.currentRoute.value;
  returnTo.value = current.path === '/' ? '' : current.fullPath;

  editingExpense.value = expense || null;
  expenseDraft.value = draft || null;
  recordSession.value += 1;
  curtainDragging.value = false;
  curtainOpen.value = options.openCurtain !== false;
  curtainPull.value = curtainOpen.value ? 1 : 0;

  if (current.path !== '/') {
    router.push('/');
    goToPane('record');
  }
}

function startFreshSession() {
  editingExpense.value = null;
  expenseDraft.value = null;
  returnTo.value = '';
  recordSession.value += 1;
}

function openCurtain() {
  goToPane('record');
  if (!curtainOpen.value) startFreshSession();
  curtainDragging.value = false;
  curtainPull.value = 1;
  curtainOpen.value = true;
}

async function confirmClose() {
  if (!closeGuard || closePending) return !closePending;
  closePending = true;
  try {
    return await closeGuard();
  } finally {
    closePending = false;
  }
}

async function closeCurtain(force = false) {
  if (!force && curtainOpen.value && closeGuard) {
    const allowed = await confirmClose();
    if (!allowed) return;
  }
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

async function endCurtainPull(open) {
  const wasOpen = curtainOpen.value;
  if (!open && wasOpen && closeGuard) {
    const allowed = await confirmClose();
    if (!allowed) {
      curtainDragging.value = false;
      curtainOpen.value = true;
      curtainPull.value = 1;
      return;
    }
  }
  curtainDragging.value = false;
  curtainOpen.value = Boolean(open);
  curtainPull.value = open ? 1 : 0;
  if (open && !wasOpen) startFreshSession();
}

function toggleCurtain() {
  if (curtainOpen.value) closeCurtain();
  else openCurtain();
}

function resetRecord() {
  editingExpense.value = null;
  expenseDraft.value = null;
  returnTo.value = '';
  closeCurtain(true);
}

export function setCloseGuard(guard) {
  closeGuard = typeof guard === 'function' ? guard : null;
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
    resetRecord,
    setCloseGuard
  };
}
