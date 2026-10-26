import { formatTime, toDateInput } from './format.js';

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildStageCsv(stage, expenses, options = {}) {
  if (!expenses.length) return '';

  const now = options.now || new Date();
  const total = expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  const budget = Number(stage.budget) || 0;

  const rows = [
    ['阶段', stage.name],
    ['导出时间', `${toDateInput(now)} ${formatTime(now)}`],
    ['支出笔数', String(expenses.length)],
    ['总支出', total.toFixed(2)],
    ['预算', budget > 0 ? budget.toFixed(2) : '未设置'],
    ['剩余', budget > 0 ? (budget - total).toFixed(2) : '未设置'],
    [],
    ['日期', '时间', '分类', '备注', '金额']
  ];

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

  return `\ufeff${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

export function exportStageCsv(stage, expenses) {
  const csv = buildStageCsv(stage, expenses);
  if (!csv) return false;

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
