<template>
  <section class="voice-page">
    <header class="voice-page-head">
      <button class="records-back" type="button" aria-label="返回" @click="leave">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6"></path>
        </svg>
      </button>
      <div class="voice-page-title">
        <span class="voice-page-eyebrow">{{ isTest ? '测试 · 语音记账' : '果冻听你说' }}</span>
        <h1>{{ isTest ? '说一笔 · 测试' : '说给果冻听' }}</h1>
      </div>
      <span v-if="currentStage" class="voice-stage-pill">
        <span class="voice-stage-dot" aria-hidden="true"></span>
        {{ currentStage.name }}
      </span>
    </header>

    <div class="voice-page-body">
      <p class="voice-page-intro">果冻先听你说，确认后再入账。</p>

      <p v-if="isTest" class="voice-test-banner">
        测试页：语音识别仍有问题，手机自测通过前不要上线。
      </p>

      <section class="voice-hero">
        <div class="voice-hero-glow" aria-hidden="true"></div>
        <div class="voice-stage">
      <button
        v-if="supported"
        class="voice-orb"
        :class="{ recording }"
        type="button"
        :aria-label="recording ? '停止语音识别' : '开始语音识别'"
        @click="toggleRecording"
      >
        <svg v-if="!recording" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <rect x="9" y="2.5" width="6" height="11" rx="3"></rect>
          <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"></path>
          <path d="M12 18v3"></path>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="7" y="7" width="10" height="10" rx="2"></rect>
        </svg>
      </button>
      <div class="voice-paws" :class="{ live: recording }" aria-hidden="true">
        <PawIcon v-for="paw in 5" :key="paw" :style="{ '--paw-index': paw }" />
      </div>
      <div class="voice-status">{{ statusText }}</div>
      <div class="voice-hint">{{ hintText }}</div>
        </div>
      </section>

      <section class="voice-transcript-card">
        <div class="voice-card-head">
          <span class="voice-card-title">果冻听到的话</span>
          <span class="voice-card-hint">听错了可以自己改</span>
        </div>
        <div class="field transcript">
          <textarea
            v-model="text"
            class="textarea"
            rows="3"
            placeholder="比如：午饭 35，打车 25，昨天门票 120"
          ></textarea>
          <span v-if="recording" class="transcript-live"><i></i>果冻在听…</span>
        </div>
      </section>

    <div class="voice-actions">
      <button class="secondary-btn" type="button" @click="parseText">看看记成什么样</button>
      <button v-if="supported" class="secondary-btn" type="button" @click="toggleRecording">
        {{ recording ? '说完啦' : '说给果冻听' }}
      </button>
    </div>

    <p v-if="error" class="voice-error">{{ error }}</p>
    <p v-else-if="!secure" class="voice-error">这里需要 HTTPS 或 localhost 才能听你说话。先直接打字也可以。</p>

      <section v-if="parsedEntries.length" class="voice-results">
        <div class="voice-results-head">
          <h2>果冻记成这样</h2>
          <span>{{ parsedEntries.length }} 笔</span>
        </div>
        <div class="parsed-list">
      <div v-for="(entry, index) in parsedEntries" :key="entry.key" class="parsed-card">
        <div class="parsed-head">
          <span class="parsed-head-left">
            <span class="parsed-index"><PawIcon />{{ index + 1 }}</span>
            <span class="parsed-raw">{{ entry.raw || entry.note || '果冻听到的' }}</span>
          </span>
          <button class="remove-chip" type="button" @click="removeEntry(index)">删掉这条</button>
        </div>
        <div class="parsed-grid">
          <div class="field full">
            <span class="field-label">金额</span>
            <div class="amount-input">
              <span class="currency">¥</span>
              <input v-model.number="entry.amount" type="number" inputmode="decimal" min="0" step="0.01">
            </div>
          </div>
          <label class="field">
            <span class="field-label">分类</span>
            <select v-model="entry.category" class="select">
              <option v-for="category in categoryOptions(entry)" :key="category" :value="category">
                {{ category }}
              </option>
            </select>
          </label>
          <div class="field">
            <span class="field-label">日期</span>
            <DateTimeField
              :model-value="toDateInput(entry.spentAt)"
              type="date"
              @update:model-value="updateEntryDate(entry, $event)"
            />
          </div>
          <label class="field full">
            <span class="field-label">备注</span>
            <input v-model="entry.note" class="input" type="text" maxlength="40" :placeholder="entry.category">
          </label>
        </div>
      </div>
    </div>

        <div class="parsed-actions">
          <button class="primary-btn" type="button" :disabled="saving" @click="saveParsed">
            {{ saving ? '果冻在记…' : `都记上 · ¥${formatMoney(parsedTotal)}` }}
          </button>
          <button class="secondary-btn" type="button" @click="parseText">再听一遍</button>
        </div>
      </section>

      <p class="sheet-note">果冻的耳朵由浏览器和系统服务提供。如果每次都问麦克风权限，可以在浏览器网站设置里改成「允许」。不方便说话时，直接打字也可以。</p>

      <section v-if="isTest" class="voice-debug">
        <button class="voice-debug-toggle" type="button" @click="showDebug = !showDebug">
          <span>调试信息</span>
          <span>{{ showDebug ? '收起' : '展开' }}</span>
        </button>
        <div v-if="showDebug" class="voice-debug-body">
          <dl class="voice-debug-grid">
            <template v-for="row in debugRows" :key="row.label">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </template>
          </dl>
          <div class="voice-debug-log">
            <div class="voice-debug-log-head">
              <span>事件日志</span>
              <button type="button" @click="debugLog.length = 0">清空</button>
            </div>
            <p v-if="!debugLog.length" class="voice-debug-empty">暂无事件</p>
            <ul v-else>
              <li v-for="(line, index) in debugLog" :key="`${index}-${line}`">{{ line }}</li>
            </ul>
          </div>
        </div>
      </section>
    </div>

    <div v-if="showStamp" class="paw-stamp" aria-hidden="true">
      <PawIcon />
      <span>果冻记好了</span>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { showToast } from 'vant';
