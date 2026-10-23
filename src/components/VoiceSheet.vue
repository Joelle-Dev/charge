<template>
  <SheetFrame v-model:show="show" title="说一笔" max-height="92dvh">
    <p class="sheet-intro">记入「{{ currentStage?.name || '当前阶段' }}」。说完会先展示解析结果，确认后才入账。</p>

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
      <div class="voice-status">{{ statusText }}</div>
      <div class="voice-hint">{{ hintText }}</div>
    </div>

    <div class="field transcript">
      <span class="field-label">识别文字 <span>可以修改后再解析</span></span>
      <textarea
        v-model="text"
        class="textarea"
        rows="3"
        placeholder="例如：午饭吃了 35，打车 25，昨天门票 120"
      ></textarea>
      <span v-if="recording" class="transcript-live"><i></i>聆听中</span>
    </div>

    <div style="display: flex; gap: 8px; margin-top: -6px">
      <button class="secondary-btn" type="button" style="flex: 1" @click="parseText">解析文字</button>
      <button v-if="supported" class="secondary-btn" type="button" style="flex: 1" @click="toggleRecording">
        {{ recording ? '停止' : '语音输入' }}
      </button>
    </div>

    <p v-if="error" class="voice-error">{{ error }}</p>
    <p v-else-if="!secure" class="voice-error">语音识别需要 HTTPS 或 localhost 环境。可以直接输入文字。</p>

    <div v-if="parsedEntries.length" class="parsed-list">
      <div v-for="(entry, index) in parsedEntries" :key="entry.key" class="parsed-card">
        <div class="parsed-head">
          <span class="parsed-raw">{{ entry.raw || entry.note || '识别结果' }}</span>
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
          <label class="field">
            <span class="field-label">日期</span>
            <input
              class="input"
              type="date"
              :value="toDateInput(entry.spentAt)"
              @change="updateEntryDate(entry, $event)"
            >
          </label>
          <label class="field full">
            <span class="field-label">备注</span>
            <input v-model="entry.note" class="input" type="text" maxlength="40" :placeholder="entry.category">
          </label>
        </div>
      </div>
    </div>

    <div v-if="parsedEntries.length" class="parsed-actions">
      <button class="primary-btn" type="button" @click="saveParsed">全部入账 · ¥{{ formatMoney(parsedTotal) }}</button>
      <button class="secondary-btn" type="button" @click="parseText">重新解析</button>
    </div>

    <p class="sheet-note">语音识别由浏览器和系统服务提供。若不便说话，可直接输入文字。</p>
  </SheetFrame>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { showToast } from 'vant';
import SheetFrame from './SheetFrame.vue';
import { parseExpenses } from '../lib/parser';
import { useLedger } from '../composables/useLedger';
import { applyDateToIso, formatMoney, toDateInput, uid } from '../utils/format';

const show = defineModel('show', { type: Boolean, default: false });
const { currentStage, categories, addExpenses } = useLedger();

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

let recognition = null;
let finalText = '';
let interimText = '';
let closing = false;

const statusText = computed(() => {
  if (!supported) return '当前浏览器不支持语音识别';
  if (recording.value) return '正在聆听…说完再点一下';
  if (text.value.trim()) return '已停止，可以修改文字后解析';
  return '点一下，开始说话';
});

const hintText = supported
  ? '说完再点一下结束，也可以直接输入文字'
  : '可以直接输入或粘贴文字，解析后记入';

const parsedTotal = computed(() =>
  parsedEntries.value.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)
);

function reset() {
  closing = false;
  finalText = '';
  interimText = '';
  recording.value = false;
  text.value = '';
  error.value = '';
  parsedEntries.value = [];
}

function cleanup() {
  closing = true;
  if (recognition) {
    try { recognition.abort(); } catch (err) { /* noop */ }
  }
  recognition = null;
  recording.value = false;
}

function startRecording() {
  if (!RecognitionCtor || recording.value) return;
  error.value = '';
  finalText = '';
  interimText = '';
  text.value = '';
  parsedEntries.value = [];
  closing = false;

  try {
    recognition = new RecognitionCtor();
  } catch (err) {
    error.value = '无法启动语音识别，请改用文字输入。';
    return;
  }

  recognition.lang = 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    recording.value = true;
  };

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result.isFinal) {
        finalText += result[0].transcript;
      } else {
        interim += result[0].transcript;
      }
    }
    interimText = interim;
    text.value = `${finalText}${interim}`;
  };

  recognition.onerror = (event) => {
    const messages = {
      'not-allowed': '麦克风权限被拒绝。请在浏览器设置中允许麦克风，或直接输入文字。',
      'service-not-allowed': '语音服务不可用，请直接输入文字。',
      'no-speech': '没有听到声音，再试一次，或直接输入文字。',
      'audio-capture': '没有找到可用的麦克风。',
      network: '语音服务连接失败，请检查网络，或直接输入文字。',
      aborted: ''
    };
    const message = messages[event.error] ?? '语音识别失败，请直接输入文字。';
    if (message) error.value = message;
    recording.value = false;
  };

  recognition.onend = () => {
    recording.value = false;
    if (closing) return;
    if (!finalText && interimText) {
      finalText = interimText;
      text.value = finalText;
    }
    if (text.value.trim()) parseText();
  };

  try {
    recognition.start();
  } catch (err) {
    error.value = '无法启动语音识别，请直接输入文字。';
    recording.value = false;
  }
}

function stopRecording() {
  if (!recognition) return;
  try {
    recognition.stop();
  } catch (err) {
    recording.value = false;
  }
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

function updateEntryDate(entry, event) {
  entry.spentAt = applyDateToIso(entry.spentAt, event.target.value);
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

  try {
    const count = parsedEntries.value.length;
    await addExpenses(parsedEntries.value);
    showToast(`已记 ${count} 笔`);
    show.value = false;
  } catch (err) {
    console.error(err);
    showToast('入账失败，请重试');
  }
}

watch(show, (visible) => {
  if (visible) {
    reset();
  } else {
    cleanup();
  }
});

onUnmounted(cleanup);
</script>
