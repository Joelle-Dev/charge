import { ref } from 'vue';

export const DANGER_COLOR = '#c94a44';

export const THEME_OPTIONS = [
  { key: 'system', label: '跟随系统' },
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' }
];

const STORAGE_KEY = 'shoucai:theme';
const THEME_COLOR = { light: '#faf5ec', dark: '#1b1613' };
const MODES = ['system', 'light', 'dark'];

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (MODES.includes(value)) return value;
  } catch (err) {
    // localStorage 在隐私模式下不可用
  }
  return 'system';
}

function systemPrefersDark() {
  return typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
}

function resolve(mode) {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return mode;
}

export const themeMode = ref(readStored());
export const appliedTheme = ref(resolve(themeMode.value));

function apply() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = appliedTheme.value;
  root.style.colorScheme = appliedTheme.value;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[appliedTheme.value]);
}

function refreshApplied() {
  const next = resolve(themeMode.value);
  if (next === appliedTheme.value) return;
  appliedTheme.value = next;
  apply();
}

export function setThemeMode(mode) {
  if (!MODES.includes(mode)) return;
  themeMode.value = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch (err) {
    // 存不下就只在本次会话生效
  }
  refreshApplied();
}

export function initTheme() {
  apply();
  window.matchMedia?.('(prefers-color-scheme: dark)')
    .addEventListener?.('change', refreshApplied);
}
