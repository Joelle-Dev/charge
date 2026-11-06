<template>
  <section class="search-page">
    <header class="search-page-head">
      <button class="search-close" type="button" aria-label="关闭搜索" @click="close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12"></path>
        </svg>
      </button>
      <h1 class="search-page-title">搜索</h1>
      <span class="search-page-spacer" aria-hidden="true"></span>
    </header>

    <div class="search-page-controls">
      <div class="search-mode-switch" role="group" aria-label="搜索方式">
        <button
          type="button"
          :class="{ active: searchMode === 'keyword' }"
          @click="setSearchMode('keyword')"
        >
          关键词
        </button>
        <button
          type="button"
          :class="{ active: searchMode === 'amount' }"
          @click="setSearchMode('amount')"
        >
          金额范围
        </button>
      </div>

      <div v-if="searchMode === 'keyword'" class="search-field">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5"></circle>
          <path d="m16 16 4 4"></path>
        </svg>
        <input
          ref="searchInput"
          v-model="query"
          type="search"
          inputmode="search"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="search"
          placeholder="搜搜备注或分类"
          aria-label="搜索明细"
          @keydown.enter.prevent="runSearchNow"
        >
        <button
          v-if="query"
          class="search-clear"
          type="button"
          aria-label="清空搜索"
          @mousedown.prevent
          @click="clearQuery"
        >
          ×
        </button>
      </div>

      <div v-else class="search-amount-row">
        <label class="search-amount-field">
          <span>¥</span>
          <input
            ref="minAmountInput"
            v-model="minAmount"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            placeholder="最低金额"
            aria-label="最低金额"
            @keydown.enter.prevent="runSearchNow"
          >
        </label>
        <span class="search-amount-dash" aria-hidden="true">—</span>
        <label class="search-amount-field">
          <span>¥</span>
          <input
            v-model="maxAmount"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            placeholder="最高金额"
            aria-label="最高金额"
            @keydown.enter.prevent="runSearchNow"
          >
        </label>
        <button
          v-if="hasAmountFilter"
          class="search-amount-clear"
          type="button"
          aria-label="清除金额范围"
          @click="clearAmountFilter"
        >
          ×
        </button>
      </div>

      <div v-if="filterCategories.length > 1" class="filter-row search-filters">
        <button
          class="filter-chip"
          :class="{ active: selectedCategory === 'all' }"
          type="button"
          @click="selectedCategory = 'all'"
        >
          全部
        </button>
        <button
          v-for="category in filterCategories"
          :key="category"
          class="filter-chip"
          :class="{ active: selectedCategory === category }"
          type="button"
          @click="selectedCategory = category"
        >
          <PawIcon class="filter-paw" :style="{ '--swatch': categoryColor(category) }" />
          {{ category }}
        </button>
      </div>

    </div>

    <div class="search-page-results">
      <div v-if="!currentStage" class="list-empty">
        <p>还没有可搜索的账本</p>
        <span>先建一个账本，再来翻账本</span>
      </div>

      <div v-else-if="loading" class="loading-state">
        <span class="loading-dot"></span>
        果冻在翻小账本…
      </div>

      <div v-else-if="!hasSearched" class="search-initial">
        <span class="search-initial-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5"></circle>
            <path d="m16 16 4 4"></path>
          </svg>
        </span>
        <p>{{ searchMode === 'keyword' ? '输入关键词开始搜索' : '输入金额范围开始搜索' }}</p>
        <span>{{ searchMode === 'keyword' ? '可以搜备注或分类' : '比如 20 到 100 之间的支出' }}</span>
        <button class="search-browse-btn" type="button" @click="browseRecent">
          看看最近的支出
        </button>
      </div>

      <template v-else>
        <p class="search-summary">{{ summaryText }}</p>

        <div v-if="searchError" class="list-empty">
          <p>搜索没成功</p>
          <span>果冻绊了一跤，再搜一次吧</span>
          <button class="text-btn" type="button" @click="runSearchNow">重新搜搜</button>
        </div>

        <div v-else-if="!totalMatches" class="list-empty">
          <p>果冻没翻到这笔</p>
          <span>换个词或金额范围再找找嘛</span>
        </div>

        <div v-else class="expense-list search-results">
          <div v-for="group in filteredGroups" :key="group.key" class="day-group expanded">
            <div class="day-head search-day-head">
              <span class="day-main">
                <span class="day-label">{{ group.label }}</span>
                <span class="day-count">{{ group.items.length }} 笔</span>
              </span>
              <span class="day-total">¥{{ displayMoney(group.total, hideAmount) }}</span>
            </div>
            <div class="day-items">
              <ExpenseRow
                v-for="expense in group.items"
                :key="expense.id"
                :expense="expense"
                @select="openDaily"
                @edit="editExpense"
                @delete="removeSearchExpense"
              />
            </div>
          </div>
        </div>

        <button
          v-if="results.length < totalMatches"
          class="secondary-btn search-more"
          type="button"
          @click="loadMore"
        >
          再翻几页
        </button>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import ExpenseRow from '../components/ExpenseRow.vue';
