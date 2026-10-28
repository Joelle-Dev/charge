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
const { currentStage, currentStageStats, categoryGroups, loadSearchIndex } = useLedger();
const { removeExpense } = useExpenseActions();

const query = ref('');
const selectedCategory = ref('all');
const searchInput = ref(null);
const sheetRef = ref(null);
const sheetMaxHeight = ref('90dvh');
const allRows = ref([]);
const loading = ref(false);
const visibleLimit = ref(100);

function syncSheetHeight() {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  sheetMaxHeight.value = `${Math.min(Math.round(viewportHeight * 0.9), 680)}px`;
}

const filterCategories = computed(() => categoryGroups.value.map((group) => group.category));

const matchedExpenses = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  return allRows.value.filter((expense) => {
    if (selectedCategory.value !== 'all' && expense.category !== selectedCategory.value) return false;
    if (!keyword) return true;
    return [
      expense.note || '',
      expense.category || '',
      String(expense.amount),
      formatMoney(expense.amount)
    ].some((value) => String(value).toLowerCase().includes(keyword));
  });
});

const totalMatches = computed(() => matchedExpenses.value.length);
const filteredExpenses = computed(() => matchedExpenses.value.slice(0, visibleLimit.value));

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

async function loadRows() {
  if (!currentStage.value) {
    allRows.value = [];
    return;
  }
  loading.value = true;
  try {
    allRows.value = await loadSearchIndex(currentStage.value.id);
  } finally {
    loading.value = false;
  }
}

watch(show, (visible) => {
  if (!visible) {
    allRows.value = [];
    return;
  }

  query.value = '';
  selectedCategory.value = 'all';
  visibleLimit.value = 100;
  syncSheetHeight();
  loadRows();
});

watch(
  () => currentStage.value?.id,
  () => {
    selectedCategory.value = 'all';
    if (show.value) loadRows();
  }
);

watch([query, selectedCategory], () => {
  visibleLimit.value = 100;
  sheetRef.value?.scrollToTop?.();
});

function focusSearch() {
  searchInput.value?.focus?.({ preventScroll: true });
}

function clearQuery() {
  query.value = '';
  focusSearch();
}

function loadMore() {
  visibleLimit.value += 100;
}

async function removeSearchExpense(expense) {
  const removed = await removeExpense(expense);
  if (removed) {
    allRows.value = allRows.value.filter((row) => row.id !== expense.id);
  }
}

function editExpense(expense) {
  show.value = false;
  sheets.openExpenseForm(expense);
}
</script>
