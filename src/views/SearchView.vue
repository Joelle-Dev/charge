<template>
  <section class="search-page">
    <header class="search-page-head">
      <button class="search-close" type="button" aria-label="关闭查明细" @click="close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12"></path>
        </svg>
      </button>
      <h1 class="search-page-title">查明细</h1>
      <PrivacyToggle class="search-eye" scope="search" />
    </header>

    <div class="search-context">
      <div class="history-scope-switch search-scope-switch" role="group" aria-label="账本范围">
        <button
          type="button"
          :disabled="!currentStage"
          :class="{ active: stageScope === 'current' }"
          @click="setSearchScope('current')"
        >
          当前账本
        </button>
        <button
          type="button"
          :class="{ active: stageScope === 'all' }"
          @click="setSearchScope('all')"
        >
          全部账本
        </button>
      </div>
      <span class="search-context-range">{{ rangeLabel }}</span>
      <span v-if="selectedCategory !== 'all'" class="search-context-category">{{ selectedCategory }}</span>
    </div>

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
          aria-label="查明细"
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
          <CategoryIcon class="filter-paw" :name="iconFor(category)" />
          {{ category }}
        </button>
      </div>

    </div>

    <div class="search-page-results">
      <div v-if="!scopeStageIds.length" class="list-empty">
        <p>当前范围没有可搜索的账本</p>
        <span>先去建个账本，或者回到小票改一下账本</span>
      </div>

      <LoadingState v-else-if="loading" text="果冻在翻小账本…" />

      <div v-else-if="!hasSearched" class="search-initial">
        <span class="search-initial-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5"></circle>
            <path d="m16 16 4 4"></path>
          </svg>
        </span>
        <p>{{ searchMode === 'keyword' ? '输入关键词查明细' : '输入金额范围查明细' }}</p>
        <span>{{ searchMode === 'keyword' ? '可以搜备注或分类' : '比如 20 到 100 之间的支出' }}</span>
        <button class="search-browse-btn" type="button" @click="browseRecent">
          看看最近的支出
        </button>
      </div>

      <template v-else>
        <div v-if="totalMatches > 0 || results.length" class="search-result-summary">
          <div class="search-result-summary-main">
            <span class="search-result-summary-count">{{ summaryText }}</span>
            <span v-if="isTruncated" class="search-result-summary-sub">
              已显示 {{ results.length }} 笔
            </span>
            <span v-else-if="browsingRecent" class="search-result-summary-sub">按时间倒序</span>
          </div>
          <div class="search-result-summary-total">
            <span>{{ isTruncated ? '全部合计' : '合计' }}</span>
            <strong>¥{{ displayMoney(resultTotal) }}</strong>
          </div>
        </div>

        <div v-if="searchError" class="list-empty">
          <p>搜索没成功</p>
          <span>果冻绊了一跤，再搜一次吧</span>
          <button class="text-btn" type="button" @click="runSearchNow">重新搜搜</button>
        </div>

        <div v-else-if="!totalMatches" class="list-empty">
          <p>{{ browsingRecent ? '这个范围还没有明细' : '果冻没翻到这笔' }}</p>
          <span>{{ browsingRecent ? '换个范围或关键词再找找嘛' : '换个词或金额范围再找找嘛' }}</span>
        </div>

        <div v-else class="expense-list search-results">
          <div v-for="group in filteredGroups" :key="group.key" class="day-group expanded">
            <div class="day-head search-day-head">
              <span class="day-main">
                <span class="day-label">{{ group.label }}</span>
                <span class="day-count">{{ group.items.length }} 笔</span>
              </span>
              <span class="day-total">¥{{ displayMoney(group.total) }}</span>
            </div>
            <div class="day-items">
              <ExpenseRow
                v-for="expense in group.items"
                :key="expense.id"
                :expense="expense"
                :stage-name="showStageName ? stageNameFor(expense) : ''"
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
import { showToast } from 'vant';
import ExpenseRow from '../components/ExpenseRow.vue';
import LoadingState from '../components/LoadingState.vue';
import CategoryIcon from '../components/CategoryIcon.vue';
import PrivacyToggle from '../components/PrivacyToggle.vue';
import { useExpenseActions } from '../composables/useExpenseActions';
import { useLedger } from '../composables/useLedger';
import { useLedgerPanes } from '../composables/useLedgerPanes';
import { useRecordEntry } from '../composables/useRecordEntry';
import { useRecordsView } from '../composables/useRecordsView';
import { displayMoney } from '../utils/money';
import { combineLocal, dayKey, toDateInput } from '../utils/format';
import { useViewScope } from '../composables/useViewScope';
import { setActiveScope } from '../lib/privacy.js';
import { groupExpensesByDay } from '../utils/expenses';
import { haptic } from '../utils/haptics';

