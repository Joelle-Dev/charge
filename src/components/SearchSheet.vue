<template>
  <SheetFrame
    ref="sheetRef"
    v-model:show="show"
    title="搜索明细"
    :max-height="sheetMaxHeight"
    fill
    keyboard-padding
    @opened="focusSearch"
  >
    <template #toolbar>
      <div class="search-field">
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
          placeholder="搜备注、分类、金额"
          aria-label="搜索明细"
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
    </template>

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

    <div v-if="!currentStageStats.count" class="list-empty">
      <p>这个阶段还没有支出</p>
      <span>先记一笔，再来搜索</span>
    </div>

    <div v-else-if="loading" class="loading-state">
      <span class="loading-dot"></span>
      正在整理搜索数据…
    </div>

    <template v-else>
      <p class="search-summary">
        找到 {{ totalMatches }} 笔<template v-if="filteredExpenses.length < totalMatches"> · 已显示 {{ filteredExpenses.length }} 笔</template>
      </p>

      <div v-if="!totalMatches" class="list-empty">
        <p>没有找到相关支出</p>
        <span>换个关键词试试</span>
      </div>

      <div v-else class="expense-list search-results">
        <div v-for="group in filteredGroups" :key="group.key" class="day-group expanded">
          <div class="day-head search-day-head">
            <span class="day-main">
              <span class="day-label">{{ group.label }}</span>
              <span class="day-count">{{ group.items.length }} 笔</span>
            </span>
            <span class="day-total">¥{{ formatMoney(group.total) }}</span>
          </div>
          <div class="day-items">
            <ExpenseRow
              v-for="expense in group.items"
              :key="expense.id"
              :expense="expense"
              @edit="editExpense"
              @delete="removeSearchExpense"
            />
          </div>
        </div>
      </div>
      <button
        v-if="filteredExpenses.length < totalMatches"
        class="secondary-btn search-more"
        type="button"
        @click="loadMore"
      >
        加载更多
      </button>
    </template>
  </SheetFrame>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import SheetFrame from './SheetFrame.vue';
import ExpenseRow from './ExpenseRow.vue';
import PawIcon from './PawIcon.vue';
import { useExpenseActions } from '../composables/useExpenseActions';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { categoryColor, dayKey, dayLabel, formatMoney } from '../utils/format';

const show = defineModel('show', { type: Boolean, default: false });
const sheets = useSheets();
const {
  currentStage,
  currentStageStats,
  categoryGroups,
  loadRecentExpenses,
  loadExpensesByIds,
  searchExpenses
} = useLedger();
const { removeExpense } = useExpenseActions();

const query = ref('');
const selectedCategory = ref('all');
const searchInput = ref(null);
const sheetRef = ref(null);
const sheetMaxHeight = ref('90dvh');
const results = ref([]);
const totalMatches = ref(0);
const loading = ref(false);
const resultLimit = ref(200);
let searchToken = 0;
let searchTimer = null;

function syncSheetHeight() {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  sheetMaxHeight.value = `${Math.min(Math.round(viewportHeight * 0.9), 680)}px`;
}

const filterCategories = computed(() => categoryGroups.value.map((group) => group.category));

const filteredExpenses = computed(() => results.value);

const filteredGroups = computed(() => {
  const groups = new Map();
  for (const expense of filteredExpenses.value) {
    const key = dayKey(new Date(expense.spentAt));
    if (!groups.has(key)) {
      groups.set(key, { key, label: dayLabel(key), total: 0, items: [] });
    }
    const group = groups.get(key);
    group.items.push(expense);
    group.total += Number(expense.amount) || 0;
  }
  return [...groups.values()];
});

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
  resultLimit.value = 200;
}

async function runSearch() {
  cancelPendingSearch();
  const token = searchToken;
  const stage = currentStage.value;

  if (!stage) {
    results.value = [];
    totalMatches.value = 0;
    loading.value = false;
    return;
  }

  const keyword = query.value.trim();
  const category = selectedCategory.value === 'all' ? '' : selectedCategory.value;
  loading.value = true;

  try {
    if (!keyword && !category) {
      const rows = await loadRecentExpenses(stage.id, resultLimit.value);
      if (token !== searchToken) return;
      results.value = rows;
      totalMatches.value = currentStageStats.value.count || 0;
    } else {
      const found = await searchExpenses({
        stageId: stage.id,
        query: keyword,
        category,
        limit: resultLimit.value,
        onProgress: (message) => {
          if (token === searchToken) totalMatches.value = message.count;
        }
      });
      if (token !== searchToken) return;
      const rows = await loadExpensesByIds(found.ids);
      if (token !== searchToken) return;
      results.value = rows;
      totalMatches.value = found.count;
    }
  } catch (err) {
    if (err?.code !== 'SEARCH_CANCELLED' && token === searchToken) {
      console.error(err);
      results.value = [];
      totalMatches.value = 0;
    }
  } finally {
    if (token === searchToken) loading.value = false;
  }
}

function scheduleSearch() {
  if (!show.value) return;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTimer = null;
    runSearch();
  }, 200);
}

watch(show, (visible) => {
  if (!visible) {
    query.value = '';
    selectedCategory.value = 'all';
    resetSearchState();
    return;
  }

  query.value = '';
  selectedCategory.value = 'all';
  resultLimit.value = 200;
  syncSheetHeight();
  runSearch();
});

watch(
  () => currentStage.value?.id,
  () => {
    if (!show.value) return;
    selectedCategory.value = 'all';
    resultLimit.value = 200;
    runSearch();
  }
);

watch([query, selectedCategory], () => {
  if (!show.value) return;
  resultLimit.value = 200;
  sheetRef.value?.scrollToTop?.();
  scheduleSearch();
});

function focusSearch() {
  searchInput.value?.focus?.({ preventScroll: true });
}

function clearQuery() {
  query.value = '';
  focusSearch();
}

function loadMore() {
  resultLimit.value += 200;
  runSearch();
}

async function removeSearchExpense(expense) {
  const removed = await removeExpense(expense);
  if (removed) {
    results.value = results.value.filter((row) => row.id !== expense.id);
    totalMatches.value = Math.max(0, totalMatches.value - 1);
  }
}

function editExpense(expense) {
  show.value = false;
  sheets.openExpenseForm(expense);
}
</script>
