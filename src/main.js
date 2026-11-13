import { createApp } from 'vue';
import { showConfirmDialog, showToast } from 'vant';
import { registerSW } from 'virtual:pwa-register';
import App from './App.vue';
import router from './router';
import 'vant/es/dialog/style';
import 'vant/es/image-preview/style';
import 'vant/es/toast/style';
import './styles/global.css';
import { isIgnorableError } from './lib/errors';
import { initTheme } from './utils/theme';

initTheme();

const ERROR_TOAST = '果冻绊了一下，再试一次吧';
const ERROR_TOAST_GAP = 3000;
let lastErrorToastAt = 0;

function reportError(error, context) {
  if (isIgnorableError(error)) return;
  console.error(`[守财小果] ${context}`, error);
  const now = Date.now();
  if (now - lastErrorToastAt < ERROR_TOAST_GAP) return;
  lastErrorToastAt = now;
  showToast(ERROR_TOAST);
}

window.addEventListener('unhandledrejection', (event) => {
  if (isIgnorableError(event.reason)) return;
  event.preventDefault();
  reportError(event.reason, 'unhandledrejection');
});

window.addEventListener('error', (event) => {
  // Resource load errors have no `error`; only surface runtime errors.
  if (!event.error) return;
  reportError(event.error, 'window.error');
});

const buildDate = new Date(__APP_BUILD_TIME__);
const buildLabel = Number.isNaN(buildDate.getTime())
  ? ''
  : buildDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
let refreshPrompting = false;

const updateSW = registerSW({
  onNeedRefresh() {
    if (refreshPrompting) return;
    refreshPrompting = true;
    showConfirmDialog({
      title: '果冻换新衣服啦',
      message: buildLabel
        ? `更新一下就能用新版本啦（${buildLabel}）`
        : '更新一下就能用新版本啦',
      confirmButtonText: '立即更新',
      showCancelButton: false,
      closeOnClickOverlay: false
    })
      .then(() => updateSW(true))
      .catch(() => {})
      .finally(() => {
        refreshPrompting = false;
      });
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    const checkForUpdate = () => {
      if (document.visibilityState === 'visible') registration.update();
    };
    document.addEventListener('visibilitychange', checkForUpdate);
    window.setInterval(checkForUpdate, 60 * 60 * 1000);
  },
  onOfflineReady() {
    showToast('果冻已经可以离线记账啦');
  }
});

const splash = document.getElementById('splash');
let splashHidden = false;

function hideSplash() {
  if (splashHidden) return;
  splashHidden = true;
  if (!splash || !splash.isConnected) return;
  splash.classList.add('is-hidden');
  window.setTimeout(() => splash.remove(), 200);
}

const app = createApp(App);
app.config.errorHandler = (error, instance, info) => {
  reportError(error, `vue:${info}`);
};
app.use(router);
app.mount('#app');

// Hide the splash once the first screen is actually in the DOM, so it never
// flashes an empty page. Keep a short minimum so it doesn't blink.
const splashFloor = 120;
function readyToHide(startedAt) {
  return performance.now() - startedAt >= splashFloor;
}
const splashStartedAt = performance.now();
(function waitForFirstScreen(attempts = 40) {
  if (splashHidden) return;
  const hasScreen = document.querySelector('.ledger-home, .empty-state');
  if (hasScreen && readyToHide(splashStartedAt)) {
    requestAnimationFrame(hideSplash);
    return;
  }
  if (attempts <= 0) {
    hideSplash();
    return;
  }
  window.setTimeout(() => waitForFirstScreen(attempts - 1), 40);
})();

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