const router = useRouter();
const record = useRecordEntry();
const { dailyOpen, dailyDate } = useRecordsView();
const { goToPane } = useLedgerPanes();
const {
  currentStage,
  stages,
  activeStages,
  stageStats,
  switchStage,
  loadExpensesByIds,
  searchExpenses,
  iconFor
} = useLedger();
const { removeExpense } = useExpenseActions();
const {
  stageScope,
  detailFrom,
  detailTo,
  detailCategory
} = useViewScope();

const todayKey = toDateInput(new Date());
const searchFrom = ref(detailFrom.value || shiftYear(todayKey, -1));
const searchTo = ref(detailTo.value || todayKey);
detailFrom.value = '';
detailTo.value = '';

const searchMode = ref('keyword');
const query = ref('');
const selectedCategory = ref(detailCategory.value || 'all');
detailCategory.value = '';
const minAmount = ref('');
const maxAmount = ref('');
const searchInput = ref(null);
const minAmountInput = ref(null);
const results = ref([]);
const totalMatches = ref(0);
const resultTotal = ref(0);
const loading = ref(false);
const hasSearched = ref(false);
const searchError = ref(false);
const browsingRecent = ref(false);
const resultLimit = ref(200);
let searchToken = 0;
let searchTimer = null;
let autoStarted = false;

const scopeStageIds = computed(() => {
  if (stageScope.value === 'all') return activeStages.value.map((stage) => stage.id);
  return currentStage.value ? [currentStage.value.id] : [];
});
const showStageName = computed(() => stageScope.value === 'all' && activeStages.value.length > 1);
const stageNameById = computed(() => {
  const map = new Map();
  for (const stage of stages.value) map.set(stage.id, stage.name);
  return map;
});
const filterCategories = computed(() => {
  const totals = new Map();
  for (const stageId of scopeStageIds.value) {
    const categories = stageStats(stageId).categories || {};
    for (const [category, value] of Object.entries(categories)) {
      totals.set(category, (totals.get(category) || 0) + (value.amount || 0));
    }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category);
});
const hasAmountFilter = computed(() => Boolean(String(minAmount.value).trim() || String(maxAmount.value).trim()));
const hasActiveFilters = computed(() => (
  selectedCategory.value !== 'all' ||
  (searchMode.value === 'keyword' ? Boolean(query.value.trim()) : hasAmountFilter.value)
));
const filteredGroups = computed(() => groupExpensesByDay(results.value));
const isTruncated = computed(() => results.value.length < totalMatches.value);
const summaryText = computed(() => {
  if (browsingRecent.value) return `范围内 ${totalMatches.value} 笔`;
  return `找到 ${totalMatches.value} 笔`;
});
const rangeLabel = computed(() => {
  if (!searchFrom.value || !searchTo.value) return '全部时间';
  const short = (key) => key.replace(/-/g, '.');
  return searchFrom.value === searchTo.value
    ? short(searchFrom.value)
    : `${short(searchFrom.value)} - ${short(searchTo.value)}`;
});
const fromIso = computed(() => {
  const date = combineLocal(searchFrom.value, '00:00');
  return date ? date.toISOString() : '';
});
const toIso = computed(() => {
  const date = combineLocal(searchTo.value, '00:00');
  return date ? new Date(date.getTime() + 86400000).toISOString() : '';
});

function shiftYear(key, delta) {
  const date = new Date(`${key}T12:00:00`);
  date.setFullYear(date.getFullYear() + delta);
  return toDateInput(date);
}

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
  resultTotal.value = 0;
  loading.value = false;
  hasSearched.value = false;
  browsingRecent.value = false;
  searchError.value = false;
  resultLimit.value = 200;
}

function stageNameFor(expense) {
  return stageNameById.value.get(expense.stageId) || '';
}

