import { DEFAULT_CATEGORY, PRESET_CATEGORIES } from '../lib/parser.js';

export const DEFAULT_CATEGORY_ICONS = {
  餐饮: '🍜',
  交通: '🚗',
  住宿: '🏠',
  购物: '🛍️',
  娱乐: '🎮',
  门票: '🎫',
  咖啡: '☕',
  零食: '🍪',
  日用: '🧺',
  医疗: '💊',
  教育: '📚',
  宠物: '🐾',
  通讯: '📱',
  水电: '💡',
  房租: '🏠',
  旅行: '✈️',
  礼物: '🎁',
  其他: '🧾'
};

export const ICON_GROUPS = [
  {
    label: '吃吃喝喝',
    icons: ['🍜', '☕', '🍪', '🍰', '🥤', '🍚', '🍔', '🍕', '🍣', '🍎']
  },
  {
    label: '出门走走',
    icons: ['🚗', '🚇', '✈️', '🚌', '🚲', '🛵', '⛽', '🧳']
  },
  {
    label: '居家生活',
    icons: ['🏠', '🛍️', '🧺', '🧹', '🛋️', '👗', '👟', '💄', '🐾']
  },
  {
    label: '玩玩乐乐',
    icons: ['🎮', '🎬', '🎵', '🎤', '🎲', '🎨', '🎯', '🏋️']
  },
  {
    label: '日用和其他',
    icons: ['📚', '💊', '🏥', '📱', '💡', '🎁', '💰', '🧾', '🎫', '💳']
  }
];

export const ICON_CHOICES = ICON_GROUPS.flatMap((group) => group.icons);

export function iconForCategory(name, overrides = {}) {
  if (overrides && overrides[name]) return overrides[name];
  if (DEFAULT_CATEGORY_ICONS[name]) return DEFAULT_CATEGORY_ICONS[name];
  const text = String(name || '').trim();
  return text ? text.slice(0, 1) : '·';
}

export function normalizeCategories(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const name = String(raw ?? '');
    if (!name || name === DEFAULT_CATEGORY || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  out.push(DEFAULT_CATEGORY);
  return out;
}

export function seedCategories() {
  return normalizeCategories(PRESET_CATEGORIES);
}

export function moveCategoryInList(list, name, delta) {
  const items = normalizeCategories(list);
  const movable = items.filter((item) => item !== DEFAULT_CATEGORY);
  const from = movable.indexOf(name);
  if (from < 0) return items;
  const to = from + delta;
  if (to < 0 || to >= movable.length) return items;
  const next = [...movable];
  [next[from], next[to]] = [next[to], next[from]];
  return [...next, DEFAULT_CATEGORY];
}

export function reorderCategoryList(list, from, to) {
  const items = normalizeCategories(list);
  const movable = items.filter((item) => item !== DEFAULT_CATEGORY);
  if (movable.length < 2) return items;

  const fromIndex = Number(from);
  const toIndex = Number(to);
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return items;
  if (fromIndex < 0 || fromIndex >= movable.length) return items;

  const target = Math.min(Math.max(toIndex, 0), movable.length - 1);
  if (fromIndex === target) return items;

  const [moved] = movable.splice(fromIndex, 1);
  movable.splice(target, 0, moved);
  return [...movable, DEFAULT_CATEGORY];
}
