import { showConfirmDialog, showToast } from 'vant';
import { useLedger } from './useLedger';
import { formatMoney } from '../utils/format';
import { haptic } from '../utils/haptics';
import { DANGER_COLOR } from '../utils/theme';

export function useExpenseActions() {
  const { deleteExpense } = useLedger();

  async function removeExpense(expense) {
    try {
      await showConfirmDialog({
        title: '删除支出',
        message: `删除这笔 ¥${formatMoney(expense.amount)} 的支出？`,
        confirmButtonText: '删除',
        confirmButtonColor: DANGER_COLOR
      });
    } catch (err) {
      return false;
    }

    await deleteExpense(expense.id);
    haptic('warning');
    showToast('已删除');
    return true;
  }

  return { removeExpense };
}
