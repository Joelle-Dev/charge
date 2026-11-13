// 变高行虚拟滚动的核心纯函数：偏移计算、可视窗口计算、滚动锚定。
// 与 DOM 无关，便于单测；Vue 侧封装见 composables/useVirtualRows.js。

export function resolveRowHeight(row, heights, estimateSize) {
  const measured = heights.get(row.key);
  return Number.isFinite(measured) && measured > 0 ? measured : estimateSize(row);
}

export function computeOffsets(rows, heights, estimateSize) {
  const tops = new Array(rows.length);
  let top = 0;
  for (let i = 0; i < rows.length; i += 1) {
    tops[i] = top;
    top += resolveRowHeight(rows[i], heights, estimateSize);
  }
  return { tops, total: top };
}

export function findStartIndex(tops, scrollTop) {
  if (!tops.length) return 0;
  let lo = 0;
  let hi = tops.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (tops[mid] <= scrollTop) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export function computeWindow({ rows, tops, total, scrollTop, viewportHeight, overscan = 0 }) {
  if (!rows.length) {
    return { start: 0, end: 0, topSpace: 0, bottomSpace: 0 };
  }
  const top = Math.max(0, scrollTop);
  const start = findStartIndex(tops, top - overscan);
  const last = findStartIndex(tops, top + Math.max(0, viewportHeight) + overscan);
  const end = Math.min(rows.length, last + 1);
  return {
    start,
    end,
    topSpace: tops[start],
    bottomSpace: end < rows.length ? total - tops[end] : 0
  };
}

export function captureAnchor(rows, tops, scrollTop) {
  if (!rows.length) return null;
  const top = Math.max(0, scrollTop);
  const index = findStartIndex(tops, top);
  return { key: rows[index].key, offset: top - tops[index] };
}

export function restoreAnchor(anchor, rows, tops) {
  if (!anchor) return null;
  const index = rows.findIndex((row) => row.key === anchor.key);
  if (index < 0) return null;
  return tops[index] + Math.max(0, anchor.offset);
}
