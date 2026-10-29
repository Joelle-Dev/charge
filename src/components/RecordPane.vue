<template>
  <section class="record-pane">
    <header class="record-pane-head">
      <div class="record-pane-title">
        <span class="record-eyebrow">{{ monthTitle }}</span>
        <h1>本月支出</h1>
        <p>{{ expenseCount ? `${groups.length} 类 · ${expenseCount} 笔` : '这个月还没有支出' }}</p>
      </div>
      <strong class="record-month-total">¥{{ formatMoney(total) }}</strong>
    </header>

    <div v-if="loading" class="record-loading">
      <span class="loading-dot"></span>
      正在看看这个月…
    </div>

    <div v-else-if="groups.length" class="record-tree">
      <div class="record-trunk" aria-hidden="true">
        <svg viewBox="0 0 22 100" preserveAspectRatio="none">
          <path d="M11 0 C 7 18, 15 34, 10 52 C 6 70, 14 84, 11 100"></path>
        </svg>
        <span class="record-trunk-root"></span>
      </div>

      <article
        v-for="(group, index) in groups"
        :key="group.category"
        class="record-branch"
        :class="[
          index % 2 === 0 ? 'is-left' : 'is-right',
          { expanded: isExpanded(group.category) }
        ]"
        :style="{
          '--swatch': group.color,
          '--branch-width': group.branchWidth,
          '--branch-delay': `${index * 45}ms`
        }"
      >
        <svg class="record-branch-arm" viewBox="0 0 26 34" preserveAspectRatio="none" aria-hidden="true">
          <path :d="index % 2 === 0 ? 'M26 34 C 20 34, 16 16, 0 16' : 'M0 34 C 6 34, 10 16, 26 16'"></path>
        </svg>

        <div class="record-leaf">
          <div class="record-leaf-head">
            <div class="record-leaf-main">
              <span class="record-leaf-name">{{ group.category }}</span>
              <span class="record-leaf-amount">¥{{ formatMoney(group.total) }}</span>
              <span class="record-leaf-meta">{{ group.percent }}% · {{ group.items.length }} 笔</span>
            </div>
            <button
              class="record-leaf-toggle"
              :class="{ expanded: isExpanded(group.category) }"
              type="button"
              :aria-expanded="isExpanded(group.category)"
              :aria-label="isExpanded(group.category) ? `收起${group.category}明细` : `展开${group.category}明细`"
              @click="toggle(group.category)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6"></path>
              </svg>
            </button>
          </div>

          <div v-if="isExpanded(group.category)" class="record-leaf-cluster">
            <span
              v-for="expense in group.visibleItems"
              :key="expense.id"
              class="record-expense-leaf"
            >
              <span class="record-expense-note">{{ expense.note || expense.category }}</span>
              <span class="record-expense-amount">¥{{ formatMoney(expense.amount) }}</span>
            </span>
            <span v-if="group.hiddenCount" class="record-expense-more">
              还有 {{ group.hiddenCount }} 笔
            </span>
          </div>
        </div>
      </article>
    </div>

    <div v-else class="record-empty">
      <strong>这个月还没花钱</strong>
      <span>果冻在等第一笔</span>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useLedger } from '../composables/useLedger';
import { categoryColor, formatMoney, sumAmounts } from '../utils/format';
import { haptic } from '../utils/haptics';
import { currentMonthKey, monthLabel } from '../utils/months';

const { ready, currentStage, dataVersion, loadMonthExpenses } = useLedger();

const month = ref(currentMonthKey());
const monthTitle = computed(() => monthLabel(month.value));
const expenses = ref([]);
const loading = ref(true);
const expanded = ref(new Set());
let loadToken = 0;

const total = computed(() => sumAmounts(expenses.value));
const expenseCount = computed(() => expenses.value.length);

const groups = computed(() => {
  const map = new Map();
  for (const expense of expenses.value) {
    const category = expense.category || '其他';
    if (!map.has(category)) {
      map.set(category, { category, total: 0, items: [] });
    }
    const group = map.get(category);
    group.total += Number(expense.amount) || 0;
    group.items.push(expense);
  }

  const sum = total.value || 1;
  return [...map.values()]
    .sort((a, b) => b.total - a.total)
    .map((group) => {
      const percent = Math.round((group.total / sum) * 100);
      const visibleItems = group.items.slice(0, 4);
      return {
        ...group,
        percent,
        color: categoryColor(group.category),
        branchWidth: (2 + Math.min(1, percent / 100) * 5).toFixed(1),
        visibleItems,
        hiddenCount: group.items.length - visibleItems.length
      };
    });
});

async function loadMonth() {
  if (!ready.value) {
    loading.value = true;
    return;
  }

  const stage = currentStage.value;
  const token = ++loadToken;
  if (!stage) {
    expenses.value = [];
    loading.value = false;
    return;
  }

  loading.value = true;
  month.value = currentMonthKey();
  try {
    const items = await loadMonthExpenses(stage.id, month.value);
    if (token !== loadToken) return;
    expenses.value = items;
  } finally {
    if (token === loadToken) loading.value = false;
  }
}

watch(
  [ready, dataVersion, () => currentStage.value?.id],
  loadMonth,
  { immediate: true }
);

function isExpanded(category) {
  return expanded.value.has(category);
}

function toggle(category) {
  const next = new Set(expanded.value);
  if (next.has(category)) next.delete(category);
  else next.add(category);
  expanded.value = next;
  haptic('light');
}

</script>
