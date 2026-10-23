import { computed, ref } from 'vue';

const deferredPrompt = ref(null);
const installed = ref(false);
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
    installed.value = true;
    deferredPrompt.value = null;
  });
}

export function usePwaInstall() {
  const canInstall = computed(() => Boolean(deferredPrompt.value));

  async function promptInstall() {
    if (!deferredPrompt.value) return false;
    deferredPrompt.value.prompt();
    const choice = await deferredPrompt.value.userChoice;
    deferredPrompt.value = null;
    return choice?.outcome === 'accepted';
  }

  return {
    canInstall,
    installed,
    standalone,
    isIos,
    promptInstall
  };
}
