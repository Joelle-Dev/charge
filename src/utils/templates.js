import { DEFAULT_CATEGORY } from '../lib/parser.js';

export function buildTemplates(expenses, limit = 3) {
  const templates = new Map();
  for (const expense of expenses) {
    const amount = Number(expense.amount) || 0;
    if (!amount) continue;
    const category = expense.category || DEFAULT_CATEGORY;
    const note = String(expense.note || '').trim();
    const key = `${category}|${note}|${amount.toFixed(2)}`;
    const existing = templates.get(key) || {
      key,
      amount,
      category,
      note,
      count: 0,
      lastAt: 0
    };
    existing.count += 1;
    existing.lastAt = Math.max(existing.lastAt, new Date(expense.spentAt).getTime());
    templates.set(key, existing);
  }

  return [...templates.values()]
    .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
    .slice(0, limit);
}

export function mergeTemplates(primary, fallback, limit = 3) {
  const merged = [];
  const seen = new Set();
  for (const list of [primary, fallback]) {
    for (const template of list) {
      if (seen.has(template.key)) continue;
      seen.add(template.key);
      merged.push(template);
      if (merged.length === limit) return merged;
    }
  }
  return merged;
}
