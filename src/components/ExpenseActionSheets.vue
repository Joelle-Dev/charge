<template>
  <van-action-sheet
    v-model:show="showRowActions"
    :actions="rowActions"
    cancel-text="取消"
    close-on-click-action
    teleport="body"
    :description="rowActionDescription"
    @select="onRowAction"
  />

  <van-action-sheet
    v-model:show="showMoveActions"
    :actions="moveActions"
    title="把这笔搬到别的阶段"
    cancel-text="取消"
    close-on-click-action
    teleport="body"
    :description="moveDescription"
    @select="onMoveAction"
    @closed="onMoveClosed"
  />
</template>

<script setup>
import { computed, nextTick, ref } from 'vue';
import { showToast } from 'vant';
import { useExpenseActions } from '../composables/useExpenseActions';
import { useRecordEntry } from '../composables/useRecordEntry';
import { formatMoney } from '../utils/format';
import { haptic } from '../utils/haptics';
import { DANGER_COLOR } from '../utils/theme';

const { removeExpenseWithUndo, moveTargets, moveExpense } = useExpenseActions();
const { openRecord } = useRecordEntry();

const showRowActions = ref(false);
const showMoveActions = ref(false);
const rowActionTarget = ref(null);

const rowActions = computed(() => {
  const actions = [{ name: '改改这笔', key: 'edit' }];
  if (moveTargets(rowActionTarget.value).length) {
    actions.push({ name: '搬到别的阶段', key: 'move', subname: '换个地方放' });
  }
  actions.push({ name: '删掉这笔', key: 'delete', color: DANGER_COLOR });
  return actions;
});

const moveActions = computed(() => moveTargets(rowActionTarget.value));

const rowActionDescription = computed(() => {
  const expense = rowActionTarget.value;
  if (!expense) return '';
  const label = expense.note || expense.category || '这笔支出';
  return `${label} · ¥${formatMoney(expense.amount)}`;
});

const moveDescription = computed(() => rowActionDescription.value);

function open(expense) {
  if (!expense) return;
  rowActionTarget.value = expense;
  showRowActions.value = true;
  haptic('light');
}

function onRowAction(action) {
  const expense = rowActionTarget.value;
  if (!expense) return;

  if (action.key === 'edit') {
    rowActionTarget.value = null;
    haptic('light');
    openRecord(expense);
    return;
  }

  if (action.key === 'move') {
    nextTick(() => {
      showMoveActions.value = true;
    });
    return;
  }

  if (action.key === 'delete') {
    rowActionTarget.value = null;
    removeExpenseWithUndo(expense);
  }
}

async function onMoveAction(action) {
  const expense = rowActionTarget.value;
  if (!expense) return;
  try {
    const target = await moveExpense(expense, action.key);
    haptic('success');
    showToast(`搬到「${target.name}」啦`);
  } catch (err) {
    console.error(err);
    showToast('没搬过去，再试一次吧');
  } finally {
    rowActionTarget.value = null;
  }
}

function onMoveClosed() {
  rowActionTarget.value = null;
}

defineExpose({ open });
</script>
