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
        <div class="field category-field">
          <span class="field-label">分类</span>
          <button
            class="category-chip"
            type="button"
            :style="{ '--swatch': categoryColor(entry.category) }"
            :aria-label="`分类：${entry.category}，点击重新选择`"
            @click="openPicker(entry)"
          >
            <span class="category-chip-icon" aria-hidden="true"><CategoryIcon :name="iconFor(entry.category)" /></span>
            <span class="category-chip-name">{{ entry.category }}</span>
            <svg class="category-chip-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6"></path>
            </svg>
          </button>
        </div>
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

    <CategoryPickerSheet
      v-model:show="pickerOpen"
      :categories="categories"
      :selected="activeEntry?.category || ''"
      @select="applyCategory"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import DateTimeField from './DateTimeField.vue';
import CategoryIcon from './CategoryIcon.vue';
import CategoryPickerSheet from './CategoryPickerSheet.vue';
import PawIcon from './PawIcon.vue';
import { useLedger } from '../composables/useLedger';
import { applyDateToIso, categoryColor, toDateInput } from '../utils/format';
import { haptic } from '../utils/haptics';

const props = defineProps({
  entries: { type: Array, required: true },
  categories: { type: Array, default: () => [] },
  paw: { type: Boolean, default: false }
});
const emit = defineEmits(['remove']);
const { iconFor } = useLedger();

const pickerOpen = ref(false);
const activeEntry = ref(null);

function openPicker(entry) {
  activeEntry.value = entry;
  pickerOpen.value = true;
}

function applyCategory(category) {
  if (activeEntry.value) activeEntry.value.category = category;
  activeEntry.value = null;
  haptic('light');
}

function updateEntryDate(entry, value) {
  entry.spentAt = applyDateToIso(entry.spentAt, value);
}
</script>
