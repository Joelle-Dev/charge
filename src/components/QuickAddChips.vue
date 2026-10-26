<template>
  <section v-if="recentTemplates.length" class="quick-add">
    <div class="quick-add-head">
      <h2>常记</h2>
      <span>轻点补一笔</span>
    </div>
    <div class="quick-chips">
      <button
        v-for="template in recentTemplates"
        :key="template.key"
        class="quick-chip"
        type="button"
        :style="{ '--swatch': categoryColor(template.category) }"
        @click="useTemplate(template)"
      >
        <span class="quick-chip-dot"></span>
        <span class="quick-chip-name">{{ template.note || template.category }}</span>
        <span class="quick-chip-amount">¥{{ formatMoney(template.amount) }}</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { categoryColor, formatMoney } from '../utils/format';
import { haptic } from '../utils/haptics';

const { recentTemplates } = useLedger();
const sheets = useSheets();

function useTemplate(template) {
  haptic('light');
  sheets.openExpenseForm(null, template);
}
</script>
