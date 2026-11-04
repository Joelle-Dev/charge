import { ref } from 'vue';

const KEY = 'shoucai:hideAmount';

function readInitial() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch (err) {
    return false;
  }
}

const hideAmount = ref(readInitial());

function toggleHideAmount() {
  hideAmount.value = !hideAmount.value;
  try {
    localStorage.setItem(KEY, hideAmount.value ? '1' : '0');
  } catch (err) {
    // ignore
  }
  return hideAmount.value;
}

export function usePrivacy() {
  return { hideAmount, toggleHideAmount };
}
