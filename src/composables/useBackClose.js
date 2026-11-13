import { onUnmounted, watch } from 'vue';

// 所有浮层共用一份历史栈：popstate 只通知「栈顶」的那个浮层关闭，
// 避免叠层时关一个浮层把另一个也误关（还顺手丢掉未保存的输入）。
const stack = [];
let skipPops = 0;
let listening = false;

function runTombstoneCleanup() {
  // 乱序关闭会留下「墓碑」历史条目，等它浮到栈顶时自动退掉
  const top = stack[stack.length - 1];
  if (!top || !top.tombstone) return;
  stack.pop();
  skipPops += 1;
  history.back();
}

function handleSharedPopState() {
  if (skipPops > 0) {
    skipPops -= 1;
    runTombstoneCleanup();
    return;
  }
  const top = stack.pop();
  if (!top) return;
  if (top.tombstone) {
    runTombstoneCleanup();
    return;
  }
  top.notifyPopped();
  runTombstoneCleanup();
}

function ensureListening() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('popstate', handleSharedPopState);
}

export function useBackClose(isOpen, close) {
  let entry = null;
  ensureListening();

  watch(isOpen, (open) => {
    if (open && !entry) {
      const current = {
        tombstone: false,
        notifyPopped() {
          if (entry === current) entry = null;
          close();
        }
      };
      entry = current;
      stack.push(current);
      history.pushState({ overlay: true }, '');
    } else if (!open && entry) {
      const current = entry;
      entry = null;
      if (stack[stack.length - 1] === current) {
        stack.pop();
        skipPops += 1;
        history.back();
        runTombstoneCleanup();
      } else {
        // 压在其它浮层下面，不能动历史，否则会把上面浮层的条目弹掉
        current.tombstone = true;
      }
    }
  });

  onUnmounted(() => {
    if (!entry) return;
    const current = entry;
    entry = null;
    if (stack[stack.length - 1] === current) {
      // 自己的条目还在历史顶端：把它退掉，不留幽灵条目
      stack.pop();
      skipPops += 1;
      history.back();
      runTombstoneCleanup();
    } else {
      // 压在其它条目下面，先留墓碑，等浮到栈顶时自动跳过
      current.tombstone = true;
    }
  });
}
