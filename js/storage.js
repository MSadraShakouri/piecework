const SETTINGS_KEY = 'piecework.settings';
const STATS_KEY = 'piecework.stats';
const DATABASE_NAME = 'piecework-db';
const STORE_NAME = 'saves';
const CURRENT_PUZZLE_KEY = 'current';

function parseObject(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function createStorage({
  indexedDBRef = globalThis.indexedDB,
  localStorageRef = globalThis.localStorage,
} = {}) {
  function withStore(mode, operation) {
    return new Promise((resolve, reject) => {
      if (!indexedDBRef) {
        reject(new Error('IndexedDB is not available'));
        return;
      }

      const request = indexedDBRef.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction(STORE_NAME, mode);
        const storeRequest = operation(transaction.objectStore(STORE_NAME));
        storeRequest.onsuccess = () => resolve(storeRequest.result);
        storeRequest.onerror = () => reject(storeRequest.error);
      };
    });
  }

  function getCurrent() {
    return withStore('readonly', store => store.get(CURRENT_PUZZLE_KEY)).catch(() => null);
  }

  function putCurrent(value) {
    return withStore('readwrite', store => store.put(value, CURRENT_PUZZLE_KEY)).catch(() => undefined);
  }

  function deleteCurrent() {
    return withStore('readwrite', store => store.delete(CURRENT_PUZZLE_KEY)).catch(() => undefined);
  }

  function loadSettings() {
    if (!localStorageRef) return {};
    return parseObject(localStorageRef.getItem(SETTINGS_KEY) || '{}', {});
  }

  function saveSettings(settings) {
    if (!localStorageRef) return;
    localStorageRef.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function loadStats() {
    if (!localStorageRef) return { solved: 0, seconds: 0 };
    return parseObject(localStorageRef.getItem(STATS_KEY) || '{"solved":0,"seconds":0}', {
      solved: 0,
      seconds: 0,
    });
  }

  function saveStats(stats) {
    if (!localStorageRef) return;
    localStorageRef.setItem(STATS_KEY, JSON.stringify(stats));
  }

  return {
    getCurrent,
    putCurrent,
    deleteCurrent,
    loadSettings,
    saveSettings,
    loadStats,
    saveStats,
  };
}

export const storageKeys = Object.freeze({
  settings: SETTINGS_KEY,
  stats: STATS_KEY,
  database: DATABASE_NAME,
  store: STORE_NAME,
  currentPuzzle: CURRENT_PUZZLE_KEY,
});
