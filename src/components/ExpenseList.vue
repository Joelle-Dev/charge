<template>
  <section class="expense-section">
    <div class="expense-sticky">
      <div class="section-head">
        <div class="section-title">
          <h2>支出明细</h2>
          <span class="section-count">{{ filteredExpenses.length }} 笔</span>
        </div>
        <div class="section-actions">
          <button v-if="filteredGroups.length" class="text-btn" type="button" @click="toggleAll">
            {{ allExpanded ? '收起' : '展开全部' }}
          </button>
          <button v-if="currentExpenses.length" class="text-btn" type="button" @click="exportCsv">导出</button>
        </div>
      </div>

      <div v-if="filterCategories.length > 1" class="filter-row">
        <button
          class="filter-chip"
          :class="{ active: selectedCategory === 'all' }"
          type="button"
          @click="selectedCategory = 'all'"
        >
          <PawIcon class="filter-paw" />
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
          <span class="filter-dot" :style="{ background: categoryColor(category) }"></span>
          {{ category }}
        </button>
      </div>
    </div>

    <div v-if="!currentExpenses.length" class="list-empty">
      <p>还没有支出</p>
      <span>点下面的麦克风，说一句就记上</span>
    </div>

    <div v-else-if="!filteredGroups.length" class="list-empty">
      <p>这个分类还没有支出</p>
      <button class="text-btn" type="button" @click="selectedCategory = 'all'">查看全部</button>
    </div>

    <div v-else class="expense-list">
      <div
        v-for="group in filteredGroups"
        :key="group.key"
        class="day-group"
        :class="{ expanded: isExpanded(group.key) }"
      >
        <button class="day-head" type="button" @click="toggleDay(group.key)">
          <span class="day-main">
            <span class="day-label">{{ group.label }}</span>
            <span class="day-count">{{ group.items.length }} 笔</span>
          </span>
          <span class="day-side">
            <span class="day-total">¥{{ formatMoney(group.total) }}</span>
            <svg class="day-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6"></path>
            </svg>
          </span>
        </button>

        <div v-if="isExpanded(group.key)" class="day-items">
          <button
            v-for="expense in group.items"
            :key="expense.id"
            class="expense-item"
            type="button"
            :style="{ '--swatch': categoryColor(expense.category) }"
            :aria-label="`编辑 ${expense.note || expense.category} ¥${formatMoney(expense.amount)}`"
            @click="sheets.openExpenseForm(expense)"
          >
            <span class="category-icon">{{ (expense.category || '其他').slice(0, 1) }}</span>
            <span class="expense-main">
              <span class="expense-title">{{ expense.note || expense.category }}</span>
              <span class="expense-meta">
                <span>{{ expense.category }}</span>
                <span class="dot"></span>
                <span>{{ formatTime(expense.spentAt) }}</span>
              </span>
            </span>
            <span class="expense-amount">¥{{ formatMoney(expense.amount) }}</span>
          </button>
        </div>
      </div>
    </div>

    <button
      v-if="showBackToTop"
      class="back-to-top"
      type="button"
      aria-label="回到顶部"
      @click="backToTop"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 19V5"></path>
        <path d="m5 12 7-7 7 7"></path>
      </svg>
    </button>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { showToast } from 'vant';
import PawIcon from './PawIcon.vue';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { exportStageCsv } from '../utils/csv';
import {
  categoryColor,
  dayKey,
  dayLabel,
  formatMoney,
  formatTime,
  sumAmounts
} from '../utils/format';

const {
  currentStage,
  currentExpenses,
  categoryGroups
} = useLedger();
const sheets = useSheets();

const selectedCategory = ref('all');
const expandedKeys = ref(new Set());
const showBackToTop = ref(false);

const filterCategories = computed(() => categoryGroups.value.map((group) => group.category));

const filteredExpenses = computed(() => {
  if (selectedCategory.value === 'all') return currentExpenses.value;
  return currentExpenses.value.filter((expense) => expense.category === selectedCategory.value);
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
    group.total = sumAmounts(group.items);
  }
  return [...groups.values()];
});

const allExpanded = computed(() =>
  filteredGroups.value.length > 0 &&
  filteredGroups.value.every((group) => expandedKeys.value.has(group.key))
);

function isExpanded(key) {
  return expandedKeys.value.has(key);
}

function toggleDay(key) {
  const next = new Set(expandedKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedKeys.value = next;
}

function toggleAll() {
  expandedKeys.value = allExpanded.value
    ? new Set()
    : new Set(filteredGroups.value.map((group) => group.key));
}

function exportCsv() {
  if (!currentStage.value) return;
  const ok = exportStageCsv(currentStage.value, currentExpenses.value);
  showToast(ok ? '已导出（含阶段标题）' : '这个阶段还没有支出');
}

function onScroll() {
  showBackToTop.value = window.scrollY > 480;
}

function backToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

watch(
  () => filteredGroups.value[0]?.key,
  (key) => {
    if (!key || expandedKeys.value.has(key)) return;
    const next = new Set(expandedKeys.value);
    next.add(key);
    expandedKeys.value = next;
  },
  { immediate: true }
);

watch(selectedCategory, (category) => {
  if (category === 'all') {
    const first = filteredGroups.value[0]?.key;
    expandedKeys.value = new Set(first ? [first] : []);
  } else {
    expandedKeys.value = new Set(filteredGroups.value.map((group) => group.key));
  }
});

watch(
  () => currentStage.value?.id,
  () => {
    selectedCategory.value = 'all';
    const first = filteredGroups.value[0]?.key;
    expandedKeys.value = new Set(first ? [first] : []);
  }
);

watch(filterCategories, (list) => {
  if (selectedCategory.value !== 'all' && !list.includes(selectedCategory.value)) {
    selectedCategory.value = 'all';
  }
});

watch(
  () => filteredExpenses.value.length,
  (length, previous) => {
    if (length <= previous) return;
    const first = filteredGroups.value[0]?.key;
    if (!first) return;
    const next = new Set(expandedKeys.value);
    next.add(first);
    expandedKeys.value = next;
  }
);

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll);
});
</script>
