<template>
  <SheetFrame v-model:show="show" title="搜索明细" max-height="90dvh">
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
        placeholder="搜备注、分类、金额"
        aria-label="搜索明细"
      >
      <button v-if="query" class="search-clear" type="button" aria-label="清空搜索" @click="query = ''">×</button>
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

    <div v-if="!currentExpenses.length" class="list-empty">
      <p>这个阶段还没有支出</p>
      <span>先记一笔，再来搜索</span>
    </div>

    <template v-else>
      <p class="search-summary">找到 {{ filteredExpenses.length }} 笔</p>

      <div v-if="!filteredExpenses.length" class="list-empty">
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
              @delete="removeExpense"
            />
          </div>
        </div>
      </div>
    </template>
  </SheetFrame>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import SheetFrame from './SheetFrame.vue';
import ExpenseRow from './ExpenseRow.vue';
import PawIcon from './PawIcon.vue';
import { useExpenseActions } from '../composables/useExpenseActions';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { categoryColor, dayKey, dayLabel, formatMoney } from '../utils/format';

const show = defineModel('show', { type: Boolean, default: false });
const sheets = useSheets();
const { currentStage, currentExpenses } = useLedger();
const { removeExpense } = useExpenseActions();

const query = ref('');
const selectedCategory = ref('all');
const searchInput = ref(null);

const filterCategories = computed(() => {
  const set = new Set();
  for (const expense of currentExpenses.value) set.add(expense.category || '其他');
  return [...set];
});

const filteredExpenses = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  return currentExpenses.value.filter((expense) => {
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

watch(show, async (visible) => {
  if (!visible) return;
  query.value = '';
  selectedCategory.value = 'all';
  await nextTick();
  searchInput.value?.focus?.();
});

watch(
  () => currentStage.value?.id,
  () => {
    selectedCategory.value = 'all';
  }
);

function editExpense(expense) {
  show.value = false;
  sheets.openExpenseForm(expense);
}
</script>
