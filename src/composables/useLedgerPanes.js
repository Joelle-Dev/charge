import { ref } from 'vue';

export const LEDGER_PANES = ['home', 'record', 'records'];

const activePane = ref('record');
const paneRequest = ref(0);

export function goToPane(next) {
  activePane.value = LEDGER_PANES.includes(next) ? next : 'record';
  paneRequest.value += 1;
}

export function useLedgerPanes() {
  return {
    activePane,
    paneRequest,
    goToPane,
    LEDGER_PANES
  };
}
