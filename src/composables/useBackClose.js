import { onUnmounted, watch } from 'vue';

export function useBackClose(isOpen, close) {
  let pushed = false;

  function onPopState() {
    if (!pushed) return;
    pushed = false;
    close();
  }

  watch(isOpen, (open) => {
    if (open && !pushed) {
      pushed = true;
      history.pushState({ overlay: true }, '');
    } else if (!open && pushed) {
      pushed = false;
      history.back();
    }
  });

  window.addEventListener('popstate', onPopState);
  onUnmounted(() => window.removeEventListener('popstate', onPopState));
}
