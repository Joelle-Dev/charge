import { ref } from 'vue';
import router from '../router';

const voiceAutostart = ref(false);

function openVoice(autoStart = false) {
  voiceAutostart.value = autoStart;
  if (router.currentRoute.value.path !== '/voice') router.push('/voice');
}

export function useVoiceEntry() {
  return {
    voiceAutostart,
    openVoice
  };
}
