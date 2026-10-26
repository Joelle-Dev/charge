<template>
  <section class="recent-section">
    <div class="section-head">
      <div class="section-title">
        <h2>最近支出</h2>
        <span v-if="currentExpenses.length" class="section-count">仅显示最近 3 笔</span>
      </div>
      <div v-if="currentExpenses.length" class="section-actions">
        <span class="section-count">共 {{ currentExpenses.length }} 笔</span>
        <button class="text-btn" type="button" @click="openRecords">
          查看全部
        </button>
      </div>
    </div>

    <div v-if="recent.length" class="recent-list">
      <ExpenseItem
        v-for="expense in recent"
        :key="expense.id"
        class="recent-expense"
        :expense="expense"
        show-date
        @select="sheets.openExpenseForm"
      />
    </div>

    <div v-else class="recent-empty">
      <p>还没有支出</p>
      <span>点下面的麦克风，说一句就记上</span>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import ExpenseItem from './ExpenseItem.vue';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { haptic } from '../utils/haptics';

const { currentExpenses } = useLedger();
const sheets = useSheets();
const router = useRouter();

const recent = computed(() => currentExpenses.value.slice(0, 3));

function openRecords() {
  haptic('light');
  router.push('/records');
}
</script>
