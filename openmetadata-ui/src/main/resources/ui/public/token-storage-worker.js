/*
 *  Copyright 2022 Collate.
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

const swStore = {};

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', async (event) => {
  const { type, key, value, requestId } = event.data;
  let result = null;

  switch (type) {
    case 'set':
      swStore[key] = value;
      await saveToIndexedDB(key, value);

      break;

    case 'get':
      if (!(key in swStore)) {
        const stored = await loadFromIndexedDB(key);
        if (stored !== undefined) {
          swStore[key] = stored;
        }
      }
      result = swStore[key] ?? null;

      break;

    case 'remove':
      result = swStore[key] ?? null;
      delete swStore[key];
      await removeFromIndexedDB(key);

      break;

    case 'getAllKeys':
      result = Object.keys(swStore);

      break;
  }

  event.ports[0].postMessage({ result, requestId });
});

// ------------------- IndexedDB Helpers -------------------
const DB_NAME = 'SWTokenStore';
const DB_STORE = 'tokens';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveToIndexedDB(key, value) {
  const db = await openDB();
  const tx = db.transaction(DB_STORE, 'readwrite');
  tx.objectStore(DB_STORE).put(value, key);
  tx.oncomplete = () => db.close();
  tx.onerror = () => db.close();
}

async function loadFromIndexedDB(key) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const request = tx.objectStore(DB_STORE).get(key);
    request.onsuccess = () => {
      resolve(request.result);
      db.close();
    };
    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
}

async function removeFromIndexedDB(key) {
  const db = await openDB();
  const tx = db.transaction(DB_STORE, 'readwrite');
  tx.objectStore(DB_STORE).delete(key);
  tx.oncomplete = () => db.close();
  tx.onerror = () => db.close();
}
