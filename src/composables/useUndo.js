import { reactive } from 'vue';
import { showToast } from 'vant';

const undoState = reactive({
  visible: false,
  message: '',
  action: null
});

let timer = null;

function clearTimer() {
  if (!timer) return;
  clearTimeout(timer);
  timer = null;
}

function dismissUndo() {
  clearTimer();
  undoState.visible = false;
  undoState.action = null;
}

function showUndo(message, action, duration = 4000) {
  clearTimer();
  undoState.message = message;
  undoState.action = action;
  undoState.visible = true;
  timer = setTimeout(() => {
    timer = null;
    undoState.visible = false;
    undoState.action = null;
  }, duration);
}

async function runUndo() {
  const action = undoState.action;
  dismissUndo();
  if (!action) return;
  try {
    await action();
  } catch (err) {
    console.error('撤销失败', err);
    showToast('撤销没成功，再试试吧');
  }
}

export function useUndo() {
  return {
    undoState,
    showUndo,
    runUndo,
    dismissUndo
  };
}
