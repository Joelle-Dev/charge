<template>
  <section v-if="currentExpenses.length" class="card insight-card">
    <div class="card-head">
      <h2>花在哪了</h2>
      <span class="muted">{{ rows.length }} 类</span>
    </div>
    <div class="category-bars">
      <div
        v-for="group in rows"
        :key="group.category"
        class="category-row"
        :style="{ '--swatch': categoryColor(group.category) }"
      >
        <div class="category-label">
          <span class="category-swatch"></span>
          <span>{{ group.category }}</span>
        </div>
        <div class="category-value">
          ¥{{ formatMoney(group.amount) }}
          <span>{{ group.percent }}%</span>
        </div>
        <div class="category-track">
          <div class="category-fill" :style="{ width: `${group.percent}%` }"></div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useLedger } from '../composables/useLedger';
import { categoryColor, formatMoney } from '../utils/format';

const { currentExpenses, categoryGroups, total } = useLedger();

const rows = computed(() => {
  const sum = total.value;
  return categoryGroups.value.map((group) => ({
    ...group,
    percent: sum ? Math.round((group.amount / sum) * 100) : 0
  }));
});
</script>
