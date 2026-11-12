import { ref } from 'vue';
import router from '../router';
import { goToPane } from './useLedgerPanes';

const voiceAutostart = ref(false);

function openVoice(autoStart = false) {
  voiceAutostart.value = autoStart;
  goToPane('batch');
  if (router.currentRoute.value.path !== '/') router.push('/');
}

export function useVoiceEntry() {
  return {
    voiceAutostart,
    openVoice
  };
}
