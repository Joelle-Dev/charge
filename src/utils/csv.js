import { formatTime, toDateInput } from './format';

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportStageCsv(stage, expenses) {
  if (!expenses.length) return false;

  const rows = [['日期', '时间', '分类', '备注', '金额']];
  for (const expense of expenses) {
    const date = new Date(expense.spentAt);
    rows.push([
      toDateInput(date),
      formatTime(expense.spentAt),
      expense.category || '其他',
      expense.note || '',
      Number(expense.amount).toFixed(2)
    ]);
  }

  const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${stage.name.replace(/[\\/:*?"<>|]/g, '_')}-支出.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