import PawIcon from '../components/PawIcon.vue';
import { useExpenseActions } from '../composables/useExpenseActions';
import { useLedger } from '../composables/useLedger';
import { useLedgerPanes } from '../composables/useLedgerPanes';
import { useRecordEntry } from '../composables/useRecordEntry';
import { useRecordsView } from '../composables/useRecordsView';
import { categoryColor, dayKey, displayMoney } from '../utils/format';
import { usePrivacy } from '../composables/usePrivacy';
import { groupExpensesByDay } from '../utils/expenses';
import { haptic } from '../utils/haptics';

const router = useRouter();
const record = useRecordEntry();
const { dailyOpen, dailyDate } = useRecordsView();
const { goToPane } = useLedgerPanes();
const {
  currentStage,
  currentStageStats,
  categoryGroups,
  loadRecentExpenses,
  loadExpensesByIds,
  searchExpenses
} = useLedger();
const { hideAmount } = usePrivacy();
const { removeExpense } = useExpenseActions();

const searchMode = ref('keyword');
const query = ref('');
const selectedCategory = ref('all');
const minAmount = ref('');
const maxAmount = ref('');
const searchInput = ref(null);
const minAmountInput = ref(null);
const results = ref([]);
const totalMatches = ref(0);
const loading = ref(false);
const hasSearched = ref(false);
const searchError = ref(false);
const browsingRecent = ref(false);
const resultLimit = ref(200);
let searchToken = 0;
let searchTimer = null;

const filterCategories = computed(() => categoryGroups.value.map((group) => group.category));
const hasAmountFilter = computed(() => Boolean(String(minAmount.value).trim() || String(maxAmount.value).trim()));
const hasActiveFilters = computed(() => (
  selectedCategory.value !== 'all' ||
  (searchMode.value === 'keyword' ? Boolean(query.value.trim()) : hasAmountFilter.value)
));
const filteredGroups = computed(() => groupExpensesByDay(results.value));
const summaryText = computed(() => {
  if (browsingRecent.value) return `最近 ${results.value.length} 笔`;
  if (results.value.length < totalMatches.value) {
    return `找到 ${totalMatches.value} 笔啦 · 已显示 ${results.value.length} 笔`;
  }
  return `找到 ${totalMatches.value} 笔啦`;
});

function amountBound(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function amountRange() {
  let min = amountBound(minAmount.value);
  let max = amountBound(maxAmount.value);
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  return { minAmount: min, maxAmount: max };
}

function cancelPendingSearch() {
  searchToken += 1;
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = null;
  }
}

function resetSearchState() {
  cancelPendingSearch();
  results.value = [];
  totalMatches.value = 0;
  loading.value = false;
  hasSearched.value = false;
  browsingRecent.value = false;
  searchError.value = false;
  resultLimit.value = 200;
}

