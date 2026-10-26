<template>
  <van-swipe-cell ref="cellRef" class="expense-swipe" :left-width="64" :right-width="64">
    <ExpenseItem :expense="expense" @select="edit" />

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
const emit = defineEmits(['edit', 'delete']);
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
</script>