import { useRoute, useRouter } from 'vue-router';
import DateTimeField from '../components/DateTimeField.vue';
import PawIcon from '../components/PawIcon.vue';
import { parseExpenses } from '../lib/parser';
import { useLedger } from '../composables/useLedger';
import { useVoiceEntry } from '../composables/useVoiceEntry';
import { applyDateToIso, formatMoney, toDateInput, uid } from '../utils/format';
import { haptic } from '../utils/haptics';

const router = useRouter();
const route = useRoute();
const isTest = computed(() => route.meta.voiceTest === true);
const voice = useVoiceEntry();
const { ready, currentStage, categories, addExpenses } = useLedger();

const RecognitionCtor = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;
const supported = Boolean(RecognitionCtor);
const secure = typeof window !== 'undefined' && (
  window.isSecureContext ||
  window.location.protocol === 'https:' ||
  ['localhost', '127.0.0.1'].includes(window.location.hostname)
);

const recording = ref(false);
const preparing = ref(false);
const text = ref('');
const error = ref('');
const parsedEntries = ref([]);
const saving = ref(false);
const showStamp = ref(false);
const showDebug = ref(isTest.value);
const debugLog = ref([]);
const debugTick = ref(0);

let micReady = false;

let recognition = null;
let finalText = '';
let interimText = '';
let closing = false;
let userStopped = true;
let restartTimer = null;
let maxTimer = null;
let lastFinalAt = 0;
let restartAttempts = 0;
let networkFailures = 0;
let pendingStop = false;

const restarting = ref(false);
const MAX_LISTEN_MS = 120000;
const MAX_RESTARTS = 30;
const MAX_NETWORK_RETRIES = 5;

const statusText = computed(() => {
  if (!supported) return '这个浏览器还不会听果冻说话';
  if (preparing.value) return '果冻在找麦克风…';
  if (restarting.value) return '果冻还在听…';
  if (recording.value) return '果冻在听…说完再点一下';
  if (text.value.trim()) return '果冻听好啦，可以改改再解析';
  return '点一下，说给果冻听';
});

const hintText = supported
  ? '可以连着说好几笔，说完再点一下'
  : '也可以直接打字，解析后记上';

const parsedTotal = computed(() =>
  parsedEntries.value.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)
);

const debugRows = computed(() => {
  debugTick.value;
  return [
    { label: '语音识别', value: supported ? '支持' : '不支持' },
    { label: '安全环境', value: secure ? '是' : '否（需 HTTPS 或 localhost）' },
    { label: '麦克风', value: preparing.value ? '准备中' : micReady ? '已授权' : '未确认' },
    { label: '识别状态', value: restarting.value ? '重连中' : recording.value ? '聆听中' : '未开始' },
    { label: '当前阶段', value: currentStage.value?.name || '无' },
    { label: '识别原文', value: text.value ? `${text.value.length} 字` : '空' },
    { label: '已定稿', value: finalText ? `${finalText.length} 字` : '空' },
    { label: '临时结果', value: interimText ? `${interimText.length} 字` : '空' },
    { label: '重连次数', value: String(restartAttempts) },
    { label: '解析条数', value: `${parsedEntries.value.length} 笔` },
    { label: '解析合计', value: `¥${formatMoney(parsedTotal.value)}` },
    { label: '最近错误', value: error.value || '无' }
  ];
});

function pushDebug(message) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  debugLog.value.unshift(`${time}  ${message}`);
  if (debugLog.value.length > 30) debugLog.value.length = 30;
  debugTick.value += 1;
}

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
  pushDebug(`自动重连 #${restartAttempts}`);
  const delay = Math.min(500, 90 + restartAttempts * 40);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (!userStopped && !closing) startSession();
  }, delay);
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
  saving.value = false;
  showStamp.value = false;
  pendingStop = false;
  text.value = '';
  error.value = '';
  parsedEntries.value = [];
  debugLog.value = [];
  debugTick.value += 1;
}

