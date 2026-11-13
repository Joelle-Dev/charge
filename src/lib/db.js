const DB_NAME = 'shengji-db';
const DB_VERSION = 3;

const EXPENSE_INDEXES = [
  ['stageId', 'stageId'],
  ['spentAt', 'spentAt'],
  ['category', 'category'],
  ['stageId_spentAt', ['stageId', 'spentAt']],
  ['stageId_category', ['stageId', 'category']]
];

let dbPromise = null;

function toPlain(value) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch (err) {
      // Vue reactive proxies cannot be structured-cloned; fall back to JSON.
    }
  }
  return JSON.parse(JSON.stringify(value));
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

function ensureIndex(store, name, keyPath) {
  if (!store.indexNames.contains(name)) {
    store.createIndex(name, keyPath, { unique: false });
  }
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let settled = false;

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('stages')) {
        db.createObjectStore('stages', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('expenses')) {
        db.createObjectStore('expenses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('stats')) {
        db.createObjectStore('stats', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('searchChunks')) {
        const chunks = db.createObjectStore('searchChunks', { keyPath: 'key' });
        chunks.createIndex('stageId', 'stageId', { unique: false });
      }

      const expenses = request.transaction.objectStore('expenses');
      for (const [name, keyPath] of EXPENSE_INDEXES) {
        ensureIndex(expenses, name, keyPath);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      if (settled) {
        db.close();
        return;
      }
      settled = true;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      settled = true;
      dbPromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      settled = true;
      dbPromise = null;
      reject(new Error('另一个页面还抱着账本，关掉它再试试吧'));
    };
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

export async function getAllByIndex(storeName, indexName, query = null) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const result = await requestToPromise(tx.objectStore(storeName).index(indexName).getAll(query));
  await transactionDone(tx);
  return result;
}

export async function getAllByRange(storeName, range) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const result = await requestToPromise(tx.objectStore(storeName).getAll(range));
  await transactionDone(tx);
  return result;
}

export async function countRange(storeName, range) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const result = await requestToPromise(tx.objectStore(storeName).count(range));
  await transactionDone(tx);
  return result;
}

export async function getMany(storeName, keys) {
  if (!keys.length) return [];
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const results = await Promise.all(keys.map((key) => requestToPromise(store.get(key))));
  await transactionDone(tx);
  return results;
}

export async function getPageByIndex(storeName, indexName, range, options = {}) {
  const { direction = 'next', limit = 100 } = options;
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const index = tx.objectStore(storeName).index(indexName);
  const records = [];
  let aborted = false;

  await new Promise((resolve, reject) => {
    const request = index.openCursor(range, direction);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      records.push(cursor.value);
      if (records.length >= limit) {
        aborted = true;
        try {
          tx.abort();
        } catch (err) {
          // The transaction may already be complete.
        }
        resolve();
        return;
      }
      cursor.continue();
    };
  });

  if (!aborted) {
    await transactionDone(tx);
  }
  return records;
}

export async function scanAll(storeName, onRecord) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  let count = 0;

  await new Promise((resolve, reject) => {
    const request = store.openCursor();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      count += 1;
      try {
        onRecord(cursor.value);
      } catch (err) {
        reject(err);
        return;
      }
      cursor.continue();
    };
  });

  await transactionDone(tx);
  return count;
}


export async function scanIndex(storeName, indexName, query, onRecord) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const index = tx.objectStore(storeName).index(indexName);
  let count = 0;

  await new Promise((resolve, reject) => {
    const request = index.openCursor(query);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      count += 1;
      try {
        onRecord(cursor.value);
      } catch (err) {
        reject(err);
        return;
      }
      cursor.continue();
    };
  });

  await transactionDone(tx);
  return count;
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

export async function deleteByIndexRange(storeName, indexName, range) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  const index = store.index(indexName);
  let deleted = 0;

  await new Promise((resolve, reject) => {
    const request = index.openCursor(range);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      deleted += 1;
      cursor.continue();
    };
  });

  await transactionDone(tx);
  return deleted;
}

export async function deleteMany(storeName, keys) {
  if (!keys.length) return;
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  for (const key of keys) store.delete(key);
  await transactionDone(tx);
}

export async function writeExpenses({ put = [], deleteIds = [], settings = [] } = {}) {
  const db = await openDB();
  const tx = db.transaction(['expenses', 'settings'], 'readwrite');
  const store = tx.objectStore('expenses');
  for (const key of deleteIds) store.delete(key);
  for (const value of put) store.put(toPlain(value));
  const settingsStore = tx.objectStore('settings');
  for (const { key, value } of settings) settingsStore.put({ key, value: toPlain(value) });
  await transactionDone(tx);
}

export async function clearStores(storeNames) {
  const db = await openDB();
  const tx = db.transaction(storeNames, 'readwrite');
  for (const storeName of storeNames) tx.objectStore(storeName).clear();
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
