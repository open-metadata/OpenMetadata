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

import { Page } from '@playwright/test';

export const DB_NAME = 'AppDataStore';
export const STORE_NAME = 'keyValueStore';
export const APP_STATE_KEY = 'app_state';
export const OIDC_TOKEN_KEY = 'primary';

/**
 * Execute token storage operations in browser context.
 *
 * @param page - Playwright page instance
 * @param operation - The operation to perform ('get' or 'set')
 * @param token - The token to set (only required for 'set' operation)
 * @returns Promise resolving to token string for 'get', void for 'set'
 */
const executeTokenOperation = async (
  page: Page,
  operation: 'get' | 'set',
  token?: string
): Promise<string | void> => {
  return page.evaluate(
    async ({
      dbName,
      storeName,
      appStateKey,
      oidcTokenKey,
      operation,
      token,
    }) => {
      const isServiceWorkerAvailable = (): boolean => {
        return 'serviceWorker' in navigator && 'indexedDB' in window;
      };

      const getFromIndexedDB = async (key: string): Promise<string | null> => {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(dbName, 1);

          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const getRequest = store.get(key);

            getRequest.onsuccess = () => {
              resolve(getRequest.result || null);
            };

            getRequest.onerror = () => {
              reject(getRequest.error);
            };
          };

          request.onerror = () => {
            reject(request.error);
          };

          // Handle case where database doesn't exist yet
          request.onupgradeneeded = () => {
            resolve(null);
          };
        });
      };

      const saveToIndexedDB = async (
        key: string,
        value: string
      ): Promise<void> => {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(dbName, 1);

          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const putRequest = store.put(value, key);

            putRequest.onsuccess = () => {
              transaction.oncomplete = () => {
                resolve();
              };

              transaction.onerror = () => {
                reject(transaction.error);
              };
            };

            putRequest.onerror = () => {
              reject(putRequest.error);
            };
          };

          request.onerror = () => {
            reject(request.error);
          };

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(storeName)) {
              db.createObjectStore(storeName);
            }
          };
        });
      };

      const getAppState = async (): Promise<Record<string, unknown>> => {
        try {
          if (isServiceWorkerAvailable()) {
            try {
              const stateStr = await getFromIndexedDB(appStateKey);

              return stateStr ? JSON.parse(stateStr) : {};
            } catch {
              return {};
            }
          } else {
            // Browser doesn't support SW/IndexedDB, use localStorage fallback
            const stateStr = localStorage.getItem(appStateKey);

            return stateStr ? JSON.parse(stateStr) : {};
          }
        } catch {
          return {};
        }
      };

      const setAppState = async (
        state: Record<string, unknown>
      ): Promise<void> => {
        const stateStr = JSON.stringify(state);
        if (isServiceWorkerAvailable()) {
          try {
            // Try IndexedDB first (same storage as service worker)
            await saveToIndexedDB(appStateKey, stateStr);
          } catch {
            // Fail silently, the auth flow will reflect the failure
          }
        } else {
          // Fallback for browsers that don't support SW/IndexedDB
          localStorage.setItem(appStateKey, stateStr);
        }
      };

      const getOidcToken = async (): Promise<string> => {
        try {
          const state = await getAppState();

          return (state[oidcTokenKey] as string) || '';
        } catch {
          return '';
        }
      };

      const setOidcToken = async (token: string): Promise<void> => {
        const currentState = await getAppState();

        currentState[oidcTokenKey] = token;
        await setAppState(currentState);
      };

      if (operation === 'get') {
        return await getOidcToken();
      }

      if (operation === 'set' && token !== undefined) {
        await setOidcToken(token);
      }

      return;
    },
    {
      dbName: DB_NAME,
      storeName: STORE_NAME,
      appStateKey: APP_STATE_KEY,
      oidcTokenKey: OIDC_TOKEN_KEY,
      operation,
      token,
    }
  );
};

export const getToken = async (page: Page): Promise<string> => {
  return (await executeTokenOperation(page, 'get')) as string;
};

/**
 * Replace the stored session token.
 *
 * The write has to go through the service worker, not straight into IndexedDB. `app-worker.js`
 * keeps an in-memory `swStore` and only falls back to IndexedDB when the key is *absent* from it,
 * so once the app has read `app_state` (i.e. after login) a direct IndexedDB write is invisible —
 * the worker keeps handing the old token to `getOidcToken()`. Writing through the worker updates
 * both its cache and IndexedDB, and is exactly what the app itself does.
 *
 * Falls back to the direct IndexedDB write when no worker is controlling the page, or when the
 * worker exchange fails — hence the catch: an unhandled rejection here would abandon the write
 * rather than fall through.
 */
export const setToken = async (page: Page, token: string): Promise<void> => {
  const wroteViaServiceWorker = await page.evaluate(
    async ({ appStateKey, oidcTokenKey, token }) => {
      const controller = navigator.serviceWorker?.controller;

      if (!controller) {
        return false;
      }

      const request = (message: Record<string, unknown>): Promise<unknown> =>
        new Promise((resolve, reject) => {
          const channel = new MessageChannel();
          const timer = setTimeout(
            () => reject(new Error('Service worker did not respond')),
            10000
          );
          channel.port1.onmessage = (event) => {
            clearTimeout(timer);
            resolve(event.data?.result ?? null);
          };
          controller.postMessage(message, [channel.port2]);
        });

      try {
        const current = (await request({
          type: 'get',
          key: appStateKey,
        })) as string | null;
        const state = current ? JSON.parse(current) : {};
        state[oidcTokenKey] = token;

        await request({
          type: 'set',
          key: appStateKey,
          value: JSON.stringify(state),
        });

        return true;
      } catch {
        return false;
      }
    },
    { appStateKey: APP_STATE_KEY, oidcTokenKey: OIDC_TOKEN_KEY, token }
  );

  if (!wroteViaServiceWorker) {
    await executeTokenOperation(page, 'set', token);
  }
};