function cleanup() {
  closing = true;
  userStopped = true;
  pendingStop = false;
  clearTimers();
  detachRecognition();
  recording.value = false;
  preparing.value = false;
  restarting.value = false;
}

function appendFinal(piece) {
  const value = String(piece || '').trim();
  if (!value) return;

  pushDebug(`识别到「${value}」`);
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

function stopWithError(message) {
  flushInterim();
  userStopped = true;
  clearTimers();
  detachRecognition();
  recording.value = false;
  restarting.value = false;
  error.value = message;
  showToast(message);
  if (text.value.trim()) parseText();
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
  pushDebug(`识别错误：${event.error}`);
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
  pushDebug('识别结束');
  flushInterim();

  if (userStopped) {
    clearTimers();
    recording.value = false;
    restarting.value = false;
    if (text.value.trim()) parseText();
    return;
  }

  scheduleRestart();
}

function startSession() {
  if (userStopped || closing) return;

  if (!recognition) {
    pushDebug('创建识别会话');
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
      pushDebug('识别已启动');
      error.value = '';
      restarting.value = false;
      recording.value = true;
      if (pendingStop) {
        pendingStop = false;
        stopRecording();
      }
    };

    recognition.onresult = handleResult;
    recognition.onerror = handleError;
    recognition.onend = handleEnd;
  } else {
    pushDebug('复用识别会话');
  }

  try {
    recognition.start();
  } catch (err) {
    pushDebug('启动识别失败，准备重连');
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

  pushDebug('准备麦克风');
  preparing.value = true;
  const ready = await ensureMicReady();
  preparing.value = false;
  if (!ready || closing) return;

  pushDebug('开始识别');
  error.value = '';
  finalText = '';
  interimText = '';
  lastFinalAt = 0;
  restartAttempts = 0;
  networkFailures = 0;
  text.value = '';
  parsedEntries.value = [];
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
  pushDebug('停止识别');
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
          if (text.value.trim()) parseText();
        }
      }, 800);
      return;
    } catch (err) {
      recognition = null;
    }
  }

  recording.value = false;
  flushInterim();
  if (text.value.trim()) parseText();
}

function toggleRecording() {
  if (recording.value) stopRecording();
  else startRecording();
}

function parseText() {
  const value = text.value.trim();
  if (!value) {
    showToast('先说一句或打点字嘛');
    return;
  }

  const entries = parseExpenses(value, { categories: categories.value });
  pushDebug(`解析结果：${entries.length} 笔`);
  if (!entries.length) {
    error.value = '果冻没听出金额。试着说「午饭 35」或「打车 25 块」。';
    parsedEntries.value = [];
    return;
  }

  error.value = '';
  parsedEntries.value = entries.map((entry) => ({
    ...entry,
    key: uid('parsed'),
    amount: Number(entry.amount)
  }));
}

function categoryOptions(entry) {
  return categories.value.includes(entry.category)
    ? categories.value
    : [entry.category, ...categories.value];
}

function updateEntryDate(entry, value) {
  entry.spentAt = applyDateToIso(entry.spentAt, value);
}

function removeEntry(index) {
  parsedEntries.value.splice(index, 1);
}

async function saveParsed() {
  if (!parsedEntries.value.length) return;
  if (parsedEntries.value.some((entry) => !Number.isFinite(Number(entry.amount)) || Number(entry.amount) <= 0)) {
    showToast('有一笔金额不太对，帮果冻看看嘛');
    return;
  }

  if (saving.value) return;
  saving.value = true;
  try {
    const count = parsedEntries.value.length;
    pushDebug(`提交入账：${count} 笔`);
    await addExpenses(parsedEntries.value);
    showStamp.value = true;
    haptic('success');
    await new Promise((resolve) => setTimeout(resolve, 420));
    showToast(`果冻记下 ${count} 笔啦`);
    leave();
  } catch (err) {
    console.error(err);
    showToast('没记上，再试一次吧');
  } finally {
    saving.value = false;
  }
}

function leave() {
  cleanup();
  if (window.history.length > 1) router.back();
  else router.replace('/');
}

onMounted(() => {
  reset();
  if (voice.voiceAutostart.value) {
    voice.voiceAutostart.value = false;
    if (supported) nextTick(startRecording);
  }
});

watch(
  [ready, currentStage],
  ([isReady, stage]) => {
    if (isReady && !stage) router.replace('/');
  },
  { immediate: true }
);

watch(
  () => voice.voiceStopTick.value,
  () => {
    pendingStop = true;
    if (recording.value) {
      pendingStop = false;
      stopRecording();
    }
  }
);

onUnmounted(cleanup);
</script>
