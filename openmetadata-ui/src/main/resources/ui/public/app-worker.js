/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

const DB_NAME = 'AppDataStore';
const STORE_NAME = 'keyValueStore';
const DB_VERSION = 1;

const swStore = {};

// Pre-load data from IndexedDB when service worker starts
let isInitialized = false;

// IndexedDB helper functions
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function saveToIndexedDB(key, value) {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function loadFromIndexedDB(key) {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteFromIndexedDB(key) {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function initializeSwStore() {
  if (isInitialized) {
    return;
  }

  try {
    const stored = await loadFromIndexedDB('app_state');

    if (stored !== undefined && stored !== null) {
      swStore['app_state'] = stored;
    }
    isInitialized = true;
  } catch (error) {
    isInitialized = true;
  }
}

// Service worker event listeners
self.addEventListener('install', (event) => {
  // Force the service worker to skip the waiting phase and immediately activate
  // This ensures the new service worker takes control without waiting for all tabs to close
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // Claim control immediately after activation
  event.waitUntil(
    self.clients.claim().then(() => {
      // Initialize the store to ensure it's ready for use
      return initializeSwStore();
    })
  );
});

self.addEventListener('message', async (event) => {
  // Handle SKIP_WAITING message to force immediate control
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    try {
      await self.clients.claim();
    } catch {
      // No need to handle this error as it will be handled by the controller
    }

    return;
  }

  const { type, key, value, requestId } = event.data;
  let result = null;
  let error = null;

  try {
    switch (type) {
      // This is used to check if the service worker is ready to be used
      case 'ping':
        result = { ready: isInitialized, timestamp: Date.now() };

        break;

      case 'set':
        swStore[key] = value;
        await saveToIndexedDB(key, value);

        if (key === 'app_state') {
          try {
            const appState = JSON.parse(value || '{}');
            // Check if tokens are present or have been cleared
            if (appState.primary || appState.secondary) {
              // Broadcast the token update to all clients
              self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                  client.postMessage({
                    type: 'TOKEN_UPDATE',
                    key,
                    timestamp: Date.now(),
                  });
                });
              });
            } else {
              // If tokens are not present, clear the store and broadcast the token cleared event to all clients
              delete swStore[key];
              self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                  client.postMessage({
                    type: 'TOKEN_CLEARED',
                    key,
                    timestamp: Date.now(),
                  });
                });
              });
            }
          } catch {
            // If parsing fails, don't broadcast to avoid issues
          }
        }

        break;

      case 'get':
        // If the store is not initialized, initialize it
        if (!isInitialized) {
          await initializeSwStore();
        }

        // If the key is not in the store, load it from IndexedDB
        if (!(key in swStore)) {
          const stored = await loadFromIndexedDB(key);
          if (stored !== undefined) {
            swStore[key] = stored;
          }
        }

        result = swStore[key] ?? null;

        if (key === 'app_state' && result) {
          try {
            const appState = JSON.parse(result);
            if (!appState.primary && !appState.secondary) {
              result = '{}';
            }
          } catch {
            result = '{}';
          }
        }

        break;

      case 'delete':
      case 'remove': {
        // Delete the key from the store and IndexedDB
        const oldValue = swStore[key] ?? null;
        delete swStore[key];
        await deleteFromIndexedDB(key);
        result = oldValue;

        break;
      }

      case 'getAllKeys': {
        // If the store is not initialized, initialize it
        if (!isInitialized) {
          await initializeSwStore();
        }
        // Get all keys from swStore and also from IndexedDB to ensure completeness
        const allKeys = new Set(Object.keys(swStore));
        try {
          const db = await openDB();
          const transaction = db.transaction([STORE_NAME], 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.getAllKeys();
          const dbKeys = await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          dbKeys.forEach((key) => allKeys.add(key));
        } catch {
          // If IndexedDB fails, swStore keys will be used
        }
        result = Array.from(allKeys);

        break;
      }

      default:
        error = 'Unknown operation type';
    }
  } catch (err) {
    error = err.message || 'Service Worker operation failed';
  }

  event.ports[0].postMessage({ result, error, requestId });
});