async function runSearch() {
  cancelPendingSearch();
  const token = searchToken;
  const stage = currentStage.value;

  if (!stage || !hasActiveFilters.value) {
    results.value = [];
    totalMatches.value = 0;
    loading.value = false;
    return;
  }

  const keyword = searchMode.value === 'keyword' ? query.value.trim() : '';
  const category = selectedCategory.value === 'all' ? '' : selectedCategory.value;
  const { minAmount: min, maxAmount: max } = searchMode.value === 'amount'
    ? amountRange()
    : { minAmount: null, maxAmount: null };
  hasSearched.value = true;
  browsingRecent.value = false;
  searchError.value = false;
  loading.value = true;

  try {
    const found = await searchExpenses({
      stageId: stage.id,
      query: keyword,
      category,
      limit: resultLimit.value,
      minAmount: min,
      maxAmount: max,
      onProgress: (message) => {
        if (token === searchToken) totalMatches.value = message.count;
      }
    });
    if (token !== searchToken) return;
    const rows = await loadExpensesByIds(found.ids);
    if (token !== searchToken) return;
    results.value = rows;
    totalMatches.value = found.count;
  } catch (err) {
    if (err?.code !== 'SEARCH_CANCELLED' && token === searchToken) {
      console.error(err);
      results.value = [];
      totalMatches.value = 0;
      searchError.value = true;
    }
  } finally {
    if (token === searchToken) loading.value = false;
  }
}

async function browseRecent() {
  const stage = currentStage.value;
  if (!stage) return;

  cancelPendingSearch();
  const token = searchToken;
  hasSearched.value = true;
  browsingRecent.value = true;
  searchError.value = false;
  loading.value = true;

  try {
    const rows = await loadRecentExpenses(stage.id, resultLimit.value);
    if (token !== searchToken) return;
    results.value = rows;
    totalMatches.value = Math.max(rows.length, currentStageStats.value.count || 0);
  } catch (err) {
    if (err?.code !== 'SEARCH_CANCELLED' && token === searchToken) {
      console.error(err);
      results.value = [];
      totalMatches.value = 0;
      searchError.value = true;
    }
  } finally {
    if (token === searchToken) loading.value = false;
  }
}

function scheduleSearch() {
  if (!hasActiveFilters.value) {
    resetSearchState();
    return;
  }

  hasSearched.value = true;
  browsingRecent.value = false;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTimer = null;
    runSearch();
  }, 220);
}

function runSearchNow() {
  if (!hasActiveFilters.value) return;
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = null;
  }
  runSearch();
}

function focusSearch() {
  searchInput.value?.focus?.({ preventScroll: true });
}

function setSearchMode(mode) {
  if (searchMode.value === mode) return;
  searchMode.value = mode;
  results.value = [];
  totalMatches.value = 0;
  hasSearched.value = false;
  browsingRecent.value = false;
  resultLimit.value = 200;

  if (mode === 'keyword') {
    minAmount.value = '';
    maxAmount.value = '';
    nextTick(() => focusSearch());
  } else {
    query.value = '';
    nextTick(() => minAmountInput.value?.focus?.({ preventScroll: true }));
  }
  haptic('light');
}

function clearQuery() {
  query.value = '';
  focusSearch();
}

function clearAmountFilter() {
  minAmount.value = '';
  maxAmount.value = '';
}

function loadMore() {
  resultLimit.value += 200;
  if (browsingRecent.value) browseRecent();
  else runSearch();
}

async function removeSearchExpense(expense) {
  const removed = await removeExpense(expense);
  if (removed) {
    results.value = results.value.filter((row) => row.id !== expense.id);
    totalMatches.value = Math.max(0, totalMatches.value - 1);
  }
}

function openDaily(expense) {
  dailyDate.value = dayKey(new Date(expense.spentAt));
  dailyOpen.value = true;
  goToPane('record');
  if (router.currentRoute.value.path !== '/') router.push('/');
  haptic('light');
}

function editExpense(expense) {
  record.openRecord(expense);
}

function close() {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}

watch([searchMode, query, selectedCategory, minAmount, maxAmount], scheduleSearch);

watch(
  () => currentStage.value?.id,
  () => {
    if (browsingRecent.value) {
      browseRecent();
      return;
    }
    if (hasActiveFilters.value) scheduleSearch();
    else resetSearchState();
  }
);

watch(
  () => currentStageStats.value.count,
  (count) => {
    if (browsingRecent.value) totalMatches.value = Math.max(results.value.length, count || 0);
  }
);

onMounted(() => {
  nextTick(() => focusSearch());
});

onUnmounted(() => {
  cancelPendingSearch();
});
</script>
