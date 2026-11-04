import { showConfirmDialog, showToast } from 'vant';
import { useLedger } from './useLedger';
import { useUndo } from './useUndo';
import { formatMoney } from '../utils/format';
import { haptic } from '../utils/haptics';
import { DANGER_COLOR } from '../utils/theme';

export function useExpenseActions() {
  const { deleteExpense, restoreExpense, updateExpense, stages } = useLedger();
  const { showUndo } = useUndo();

  async function removeExpense(expense) {
    try {
      await showConfirmDialog({
        title: '删掉这笔花销',
        message: `要把这笔 ¥${formatMoney(expense.amount)} 的花销删掉吗？`,
        confirmButtonText: '删掉吧',
        confirmButtonColor: DANGER_COLOR
      });
    } catch (err) {
      return false;
    }

    await deleteExpense(expense.id);
    haptic('warning');
    showToast('删掉啦');
    return true;
  }

  async function removeExpenseWithUndo(expense) {
    const snapshot = { ...expense };
    await deleteExpense(expense.id);
    haptic('warning');
    showUndo('这笔花销删掉啦', async () => {
      await restoreExpense(snapshot);
      haptic('success');
      showToast('又回来啦');
    });
    return true;
  }

  function moveTargets(expense) {
    if (!expense) return [];
    return [...stages.value]
      .filter((stage) => stage.id !== expense.stageId)
      .sort((a, b) => {
        if (Boolean(a.archived) !== Boolean(b.archived)) return a.archived ? 1 : -1;
        return (a.createdAt || 0) - (b.createdAt || 0);
      })
      .map((stage) => ({
        name: stage.name,
        key: stage.id,
        subname: stage.archived ? '已收起来' : ''
      }));
  }

  async function moveExpense(expense, stageId) {
    const target = stages.value.find((stage) => stage.id === stageId);
    if (!target) throw new Error('还没有这个账本呢');
    await updateExpense(expense, { stageId });
    return target;
  }

  return { removeExpense, removeExpenseWithUndo, moveTargets, moveExpense };
}
