import { ref } from 'vue';
import router from '../router';

const voiceAutostart = ref(false);
const voiceStopTick = ref(0);

function openVoice(autoStart = false) {
  voiceAutostart.value = autoStart;
  if (router.currentRoute.value.path !== '/voice') router.push('/voice');
}

function requestVoiceStop() {
  voiceStopTick.value += 1;
}

export function useVoiceEntry() {
  return {
    voiceAutostart,
    voiceStopTick,
    openVoice,
    requestVoiceStop
  };
}
