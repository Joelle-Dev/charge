<template>
  <div class="parsed-list">
    <div v-for="(entry, index) in entries" :key="entry.key || entry.id" class="parsed-card">
      <div class="parsed-head">
        <span class="parsed-head-left">
          <span class="parsed-index"><PawIcon v-if="paw" />{{ index + 1 }}</span>
          <span class="parsed-raw">{{ entry.raw || entry.note || '果冻听到的' }}</span>
        </span>
        <button class="remove-chip" type="button" @click="emit('remove', entry, index)">删掉这条</button>
      </div>
      <div class="parsed-grid">
        <div class="field full">
          <span class="field-label">金额</span>
          <div class="amount-input">
            <span class="currency">¥</span>
            <input v-model.number="entry.amount" type="number" inputmode="decimal" min="0" step="0.01">
          </div>
        </div>
        <label class="field">
          <span class="field-label">分类</span>
          <select v-model="entry.category" class="select">
            <option v-for="category in categoryOptions(entry)" :key="category" :value="category">
              {{ iconFor(category) }} {{ category }}
            </option>
          </select>
        </label>
        <div class="field">
          <span class="field-label">日期</span>
          <DateTimeField
            :model-value="toDateInput(entry.spentAt)"
            type="date"
            @update:model-value="updateEntryDate(entry, $event)"
          />
        </div>
        <label class="field full">
          <span class="field-label">备注</span>
          <input v-model="entry.note" class="input" type="text" maxlength="40" :placeholder="entry.category">
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import DateTimeField from './DateTimeField.vue';
import PawIcon from './PawIcon.vue';
import { useLedger } from '../composables/useLedger';
import { applyDateToIso, toDateInput } from '../utils/format';

const props = defineProps({
  entries: { type: Array, required: true },
  categories: { type: Array, default: () => [] },
  paw: { type: Boolean, default: false }
});
const emit = defineEmits(['remove']);
const { iconFor } = useLedger();

function categoryOptions(entry) {
  return props.categories.includes(entry.category)
    ? props.categories
    : [entry.category, ...props.categories];
}

function updateEntryDate(entry, value) {
  entry.spentAt = applyDateToIso(entry.spentAt, value);
}
</script>
