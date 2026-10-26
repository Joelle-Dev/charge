import { ref } from 'vue';

const deferredPrompt = ref(null);
const standalone = ref(false);
const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

if (typeof window !== 'undefined') {
  standalone.value = Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone
  );

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt.value = event;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt.value = null;
  });
}

export function usePwaInstall() {
  async function promptInstall() {
    if (!deferredPrompt.value) return false;
    deferredPrompt.value.prompt();
    const choice = await deferredPrompt.value.userChoice;
    deferredPrompt.value = null;
    return choice?.outcome === 'accepted';
  }

  return {
    standalone,
    isIos,
    promptInstall
  };
}
