import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { captureAnchor, computeOffsets, computeWindow, restoreAnchor } from '../utils/virtualList';

// 变高行虚拟滚动：只渲染视口附近的行，上下用 spacer 撑起滚动高度。
// 行高用 ResizeObserver 实测并缓存，数据/测量变化时按「首可见行 + 行内偏移」
// 锚定恢复滚动位置，避免跳动。要求 rows 的每项有稳定唯一 key。
export function useVirtualRows({ rows, scrollRef, estimateSize, overscan = 320 }) {
  const heights = new Map();
  const rowEls = new Map();
  const elToKey = new WeakMap();
  const tops = ref([]);
  const total = ref(0);
  const range = ref({ start: 0, end: 0 });
  const topSpace = ref(0);
  const bottomSpace = ref(0);

  const visibleRows = computed(() => rows.value.slice(range.value.start, range.value.end));

  let el = null;
  let viewportHeight = 0;
  let ro = null;
  let scrollRaf = 0;
  let pending = new Map();
  let flushScheduled = false;

  function updateWindow() {
    const win = computeWindow({
      rows: rows.value,
      tops: tops.value,
      total: total.value,
      scrollTop: el ? el.scrollTop : 0,
      viewportHeight,
      overscan
    });
    range.value = { start: win.start, end: win.end };
    topSpace.value = win.topSpace;
    bottomSpace.value = win.bottomSpace;
  }

  function recomputeOffsets() {
    const { tops: nextTops, total: nextTotal } = computeOffsets(rows.value, heights, estimateSize);
    tops.value = nextTops;
    total.value = nextTotal;
    updateWindow();
  }

  function applyWithAnchor(mutate) {
    const scrollTop = el ? el.scrollTop : 0;
    const anchor = scrollTop > 0 ? captureAnchor(rows.value, tops.value, scrollTop) : null;
    mutate();
    recomputeOffsets();
    if (anchor && el) {
      const next = restoreAnchor(anchor, rows.value, tops.value);
      if (next != null && next !== el.scrollTop) el.scrollTop = next;
    }
  }

  function flushMeasures() {
    if (!pending.size) return;
    const batch = pending;
    pending = new Map();
    const updates = [];
    for (const [key, element] of batch) {
      if (!element || !element.isConnected) continue;
      const height = element.getBoundingClientRect().height;
      if (height > 0 && heights.get(key) !== height) updates.push([key, height]);
    }
    if (!updates.length) return;
    applyWithAnchor(() => {
      for (const [key, height] of updates) heights.set(key, height);
    });
  }

  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;
    nextTick(() => {
      flushScheduled = false;
      flushMeasures();
    });
  }

  function trackRow(key, element) {
    if (!element) {
      const previous = rowEls.get(key);
      if (previous && ro) ro.unobserve(previous);
      rowEls.delete(key);
      return;
    }
    rowEls.set(key, element);
    elToKey.set(element, key);
    if (ro) ro.observe(element);
    pending.set(key, element);
    scheduleFlush();
  }

  function scrollToKey(key, offset = 0) {
    if (!el) return false;
    const index = rows.value.findIndex((row) => row.key === key);
    if (index < 0) return false;
    const top = tops.value[index];
    if (!Number.isFinite(top)) return false;
    el.scrollTo({ top: Math.max(0, top + offset), behavior: 'smooth' });
    return true;
  }

  function onScroll() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      updateWindow();
    });
  }

  function measureViewport() {
    if (!el) return;
    const height = el.clientHeight;
    if (height && height !== viewportHeight) {
      viewportHeight = height;
      updateWindow();
    }
  }

  onMounted(() => {
    el = scrollRef.value;
    if (!el) return;
    measureViewport();
    el.addEventListener('scroll', onScroll, { passive: true });
    ro = new ResizeObserver((entries) => {
      let viewportChanged = false;
      for (const entry of entries) {
        if (entry.target === el) {
          viewportChanged = true;
          continue;
        }
        const key = elToKey.get(entry.target);
        if (key !== undefined) pending.set(key, entry.target);
      }
      if (pending.size) scheduleFlush();
      if (viewportChanged) measureViewport();
    });
    ro.observe(el);
    recomputeOffsets();
    scheduleFlush();
  });

  watch(rows, () => {
    applyWithAnchor(() => {});
    scheduleFlush();
  });

  onBeforeUnmount(() => {
    if (el) el.removeEventListener('scroll', onScroll);
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
    if (ro) ro.disconnect();
    el = null;
    rowEls.clear();
    pending.clear();
  });

  return {
    visibleRows,
    topSpace,
    bottomSpace,
    trackRow,
    scrollToKey
  };
}
