<template>
  <section class="batch-page">
    <header class="batch-page-head">
      <div class="batch-page-title">
        <h1>一次记多笔</h1>
        <p>把好几笔写在一起</p>
      </div>
    </header>

    <section class="batch-compose">
      <div class="batch-step-head">
        <span class="batch-step">01</span>
        <div class="batch-step-copy">
          <h2>把花的钱写进一段话</h2>
          <small>果冻会自己认出金额、分类和日期</small>
        </div>
      </div>

      <textarea
        v-model="text"
        class="batch-textarea"
        rows="5"
        placeholder="比如：午饭 35，打车 25，昨天门票 120"
        aria-label="收支文字"
      ></textarea>

      <div class="batch-compose-foot">
        <span class="batch-hint">用逗号或换行隔开都可以</span>
      </div>

      <p v-if="error" class="batch-error">{{ error }}</p>

      <div class="batch-actions">
        <button v-if="text.trim()" class="batch-clear" type="button" @click="text = ''">
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
    </section>

    <section v-if="count" class="batch-result">
      <div class="batch-step-head">
        <span class="batch-step">02</span>
        <div class="batch-step-copy">
          <h2>看看果冻认对没</h2>
          <small>金额、分类、日期都能直接改</small>
        </div>
        <span class="batch-count-pill">{{ count }} 笔</span>
      </div>

      <div class="parsed-list batch-parsed-list">
        <div v-for="(entry, index) in entries" :key="entry.id" class="parsed-card">
          <div class="parsed-head">
            <span class="parsed-head-left">
              <span class="parsed-index">{{ index + 1 }}</span>
              <span class="parsed-raw">{{ entry.raw || entry.note || '果冻听到的' }}</span>
            </span>
            <button class="remove-chip" type="button" @click="removeDraft(entry.id)">删掉这条</button>
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
                <option v-for="item in categoryOptions(entry)" :key="item" :value="item">
                  {{ item }}
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

      <div class="batch-summary">
        <div class="batch-summary-copy">
          <span>一共</span>
          <strong>¥{{ formatMoney(total) }}</strong>
        </div>
        <button class="batch-submit" type="button" :disabled="saving" @click="saveAll">
          {{ saving ? '果冻在记…' : '都记上' }}
        </button>
      </div>

      <button class="batch-reparse" type="button" @click="parseText">再让果冻看看</button>
    </section>

    <div v-else class="batch-empty">
      <span class="batch-empty-icon" aria-hidden="true">
        <i></i><i></i><i></i>
      </span>
      <p>果冻认出的结果会出现在这里</p>
      <small>写完上面的话，点「让果冻看看」</small>
    </div>

    <p class="batch-footnote">这些结果只暂时待着，确认没问题再都记上。</p>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { showToast } from 'vant';
import { useRouter } from 'vue-router';
import DateTimeField from '../components/DateTimeField.vue';
import { parseExpenses } from '../lib/parser';
import { useBatchEntries } from '../composables/useBatchEntries';
import { useLedger } from '../composables/useLedger';
import { isValidAmount, toAmountNumber } from '../utils/amountInput';
import { applyDateToIso, formatMoney, toDateInput } from '../utils/format';
import { haptic } from '../utils/haptics';

const router = useRouter();
const { ready, currentStage, categories, addExpenses } = useLedger();
const { entries, count, total, replaceEntries, removeEntry, clearEntries } = useBatchEntries();

const text = ref('');
const error = ref('');
const saving = ref(false);

const canParse = computed(() => Boolean(text.value.trim()));

watch(
  [ready, currentStage],
  ([isReady, stage]) => {
    if (isReady && !stage) router.replace('/');
  },
  { immediate: true }
);

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
  replaceEntries(parsed);
  haptic('light');
}

function removeDraft(id) {
  removeEntry(id);
  haptic('light');
}

function categoryOptions(entry) {
  return categories.value.includes(entry.category)
    ? categories.value
    : [entry.category, ...categories.value];
}

function updateEntryDate(entry, value) {
  entry.spentAt = applyDateToIso(entry.spentAt, value);
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
