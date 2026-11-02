import { reactive } from 'vue';

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
  if (action) await action();
}

export function useUndo() {
  return {
    undoState,
    showUndo,
    runUndo,
    dismissUndo
  };
}
