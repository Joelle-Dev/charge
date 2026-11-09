import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_CATEGORY_ICONS,
  ICON_CHOICES,
  ICON_GROUPS,
  iconForCategory,
  moveCategoryInList,
  normalizeCategories,
  reorderCategoryList,
  seedCategories
} from '../src/utils/categories.js';
import {
  CATEGORY_ICON_ASSET_KEYS,
  iconAssetKey
} from '../src/utils/categoryIconAssets.js';
import { DEFAULT_CATEGORY, PRESET_CATEGORIES } from '../src/lib/parser.js';

test('seed categories cover presets and pin 其他 last', () => {
  const seeded = seedCategories();
  assert.equal(seeded.length, PRESET_CATEGORIES.length);
  assert.equal(seeded[seeded.length - 1], DEFAULT_CATEGORY);
  assert.ok(seeded.includes('餐饮'));
});

test('normalize keeps user order, dedupes and pins 其他 last', () => {
  const list = normalizeCategories(['b', 'a', DEFAULT_CATEGORY, 'a', '', 'c']);
  assert.deepEqual(list, ['b', 'a', 'c', DEFAULT_CATEGORY]);
});

test('user can drop preset categories and count reflects the list', () => {
  const list = normalizeCategories(['餐饮', DEFAULT_CATEGORY]);
  assert.deepEqual(list, ['餐饮', DEFAULT_CATEGORY]);
  assert.equal(list.length, 2);
});

test('moveCategoryInList swaps neighbours and keeps 其他 pinned', () => {
  const base = ['a', 'b', 'c', DEFAULT_CATEGORY];
  assert.deepEqual(moveCategoryInList(base, 'b', -1), ['b', 'a', 'c', DEFAULT_CATEGORY]);
  assert.deepEqual(moveCategoryInList(base, 'b', 1), ['a', 'c', 'b', DEFAULT_CATEGORY]);
  assert.deepEqual(moveCategoryInList(base, 'a', -1), base);
  assert.deepEqual(moveCategoryInList(base, 'c', 1), base);
  assert.deepEqual(moveCategoryInList(base, DEFAULT_CATEGORY, -1), base);
});

test('reorderCategoryList moves an item to a target index and keeps 其他 pinned', () => {
  const base = ['a', 'b', 'c', 'd', DEFAULT_CATEGORY];
  assert.deepEqual(reorderCategoryList(base, 0, 2), ['b', 'c', 'a', 'd', DEFAULT_CATEGORY]);
  assert.deepEqual(reorderCategoryList(base, 3, 1), ['a', 'd', 'b', 'c', DEFAULT_CATEGORY]);
  assert.deepEqual(reorderCategoryList(base, 1, 1), base);
});

test('reorderCategoryList clamps targets and ignores invalid input', () => {
  const base = ['a', 'b', 'c', DEFAULT_CATEGORY];
  assert.deepEqual(reorderCategoryList(base, 0, 99), ['b', 'c', 'a', DEFAULT_CATEGORY]);
  assert.deepEqual(reorderCategoryList(base, 2, -5), ['c', 'a', 'b', DEFAULT_CATEGORY]);
  assert.deepEqual(reorderCategoryList(base, -1, 1), base);
  assert.deepEqual(reorderCategoryList(base, 99, 1), base);
  assert.deepEqual(reorderCategoryList(['a', DEFAULT_CATEGORY], 0, 1), ['a', DEFAULT_CATEGORY]);
  assert.deepEqual(reorderCategoryList([DEFAULT_CATEGORY], 0, 0), [DEFAULT_CATEGORY]);
});

test('iconForCategory prefers overrides then defaults then first char', () => {
  assert.equal(iconForCategory('餐饮'), DEFAULT_CATEGORY_ICONS['餐饮']);
  assert.equal(iconForCategory('餐饮', { 餐饮: '🍔' }), '🍔');
  assert.equal(iconForCategory('猫粮'), '猫');
  assert.equal(iconForCategory(''), '·');
});

test('icon choices are unique', () => {
  assert.equal(new Set(ICON_CHOICES).size, ICON_CHOICES.length);
});

test('icon groups flatten into the picker choices', () => {
  assert.deepEqual(ICON_GROUPS.flatMap((group) => group.icons), ICON_CHOICES);
  assert.ok(ICON_GROUPS.every((group) => group.label && group.icons.length));
});

test('every default and picker icon maps to a bundled asset', () => {
  const icons = new Set([...ICON_CHOICES, ...Object.values(DEFAULT_CATEGORY_ICONS)]);
  for (const icon of icons) {
    assert.ok(iconAssetKey(icon), `missing asset for ${icon}`);
  }
  assert.equal(
    new Set(Object.values(CATEGORY_ICON_ASSET_KEYS)).size,
    Object.keys(CATEGORY_ICON_ASSET_KEYS).length
  );

  const iconDir = fileURLToPath(new URL('../src/assets/category-icons/', import.meta.url));
  for (const key of Object.values(CATEGORY_ICON_ASSET_KEYS)) {
    assert.ok(existsSync(`${iconDir}${key}.svg`), `missing svg for ${key}`);
  }
});
