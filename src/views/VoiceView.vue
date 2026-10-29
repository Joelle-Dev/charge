<template>
  <section class="voice-page">
    <header class="voice-page-head">
      <button class="records-back" type="button" aria-label="返回" @click="leave">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6"></path>
        </svg>
      </button>
      <div class="voice-page-title">
        <span class="voice-page-eyebrow">语音记账</span>
        <h1>说一笔</h1>
      </div>
      <span v-if="currentStage" class="voice-stage-pill">
        <span class="voice-stage-dot" aria-hidden="true"></span>
        {{ currentStage.name }}
      </span>
    </header>

    <div class="voice-page-body">
      <p class="voice-page-intro">果冻先听你说，确认后再入账。</p>

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
          <span class="voice-card-title">识别文字</span>
          <span class="voice-card-hint">可以修改后再解析</span>
        </div>
        <div class="field transcript">
          <textarea
            v-model="text"
            class="textarea"
            rows="3"
            placeholder="例如：午饭吃了 35，打车 25，昨天门票 120"
          ></textarea>
          <span v-if="recording" class="transcript-live"><i></i>聆听中</span>
        </div>
      </section>

    <div class="voice-actions">
      <button class="secondary-btn" type="button" @click="parseText">解析文字</button>
      <button v-if="supported" class="secondary-btn" type="button" @click="toggleRecording">
        {{ recording ? '停止' : '语音输入' }}
      </button>
    </div>

    <p v-if="error" class="voice-error">{{ error }}</p>
    <p v-else-if="!secure" class="voice-error">语音识别需要 HTTPS 或 localhost 环境。可以直接输入文字。</p>

      <section v-if="parsedEntries.length" class="voice-results">
        <div class="voice-results-head">
          <h2>解析结果</h2>
          <span>{{ parsedEntries.length }} 笔</span>
        </div>
        <div class="parsed-list">
      <div v-for="(entry, index) in parsedEntries" :key="entry.key" class="parsed-card">
        <div class="parsed-head">
          <span class="parsed-head-left">
            <span class="parsed-index"><PawIcon />{{ index + 1 }}</span>
            <span class="parsed-raw">{{ entry.raw || entry.note || '识别结果' }}</span>
          </span>
          <button class="remove-chip" type="button" @click="removeEntry(index)">移除</button>
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
            {{ saving ? '入账中…' : `全部入账 · ¥${formatMoney(parsedTotal)}` }}
          </button>
          <button class="secondary-btn" type="button" @click="parseText">重新解析</button>
        </div>
      </section>

      <p class="sheet-note">语音识别由浏览器和系统服务提供。若不便说话，可直接输入文字。</p>
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
import { useRouter } from 'vue-router';
import DateTimeField from '../components/DateTimeField.vue';
import PawIcon from '../components/PawIcon.vue';
import { parseExpenses } from '../lib/parser';
import { useLedger } from '../composables/useLedger';
import { useVoiceEntry } from '../composables/useVoiceEntry';
import { applyDateToIso, formatMoney, toDateInput, uid } from '../utils/format';
import { haptic } from '../utils/haptics';

const router = useRouter();
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
const text = ref('');
const error = ref('');
const parsedEntries = ref([]);
const saving = ref(false);
const showStamp = ref(false);

let recognition = null;
let finalText = '';
let interimText = '';
let closing = false;
let userStopped = true;
let restartTimer = null;
let maxTimer = null;
let lastFinalAt = 0;
let restartAttempts = 0;
let pendingStop = false;

const restarting = ref(false);
const MAX_LISTEN_MS = 120000;

const statusText = computed(() => {
  if (!supported) return '当前浏览器不支持语音识别';
  if (restarting.value) return '正在继续聆听…';
  if (recording.value) return '正在聆听…说完再点一下';
  if (text.value.trim()) return '已停止，可以修改文字后解析';
  return '点一下，开始说话';
});

const hintText = supported
  ? '可以连续说多笔，说完再点一下'
  : '可以直接输入文字，解析后记入';

const parsedTotal = computed(() =>
  parsedEntries.value.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)
);

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

function reset() {
  closing = false;
  userStopped = true;
  clearTimers();
  finalText = '';
  interimText = '';
  lastFinalAt = 0;
  restartAttempts = 0;
  recording.value = false;
  restarting.value = false;
  saving.value = false;
  showStamp.value = false;
  pendingStop = false;
  text.value = '';
  error.value = '';
  parsedEntries.value = [];
}

function cleanup() {
  closing = true;
  userStopped = true;
  pendingStop = false;
  clearTimers();
  if (recognition) {
    try { recognition.abort(); } catch (err) { /* noop */ }
  }
  recognition = null;
  recording.value = false;
  restarting.value = false;
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

function stopWithError(message) {
  userStopped = true;
  clearTimers();
  recording.value = false;
  restarting.value = false;
  error.value = message;
}

function handleResult(event) {
  let interim = '';
  for (let i = event.resultIndex; i < event.results.length; i += 1) {
    const result = event.results[i];
    if (result.isFinal) {
      appendFinal(result[0].transcript);
    } else {
      interim += result[0].transcript;
    }
  }
  interimText = interim;
  text.value = interim ? `${finalText}${interim}` : finalText;
  restartAttempts = 0;
}

function handleError(event) {
  if (event.error === 'no-speech' || event.error === 'aborted') return;

  const messages = {
    'not-allowed': '麦克风权限被拒绝。请在浏览器设置中允许麦克风，或直接输入文字。',
    'service-not-allowed': '语音服务不可用，请直接输入文字。',
    'audio-capture': '没有找到可用的麦克风。',
    network: '语音服务连接失败，请检查网络，或直接输入文字。'
  };

  stopWithError(messages[event.error] || '语音识别失败，请直接输入文字。');
}

function handleEnd() {
  if (closing) return;
  flushInterim();
  recognition = null;

  if (userStopped) {
    clearTimers();
    recording.value = false;
    restarting.value = false;
    if (text.value.trim()) parseText();
    return;
  }

  if (restartAttempts >= 20) {
    stopWithError('语音识别多次中断，请再点一下麦克风，或直接输入文字。');
    return;
  }

  restartAttempts += 1;
  restarting.value = true;
  const delay = Math.min(1200, 200 + restartAttempts * 180);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (!userStopped && !closing) startSession();
  }, delay);
}

function startSession() {
  if (userStopped || closing) return;

  try {
    recognition = new RecognitionCtor();
  } catch (err) {
    stopWithError('无法启动语音识别，请改用文字输入。');
    return;
  }

  recognition.lang = 'zh-CN';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    if (closing) return;
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

  try {
    recognition.start();
  } catch (err) {
    stopWithError('无法启动语音识别，请直接输入文字。');
  }
}

function startRecording() {
  if (!RecognitionCtor || recording.value) return;

  error.value = '';
  finalText = '';
  interimText = '';
  lastFinalAt = 0;
  restartAttempts = 0;
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
    showToast('先说一句或输入文字');
    return;
  }

  const entries = parseExpenses(value, { categories: categories.value });
  if (!entries.length) {
    error.value = '没听出金额。试着说「午饭 35」或「打车 25 块」。';
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
    showToast('有一笔金额不对，检查一下');
    return;
  }

  if (saving.value) return;
  saving.value = true;
  try {
    const count = parsedEntries.value.length;
    await addExpenses(parsedEntries.value);
    showStamp.value = true;
    haptic('success');
    await new Promise((resolve) => setTimeout(resolve, 420));
    showToast(`果冻记下 ${count} 笔`);
    leave();
  } catch (err) {
    console.error(err);
    showToast('入账失败，请重试');
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