function setSearchScope(scope) {
  if (scope === 'current' && !currentStage.value) return;
  if (stageScope.value === scope) return;
  stageScope.value = scope;
  haptic('light');
}

async function runSearch() {
  cancelPendingSearch();
  const token = searchToken;
  const stageIds = [...scopeStageIds.value];

  if (!stageIds.length || !hasActiveFilters.value) {
    results.value = [];
    totalMatches.value = 0;
    resultTotal.value = 0;
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
      stageIds,
      query: keyword,
      category,
      limit: resultLimit.value,
      minAmount: min,
      maxAmount: max,
      fromIso: fromIso.value,
      toIso: toIso.value,
      onProgress: (message) => {
        if (token === searchToken) {
          totalMatches.value = message.count;
          resultTotal.value = Number(message.sum) || 0;
        }
      }
    });
    if (token !== searchToken) return;
    const rows = await loadExpensesByIds(found.ids);
    if (token !== searchToken) return;
    results.value = rows;
    totalMatches.value = found.count;
    resultTotal.value = Number(found.sum) || 0;
  } catch (err) {
    if (err?.code !== 'SEARCH_CANCELLED' && token === searchToken) {
      console.error(err);
      results.value = [];
      totalMatches.value = 0;
      resultTotal.value = 0;
      searchError.value = true;
    }
  } finally {
    if (token === searchToken) loading.value = false;
  }
}

async function browseRecent() {
  const stageIds = [...scopeStageIds.value];
  if (!stageIds.length) return;

  cancelPendingSearch();
  const token = searchToken;
  hasSearched.value = true;
  browsingRecent.value = true;
  searchError.value = false;
  loading.value = true;

  try {
    const found = await searchExpenses({
      stageIds,
      limit: resultLimit.value,
      fromIso: fromIso.value,
      toIso: toIso.value
    });
    if (token !== searchToken) return;
    const rows = await loadExpensesByIds(found.ids);
    if (token !== searchToken) return;
    results.value = rows;
    totalMatches.value = found.count;
    resultTotal.value = Number(found.sum) || 0;
  } catch (err) {
    if (err?.code !== 'SEARCH_CANCELLED' && token === searchToken) {
      console.error(err);
      results.value = [];
      totalMatches.value = 0;
      resultTotal.value = 0;
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
    resultTotal.value = Math.max(0, resultTotal.value - (Number(expense.amount) || 0));
  }
}

function isArchivedExpense(expense) {
  return Boolean(stages.value.find((stage) => stage.id === expense.stageId)?.archived);
}

async function openDaily(expense) {
  if (isArchivedExpense(expense)) {
    showToast('这个账本已经归档啦，先恢复账本再查看吧');
    return;
  }
  if (expense.stageId && expense.stageId !== currentStage.value?.id) {
    await switchStage(expense.stageId);
  }
  dailyDate.value = dayKey(new Date(expense.spentAt));
  dailyOpen.value = true;
  goToPane('record');
  if (router.currentRoute.value.path !== '/') router.push('/');
  haptic('light');
}

async function editExpense(expense) {
  if (isArchivedExpense(expense)) {
    showToast('这个账本已经归档啦，先恢复账本再改吧');
    return;
  }
  if (expense.stageId && expense.stageId !== currentStage.value?.id) {
    await switchStage(expense.stageId);
  }
  record.openRecord(expense);
}

function close() {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}

watch(
  [searchMode, query, selectedCategory, minAmount, maxAmount],
  scheduleSearch
);

watch(
  [scopeStageIds, searchFrom, searchTo],
  ([ids]) => {
    if (!ids.length) {
      resetSearchState();
      return;
    }

    if (!autoStarted) {
      autoStarted = true;
      if (selectedCategory.value !== 'all') runSearch();
      else browseRecent();
      return;
    }

    if (browsingRecent.value) browseRecent();
    else if (hasActiveFilters.value) runSearch();
    else resetSearchState();
  },
  { immediate: true }
);

watch(filterCategories, (list) => {
  if (selectedCategory.value !== 'all' && !list.includes(selectedCategory.value)) {
    selectedCategory.value = 'all';
  }
});

setActiveScope('search');

onMounted(() => {
  nextTick(() => focusSearch());
});

onUnmounted(() => {
  cancelPendingSearch();
});
</script>
