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
      title: '发现新版本',
      message: '刷新后即可使用最新版本',
      confirmButtonText: '立即刷新',
      cancelButtonText: '稍后',
      showCancelButton: true
    })
      .then(() => updateSW(true))
      .catch(() => {});
  },
  onOfflineReady() {
    showToast('已可离线使用');
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
