<template>
  <div class="date-field-wrap">
    <button
      class="input date-field"
      :class="{ 'is-empty': !modelValue, 'is-disabled': disabled }"
      type="button"
      :tabindex="usePicker ? 0 : -1"
      :disabled="usePicker ? disabled : undefined"
      :aria-hidden="usePicker ? undefined : 'true'"
      :aria-label="usePicker ? `${fieldLabel}：${displayValue}` : undefined"
      @click="usePicker && openPicker()"
    >
      <span class="date-field-value">{{ displayValue }}</span>
      <svg
        class="date-field-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <template v-if="type === 'date'">
          <rect x="3" y="4" width="18" height="16" rx="3"></rect>
          <path d="M8 2v4M16 2v4M3 9h18"></path>
          <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"></path>
        </template>
        <template v-else>
          <circle cx="12" cy="12" r="8.5"></circle>
          <path d="M12 7.5V12l3 2"></path>
        </template>
      </svg>
    </button>

    <input
      v-if="!usePicker"
      class="date-field-native"
      :type="type"
      :value="modelValue"
      :disabled="disabled"
      :aria-label="`${fieldLabel}：${displayValue}`"
      @change="onNativeChange"
    >

    <van-popup
      v-if="usePicker"
      v-model:show="show"
      position="bottom"
      round
      teleport="body"
      class="picker-popup"
    >
      <van-date-picker
        v-if="type === 'date'"
        v-model="draft"
        :title="pickerTitle"
        :min-date="minDate"
        :max-date="maxDate"
        :confirm-button-text="confirmText"
        :cancel-button-text="cancelText"
        @confirm="confirmDate"
        @cancel="closePicker"
      />
      <van-time-picker
        v-else
        v-model="draft"
        :title="pickerTitle"
        :confirm-button-text="confirmText"
        :cancel-button-text="cancelText"
        @confirm="confirmTime"
        @cancel="closePicker"
      />
    </van-popup>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { pad2, toDateInput } from '../utils/format';
import { haptic } from '../utils/haptics';

const props = defineProps({
  modelValue: { type: String, default: '' },
  type: { type: String, default: 'date', validator: (value) => ['date', 'time'].includes(value) },
  label: { type: String, default: '' },
  title: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' }
});

const emit = defineEmits(['update:modelValue']);

const usePicker = typeof window !== 'undefined' && (
  window.matchMedia?.('(pointer: coarse)').matches ||
  'ontouchstart' in window
);
const show = ref(false);
const draft = ref([]);
const minDate = new Date(2000, 0, 1);
const maxDate = new Date(2100, 11, 31);

const fieldLabel = computed(() => props.label || (props.type === 'date' ? '日期' : '时间'));
const pickerTitle = computed(() => props.title || (props.type === 'date' ? '选择日期' : '选择时间'));

const displayValue = computed(() => {
  if (!props.modelValue) return props.type === 'date' ? '选择日期' : '选择时间';
  if (props.type === 'time') return props.modelValue;

  const now = new Date();
  const today = toDateInput(now);
  if (props.modelValue === today) return '今天';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (props.modelValue === toDateInput(yesterday)) return '昨天';

  const [year, month, day] = props.modelValue.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return props.modelValue;
  return year === now.getFullYear()
    ? `${month}月${day}日`
    : `${year}-${pad2(month)}-${pad2(day)}`;
});

function openPicker() {
  if (props.disabled) return;

  const now = new Date();
  if (props.type === 'date') {
    const parts = props.modelValue ? props.modelValue.split('-').map(Number) : [];
    draft.value = parts.length === 3 && parts.every(Number.isFinite)
      ? [String(parts[0]), pad2(parts[1]), pad2(parts[2])]
      : [String(now.getFullYear()), pad2(now.getMonth() + 1), pad2(now.getDate())];
  } else {
    const parts = props.modelValue ? props.modelValue.split(':').map(Number) : [];
    draft.value = parts.length === 2 && parts.every(Number.isFinite)
      ? [pad2(parts[0]), pad2(parts[1])]
      : [pad2(now.getHours()), pad2(now.getMinutes())];
  }

  show.value = true;
}

function closePicker() {
  show.value = false;
}

function onNativeChange(event) {
  if (event.target.value) emit('update:modelValue', event.target.value);
}

function confirmDate() {
  if (draft.value.length !== 3) return;
  const [year, month, day] = draft.value.map(Number);
  emit('update:modelValue', `${year}-${pad2(month)}-${pad2(day)}`);
  haptic('light');
  closePicker();
}

function confirmTime() {
  if (draft.value.length !== 2) return;
  const [hour, minute] = draft.value.map(Number);
  emit('update:modelValue', `${pad2(hour)}:${pad2(minute)}`);
  haptic('light');
  closePicker();
}
</script>
