<template>
  <section class="batch-page">
    <header class="batch-page-head">
      <div class="batch-page-title">
        <h1>一次记多笔</h1>
        <p>说一段，或写一段</p>
      </div>
      <span v-if="currentStage" class="batch-stage-pill">
        <span class="batch-stage-dot" aria-hidden="true"></span>
        {{ currentStage.name }}
      </span>
    </header>

    <section class="batch-panel">
      <div class="batch-voice" :class="{ 'is-recording': recording }">
        <button
          v-if="supported"
          class="voice-orb"
          :class="{ recording }"
          type="button"
          :aria-label="recording ? '停止语音识别' : '开始语音识别'"
          @click="toggleRecording"
        >
          <svg v-if="!recording" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M11.5 7.6 11.9 3.6 15.2 6.5"></path>
            <path d="M20.5 7.6 20.1 3.6 16.8 6.5"></path>
            <rect x="11.4" y="6.6" width="9.2" height="13.8" rx="4.6"></rect>
            <path d="M8.2 14.2a7.8 7.8 0 0 0 15.6 0"></path>
            <path d="M16 22v3.4"></path>
            <path d="M6.1 12.2c-1.1 2.4-1.1 5.2 0 7.6"></path>
            <path d="M25.9 12.2c1.1 2.4 1.1 5.2 0 7.6"></path>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="7" y="7" width="10" height="10" rx="2"></rect>
          </svg>
        </button>
        <div class="batch-voice-copy">
          <span class="batch-voice-status">{{ statusText }}</span>
          <span class="batch-voice-hint">{{ hintText }}</span>
          <span v-if="supported && !secure" class="batch-voice-warn">语音需要 HTTPS 或 localhost，直接打字也可以。</span>
        </div>
        <div v-if="supported" class="voice-paws" :class="{ live: recording }" aria-hidden="true">
          <PawIcon v-for="paw in 5" :key="paw" :style="{ '--paw-index': paw }" />
        </div>
      </div>

      <div class="batch-divider" aria-hidden="true"><span>或者直接写下来</span></div>

      <textarea
        v-model="text"
        class="batch-textarea"
        rows="5"
        placeholder="比如：午饭 35，打车 25，昨天门票 120"
        aria-label="收支文字"
      ></textarea>

      <p v-if="errorMessage" class="batch-error">{{ errorMessage }}</p>

      <div class="batch-actions">
        <span class="batch-hint">用逗号或换行隔开都可以</span>
        <button v-if="text.trim() && !recording" class="batch-clear" type="button" @click="text = ''">
          全清掉
        </button>
        <button class="batch-parse" type="button" :disabled="!canParse" @click="parseText">
          让果冻看看
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h14"></path>
            <path d="m13 6 6 6-6 6"></path>
          </svg>
        </button>
      </div>

      <section v-if="count" class="batch-results">
        <div class="batch-result-head">
          <span class="batch-result-title">认出 <b>{{ count }}</b> 笔</span>
          <button class="batch-reparse" type="button" @click="parseText">再让果冻看看</button>
        </div>

        <ParsedEntryList
          :entries="entries"
          :categories="categories"
          @remove="(entry) => removeDraft(entry.id)"
        />

        <div class="batch-summary">
          <div class="batch-summary-copy">
            <span>一共</span>
            <strong>¥{{ displayMoney(total, hideAmount) }}</strong>
          </div>
          <button class="batch-submit" type="button" :disabled="saving" @click="saveAll">
            {{ saving ? '果冻在记…' : '都记上' }}
          </button>
        </div>
      </section>

      <div v-else class="batch-empty">
        <PawIcon />
        <span>果冻认出的结果会出现在这里</span>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { showToast } from 'vant';
import { useRouter } from 'vue-router';
import ParsedEntryList from '../components/ParsedEntryList.vue';
import PawIcon from '../components/PawIcon.vue';
import { parseExpenses } from '../lib/parser';
import { useBatchEntries } from '../composables/useBatchEntries';
import { useLedger } from '../composables/useLedger';
import { useSpeechRecognition } from '../composables/useSpeechRecognition';
import { useVoiceEntry } from '../composables/useVoiceEntry';
import { isValidAmount, toAmountNumber } from '../utils/amountInput';
import { displayMoney } from '../utils/format';
import { usePrivacy } from '../composables/usePrivacy';
import { haptic } from '../utils/haptics';

const router = useRouter();
const { ready, currentStage, categories, addExpenses } = useLedger();
const { hideAmount } = usePrivacy();
const { entries, count, total, replaceEntries, removeEntry, clearEntries } = useBatchEntries();
const { voiceAutostart } = useVoiceEntry();

const {
  text,
  supported,
  secure,
  recording,
  error: voiceError,
  statusText,
  hintText,
  toggleRecording,
  cleanup: cleanupVoice
} = useSpeechRecognition({ onFinish: () => parseText() });

const error = ref('');
const saving = ref(false);

const errorMessage = computed(() => error.value || voiceError.value);
const canParse = computed(() => Boolean(text.value.trim()));

watch(
  [ready, currentStage],
  ([isReady, stage]) => {
    if (isReady && !stage) router.replace('/');
  },
  { immediate: true }
);

onMounted(() => {
  if (!voiceAutostart.value) return;
  voiceAutostart.value = false;
  if (supported) nextTick(() => toggleRecording());
});

onUnmounted(cleanupVoice);

function parseText() {
  const value = text.value.trim();
  if (!value) {
    showToast('先写点要记的话嘛');
    return;
  }

  const parsed = parseExpenses(value, { categories: categories.value });
  if (!parsed.length) {
    error.value = '果冻没认出金额。试着写「午饭 35」或「打车 25 块」。';
    clearEntries();
    return;
  }

  error.value = '';
  voiceError.value = '';
  replaceEntries(parsed);
  haptic('light');
}

function removeDraft(id) {
  removeEntry(id);
  haptic('light');
}


async function saveAll() {
  if (!count.value || saving.value) return;

  if (entries.value.some((entry) => !isValidAmount(entry.amount))) {
    showToast('有一笔金额不太对，帮果冻看看嘛');
    return;
  }

  saving.value = true;
  try {
    const amountCount = entries.value.length;
    await addExpenses(entries.value.map((entry) => ({
      amount: toAmountNumber(entry.amount),
      category: entry.category || categories.value[0] || '其他',
      note: entry.note,
      spentAt: entry.spentAt
    })));
    clearEntries();
    text.value = '';
    cleanupVoice();
    haptic('success');
    showToast(`果冻记下 ${amountCount} 笔啦`);
    leave();
  } catch (err) {
    console.error(err);
    showToast('没记上，再试一次吧');
  } finally {
    saving.value = false;
  }
}

function leave() {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}
</script>
