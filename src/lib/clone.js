export function toCloneable(value) {
  if (Array.isArray(value)) return value.map(toCloneable);
  if (value instanceof Blob || value instanceof Date || value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) return value;
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = toCloneable(value[key]);
    return out;
  }
  return value;
}
