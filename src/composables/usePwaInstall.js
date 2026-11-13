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
    const prompt = deferredPrompt.value;
    if (!prompt) return false;
    // 先清空引用，防止双击对同一个事件重复调用 prompt()
    deferredPrompt.value = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      return choice?.outcome === 'accepted';
    } catch (err) {
      console.error('安装提示失败', err);
      return false;
    }
  }

  return {
    standalone,
    isIos,
    promptInstall
  };
}
