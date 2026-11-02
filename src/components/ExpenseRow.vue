<template>
  <van-swipe-cell ref="cellRef" class="expense-swipe" :left-width="64" :right-width="64">
    <div class="expense-row">
      <ExpenseItem :expense="expense" @select="edit" />
      <button
        class="expense-more"
        type="button"
        :aria-label="`更多操作：${expense.note || expense.category}`"
        @click.stop="openMenu"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6"></circle>
          <circle cx="12" cy="12" r="1.6"></circle>
          <circle cx="19" cy="12" r="1.6"></circle>
        </svg>
      </button>
    </div>

    <template #left>
      <button class="swipe-action swipe-edit" type="button" @click="edit">编辑</button>
    </template>
    <template #right>
      <button class="swipe-action swipe-delete" type="button" @click="remove">删除</button>
    </template>
  </van-swipe-cell>
</template>

<script setup>
import { ref } from 'vue';
import ExpenseItem from './ExpenseItem.vue';

const props = defineProps({
  expense: { type: Object, required: true }
});
const emit = defineEmits(['edit', 'delete', 'menu']);
const cellRef = ref(null);

function closeSwipe() {
  cellRef.value?.close?.();
}

function edit() {
  closeSwipe();
  emit('edit', props.expense);
}

function remove() {
  closeSwipe();
  emit('delete', props.expense);
}

function openMenu() {
  closeSwipe();
  emit('menu', props.expense);
}
</script>
