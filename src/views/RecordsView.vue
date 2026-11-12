<template>
  <ExpenseRecords />
</template>

<script setup>
import { onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import ExpenseRecords from '../components/ExpenseRecords.vue';
import { useLedger } from '../composables/useLedger';
import { setActiveScope } from '../lib/privacy.js';

const router = useRouter();
const { ready, currentStage } = useLedger();

setActiveScope('records');

onMounted(() => {
  window.scrollTo({ top: 0 });
});

watch(
  [ready, currentStage],
  ([isReady, stage]) => {
    if (isReady && !stage) router.replace('/');
  },
  { immediate: true }
);
</script>
