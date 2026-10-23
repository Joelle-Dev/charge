const DB_NAME = 'shengji-db';
const DB_VERSION = 1;

let dbPromise = null;

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('stages')) {
        db.createObjectStore('stages', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('expenses')) {
        const store = db.createObjectStore('expenses', { keyPath: 'id' });
        store.createIndex('stageId', 'stageId', { unique: false });
        store.createIndex('spentAt', 'spentAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('数据库被其他页面占用，请关闭其他标签页后重试'));
  });
  return dbPromise;
}

export async function getAll(storeName) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const result = await requestToPromise(tx.objectStore(storeName).getAll());
  await transactionDone(tx);
  return result;
}

export async function getRecord(storeName, key) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const result = await requestToPromise(tx.objectStore(storeName).get(key));
  await transactionDone(tx);
  return result;
}

export async function putRecord(storeName, value) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(toPlain(value));
  await transactionDone(tx);
  return value;
}

export async function putMany(storeName, values) {
  if (!values.length) return values;
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  for (const value of values) store.put(toPlain(value));
  await transactionDone(tx);
  return values;
}

export async function deleteRecord(storeName, key) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(key);
  await transactionDone(tx);
}

export async function deleteMany(storeName, keys) {
  if (!keys.length) return;
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  for (const key of keys) store.delete(key);
  await transactionDone(tx);
}

export async function getSetting(key, fallback = null) {
  const record = await getRecord('settings', key);
  return record ? record.value : fallback;
}

export async function setSetting(key, value) {
  await putRecord('settings', { key, value });
  return value;
}
