import { createApp } from 'vue';
import { showConfirmDialog, showToast } from 'vant';
import { registerSW } from 'virtual:pwa-register';
import App from './App.vue';
import router from './router';
import 'vant/es/dialog/style';
import 'vant/es/toast/style';
import './styles/global.css';

const updateSW = registerSW({
  onNeedRefresh() {
    showConfirmDialog({
    title: '果冻换新衣服啦',
    message: '刷新一下就能用新版本啦',
    confirmButtonText: '马上刷新',
      showCancelButton: false
    })
      .then(() => updateSW(true))
      .catch(() => {});
  },
  onOfflineReady() {
    showToast('果冻已经可以离线记账啦');
  }
});

const app = createApp(App);
app.use(router);
app.mount('#app');

const splash = document.getElementById('splash');
if (splash) {
  const elapsed = performance.now();
  const delay = Math.max(0, 500 - elapsed);
  window.setTimeout(() => {
    splash.classList.add('is-hidden');
    window.setTimeout(() => splash.remove(), 400);
  }, delay);
}
// App-like touch behaviour: block iOS pinch-to-zoom while keeping normal scrolling.
['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
  document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
});

document.addEventListener(
  'touchmove',
  (event) => {
    if (event.touches.length > 1 && event.cancelable) event.preventDefault();
  },
  { passive: false }
);
