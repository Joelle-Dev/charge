function storageManager() {
  return typeof navigator !== 'undefined' && navigator.storage ? navigator.storage : null;
}

export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  const digits = index === 0 ? 0 : size >= 100 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[index]}`;
}

export function storageUsagePercent(usage, quota) {
  if (!quota || quota <= 0) return 0;
  return Math.min(100, Math.max(0, (Number(usage) || 0) / quota * 100));
}

async function readEstimate(storage) {
  if (!storage || typeof storage.estimate !== 'function') return null;
  try {
    const { usage = 0, quota = 0 } = await storage.estimate();
    return { usage: Number(usage) || 0, quota: Number(quota) || 0 };
  } catch (err) {
    return null;
  }
}

export async function getStorageState() {
  const storage = storageManager();
  const supported = Boolean(storage && (
    typeof storage.persist === 'function' ||
    typeof storage.persisted === 'function' ||
    typeof storage.estimate === 'function'
  ));

  let persisted = false;
  if (storage && typeof storage.persisted === 'function') {
    try {
      persisted = Boolean(await storage.persisted());
    } catch (err) {
      persisted = false;
    }
  }

  const estimate = await readEstimate(storage);
  const canPersist = Boolean(storage && typeof storage.persist === 'function') && !persisted;
  return {
    supported,
    persisted,
    canPersist,
    usage: estimate?.usage || 0,
    quota: estimate?.quota || 0
  };
}

export async function requestPersistence() {
  const storage = storageManager();
  if (!storage || typeof storage.persist !== 'function') {
    return { supported: false, persisted: false };
  }

  if (typeof storage.persisted === 'function') {
    try {
      if (await storage.persisted()) return { supported: true, persisted: true };
    } catch (err) {
      // Fall through to persist().
    }
  }

  try {
    const persisted = await storage.persist();
    return { supported: true, persisted: Boolean(persisted) };
  } catch (err) {
    return { supported: true, persisted: false };
  }
}
