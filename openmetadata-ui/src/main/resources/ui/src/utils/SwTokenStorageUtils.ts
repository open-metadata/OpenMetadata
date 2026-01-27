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

import { swTokenStorage } from './SwTokenStorage';

// Internal keys for the AppState JSON - obscured for security
const APP_STATE_KEY = 'app_state';
const OIDC_TOKEN_KEY = 'primary';
const REFRESH_TOKEN_KEY = 'secondary';

interface AppState {
  [OIDC_TOKEN_KEY]?: string;
  [REFRESH_TOKEN_KEY]?: string;
}

export const isServiceWorkerAvailable = (): boolean => {
  return 'serviceWorker' in navigator && 'indexedDB' in window;
};

const getAppState = async (): Promise<AppState> => {
  try {
    if (isServiceWorkerAvailable()) {
      try {
        const stateStr = await swTokenStorage.getItem(APP_STATE_KEY);

        return stateStr ? JSON.parse(stateStr) : {};
      } catch {
        // Service worker not ready - return empty instead of localStorage fallback.
        // SECURITY: This prevents restoration of tokens from localStorage after logout,
        // ensuring that tokens deleted during logout cannot be inadvertently restored.
        return {};
      }
    } else {
      // Browser doesn't support SW/IndexedDB, use localStorage fallback
      const stateStr = localStorage.getItem(APP_STATE_KEY);

      return stateStr ? JSON.parse(stateStr) : {};
    }
  } catch {
    return {};
  }
};

const setAppState = async (state: AppState): Promise<void> => {
  try {
    const stateStr = JSON.stringify(state);
    if (isServiceWorkerAvailable()) {
      await swTokenStorage.setItem(APP_STATE_KEY, stateStr);
    } else {
      // Fallback for browsers that don't support SW/IndexedDB
      localStorage.setItem(APP_STATE_KEY, stateStr);
    }
  } catch {
    // Storage failures are intentionally ignored to prevent auth flows from breaking.
    // Token persistence is treated as "best effort" - if storage fails, the user
    // may need to re-authenticate, but core functionality continues working.
  }
};

const clearAppState = async (): Promise<void> => {
  try {
    if (isServiceWorkerAvailable()) {
      await swTokenStorage.removeItem(APP_STATE_KEY);
    } else {
      // Fallback for browsers that don't support SW/IndexedDB
      localStorage.removeItem(APP_STATE_KEY);
    }
  } catch {
    // Storage failures are intentionally ignored to prevent auth flows from breaking.
    // Token persistence is treated as "best effort" - if storage fails, the user
    // may need to re-authenticate, but core functionality continues working.
  }
};

export const getOidcToken = async (): Promise<string> => {
  try {
    const state = await getAppState();

    return state[OIDC_TOKEN_KEY] || '';
  } catch {
    return '';
  }
};

export const setOidcToken = async (token: string): Promise<void> => {
  try {
    const state = await getAppState();
    state[OIDC_TOKEN_KEY] = token;
    await setAppState(state);
  } catch {
    // Storage failures are intentionally ignored to prevent auth flows from breaking.
    // Token persistence is treated as "best effort" - if storage fails, the user
    // may need to re-authenticate, but core functionality continues working.
  }
};

export const getRefreshToken = async (): Promise<string> => {
  try {
    const state = await getAppState();

    return state[REFRESH_TOKEN_KEY] || '';
  } catch {
    return '';
  }
};

export const setRefreshToken = async (token: string): Promise<void> => {
  try {
    const state = await getAppState();
    state[REFRESH_TOKEN_KEY] = token;
    await setAppState(state);
  } catch {
    // Storage failures are intentionally ignored to prevent auth flows from breaking.
    // Token persistence is treated as "best effort" - if storage fails, the user
    // may need to re-authenticate, but core functionality continues working.
  }
};

export const clearOidcToken = async (): Promise<void> => {
  try {
    await clearAppState();
  } catch {
    // Storage failures are intentionally ignored to prevent auth flows from breaking.
    // Token persistence is treated as "best effort" - if storage fails, the user
    // may need to re-authenticate, but core functionality continues working.
  }
};
