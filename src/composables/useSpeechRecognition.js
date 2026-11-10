import { computed, ref } from 'vue';
import { showToast } from 'vant';
import { haptic } from '../utils/haptics';

const MAX_LISTEN_MS = 120000;
const MAX_RESTARTS = 30;
const MAX_NETWORK_RETRIES = 5;

export function useSpeechRecognition({ onFinish } = {}) {
  const RecognitionCtor = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  const supported = Boolean(RecognitionCtor);
  const secure = typeof window !== 'undefined' && (
    window.isSecureContext ||
    window.location.protocol === 'https:' ||
    ['localhost', '127.0.0.1'].includes(window.location.hostname)
  );

  const text = ref('');
  const recording = ref(false);
  const preparing = ref(false);
  const restarting = ref(false);
  const error = ref('');

  let micReady = false;
  let recognition = null;
  let finalText = '';
  let interimText = '';
  let closing = false;
  let userStopped = true;
  let finished = false;
  let restartTimer = null;
  let maxTimer = null;
  let lastFinalAt = 0;
  let restartAttempts = 0;
  let networkFailures = 0;

  const statusText = computed(() => {
    if (!supported) return '直接写也可以';
    if (preparing.value) return '果冻在找麦克风…';
    if (restarting.value) return '果冻还在听…';
    if (recording.value) return '果冻在听…说完再点一下';
    if (text.value.trim()) return '可以点「让果冻看看」';
    return '点一下，说给果冻听';
  });

  const hintText = supported
    ? '可以连着说好几笔，说完再点一下'
    : '也可以直接打字，解析后记上';

  function clearTimers() {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
    if (maxTimer) {
      clearTimeout(maxTimer);
      maxTimer = null;
    }
  }

  function detachRecognition() {
    const current = recognition;
    recognition = null;
    if (!current) return;
    current.onstart = null;
    current.onresult = null;
    current.onerror = null;
    current.onend = null;
    try { current.abort(); } catch (err) { /* noop */ }
  }

  function scheduleRestart() {
    if (userStopped || closing || restartTimer) return;

    if (restartAttempts >= MAX_RESTARTS) {
      stopWithError('果冻听断啦，再点一下麦克风，或者直接打字。');
      return;
    }

    restartAttempts += 1;
    restarting.value = true;
    const delay = Math.min(500, 90 + restartAttempts * 40);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (!userStopped && !closing) startSession();
    }, delay);
  }

  function appendFinal(piece) {
    const value = String(piece || '').trim();
    if (!value) return;

    const now = performance.now();
    const previous = finalText.trimEnd();
    const needsSeparator = previous &&
      !/[，,。.；;、！!？?]$/.test(previous) &&
      now - lastFinalAt > 650;
    finalText = needsSeparator ? `${previous}，${value}` : `${previous}${value}`;
    lastFinalAt = now;
    interimText = '';
    text.value = finalText;
  }

  function flushInterim() {
    if (!interimText.trim()) return;
    const pending = interimText;
    interimText = '';
    appendFinal(pending);
  }

  function finish() {
    if (finished) return;
    finished = true;
    if (text.value.trim()) onFinish?.(text.value);
  }

  function stopWithError(message) {
    flushInterim();
    userStopped = true;
    clearTimers();
    detachRecognition();
    recording.value = false;
    restarting.value = false;
    error.value = message;
    showToast(message);
    finish();
  }

  function handleResult(event) {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result.isFinal) appendFinal(result[0].transcript);
    }

    for (let i = 0; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (!result.isFinal) interim += result[0].transcript;
    }

    interimText = interim;
    text.value = interim ? `${finalText}${interim}` : finalText;
    restartAttempts = 0;
    networkFailures = 0;
  }

  function handleError(event) {
    if (event.error === 'no-speech' || event.error === 'aborted') return;

    if (event.error === 'network' && networkFailures < MAX_NETWORK_RETRIES) {
      networkFailures += 1;
      error.value = '网有点抖，果冻在重新连…';
      detachRecognition();
      scheduleRestart();
      return;
    }

    const messages = {
      'not-allowed': '麦克风权限被拒绝啦。请在浏览器设置里允许麦克风，或者直接打字。',
      'service-not-allowed': '语音服务不可用，先直接打字吧。',
      'audio-capture': '没找到可用的麦克风。',
      network: '语音服务连不上，看看网络，或者直接打字。'
    };

    stopWithError(messages[event.error] || '果冻没听清，直接打字也可以。');
  }

  function handleEnd() {
    if (closing) return;
    flushInterim();

    if (userStopped) {
      clearTimers();
      recording.value = false;
      restarting.value = false;
      finish();
      return;
    }

    scheduleRestart();
  }

  function startSession() {
    if (userStopped || closing) return;

    if (!recognition) {
      try {
        recognition = new RecognitionCtor();
      } catch (err) {
        stopWithError('麦克风没打开，改用文字也可以。');
        return;
      }

      recognition.lang = 'zh-CN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        if (closing) return;
        error.value = '';
        restarting.value = false;
        recording.value = true;
      };

      recognition.onresult = handleResult;
      recognition.onerror = handleError;
      recognition.onend = handleEnd;
    }

    try {
      recognition.start();
    } catch (err) {
      detachRecognition();
      scheduleRestart();
    }
  }

  async function ensureMicReady() {
    if (micReady) return true;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      micReady = true;
      return true;
    }

    try {
      if (navigator.permissions?.query) {
        try {
          const status = await navigator.permissions.query({ name: 'microphone' });
          if (status.state === 'granted') {
            micReady = true;
            return true;
          }
        } catch (err) {
          // Some browsers do not support querying microphone permission.
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      micReady = true;
      return true;
    } catch (err) {
      error.value = '麦克风权限被拒绝啦。请在浏览器设置里允许麦克风，或者直接打字。';
      return false;
    }
  }

  async function startRecording() {
    if (!RecognitionCtor || recording.value || preparing.value) return;

    preparing.value = true;
    const ready = await ensureMicReady();
    preparing.value = false;
    if (!ready || closing) return;

    error.value = '';
    finalText = text.value.trim();
    interimText = '';
    lastFinalAt = 0;
    restartAttempts = 0;
    networkFailures = 0;
    finished = false;
    closing = false;
    userStopped = false;
    clearTimers();
    recording.value = true;
    haptic('light');
    startSession();

    if (!userStopped && !closing) {
      maxTimer = setTimeout(() => {
        maxTimer = null;
        if (!userStopped && !closing) {
          showToast('语音输入已达到 2 分钟，已停止');
          stopRecording();
        }
      }, MAX_LISTEN_MS);
    }
  }

  function stopRecording() {
    userStopped = true;
    restarting.value = false;
    clearTimers();
    haptic('light');

    if (recognition) {
      try {
        recognition.stop();
        setTimeout(() => {
          if (!closing && userStopped && recording.value) {
            recognition = null;
            recording.value = false;
            flushInterim();
            finish();
          }
        }, 800);
        return;
      } catch (err) {
        recognition = null;
      }
    }

    recording.value = false;
    flushInterim();
    finish();
  }

  function toggleRecording() {
    if (recording.value) stopRecording();
    else startRecording();
  }

  function reset() {
    closing = false;
    userStopped = true;
    clearTimers();
    finalText = '';
    interimText = '';
    lastFinalAt = 0;
    restartAttempts = 0;
    networkFailures = 0;
    recording.value = false;
    preparing.value = false;
    restarting.value = false;
    finished = false;
    text.value = '';
    error.value = '';
  }

  function cleanup() {
    closing = true;
    userStopped = true;
    clearTimers();
    detachRecognition();
    recording.value = false;
    preparing.value = false;
    restarting.value = false;
  }

  return {
    supported,
    secure,
    text,
    recording,
    preparing,
    restarting,
    error,
    statusText,
    hintText,
    startRecording,
    stopRecording,
    toggleRecording,
    reset,
    cleanup
  };
}
