import { DEFAULT_CATEGORY } from '../lib/parser.js';
import { combineLocal, formatTime, pad2, toDateInput } from './format.js';
import { monthLabel } from './months.js';

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
    ...(options.month ? [['月份', monthLabel(options.month)]] : []),
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

export function exportStageCsv(stage, expenses, options = {}) {
  const csv = buildStageCsv(stage, expenses, options);
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


export function parseCsv(text) {
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function normalizeCsvDate(value) {
  const match = String(value ?? '').trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) return '';
  return `${match[1]}-${pad2(match[2])}-${pad2(match[3])}`;
}

function normalizeCsvTime(value) {
  const text = String(value ?? '').trim();
  if (!text) return '12:00';
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return '';
  return `${pad2(match[1])}:${match[2]}`;
}

export function parseStageCsv(text) {
  const rows = parseCsv(text);
  const headers = ['日期', '时间', '分类', '备注', '金额'];
  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map((cell) => String(cell ?? '').trim());
    return headers.every((header) => normalized.includes(header));
  });

  if (headerIndex < 0) {
    return { error: '没有找到「日期,时间,分类,备注,金额」表头' };
  }

  const headerRow = rows[headerIndex].map((cell) => String(cell ?? '').trim());
  const indexes = Object.fromEntries(headers.map((header) => [header, headerRow.indexOf(header)]));
  const metadata = {};
  for (let index = 0; index < headerIndex; index += 1) {
    const key = String(rows[index][0] ?? '').trim();
    if (key === '阶段' || key === '预算' || key === '月份') {
      metadata[key] = String(rows[index][1] ?? '').trim();
    }
  }

  const errors = [];
  const expenses = [];

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row.some((cell) => String(cell ?? '').trim())) continue;

    const line = index + 1;
    const date = normalizeCsvDate(row[indexes['日期']]);
    const time = normalizeCsvTime(row[indexes['时间']]);
    const amountText = String(row[indexes['金额']] ?? '').replace(/[¥,\s]/g, '');
    const amount = Number(amountText);
    const spentAt = date && time ? combineLocal(date, time) : null;

    if (!date) {
      errors.push({ line, message: '日期格式不正确' });
      continue;
    }
    if (!time) {
      errors.push({ line, message: '时间格式不正确' });
      continue;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push({ line, message: '金额无效' });
      continue;
    }
    if (!spentAt) {
      errors.push({ line, message: '日期时间无效' });
      continue;
    }

    const category = String(row[indexes['分类']] ?? '').trim() || DEFAULT_CATEGORY;
    expenses.push({
      amount: Math.round(amount * 100) / 100,
      category,
      note: String(row[indexes['备注']] ?? '').trim(),
      spentAt: spentAt.toISOString()
    });
  }

  return {
    stageName: metadata['阶段'] || '',
    budget: Number(metadata['预算']) > 0 ? Math.round(Number(metadata['预算']) * 100) / 100 : null,
    month: metadata['月份'] || '',
    expenses,
    errors,
    totalRows: Math.max(0, rows.length - headerIndex - 1)
  };
}
