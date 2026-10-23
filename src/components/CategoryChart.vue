<template>
  <section v-if="currentExpenses.length" class="card insight-card">
    <div class="card-head">
      <h2>花在哪了</h2>
      <span class="muted">{{ categoryGroups.length }} 类</span>
    </div>
    <div class="category-bars">
      <div
        v-for="group in categoryGroups"
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
          <span>{{ percent(group.amount) }}%</span>
        </div>
        <div class="category-track">
          <div class="category-fill" :style="{ width: `${percent(group.amount)}%` }"></div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { useLedger } from '../composables/useLedger';
import { categoryColor, formatMoney } from '../utils/format';

const { currentExpenses, categoryGroups, total } = useLedger();

function percent(amount) {
  if (!total.value) return 0;
  return Math.round((amount / total.value) * 100);
}
</script>
