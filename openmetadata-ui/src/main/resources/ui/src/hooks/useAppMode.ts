/*
 *  Copyright 2026 Collate.
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

import { useSyncExternalStore } from 'react';
import {
  APP_MODE_CHANGE_EVENT,
  APP_MODE_STORAGE_KEY,
  DEFAULT_APP_MODE,
} from '../constants/appMode.constants';
import { isUndefined } from 'lodash';

/**
 * AppMode is a generic identifier for the active app shell. The default
 * mode reflects standard OM UI; downstream consumers (plugins, themes)
 * can introduce additional modes by registering with
 * `useAppRoutesRegistry`. The value is persisted to `localStorage` and
 * synchronised across same-tab consumers through a `window` custom
 * event; cross-tab is covered by the native `storage` event.
 *
 * Two writers are exposed: `writeAppMode(mode)` sets a mode,
 * `clearAppMode()` removes the key (resetting to default). Both
 * notify subscribers so the React hook re-renders.
 */

const readMode = (): string => {
  if (isUndefined(globalThis.window)) {
    return DEFAULT_APP_MODE;
  }

  return (
    globalThis.window.localStorage.getItem(APP_MODE_STORAGE_KEY) ??
    DEFAULT_APP_MODE
  );
};

const subscribe = (callback: () => void): (() => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === APP_MODE_STORAGE_KEY) {
      callback();
    }
  };
  const onCustom = () => callback();
  globalThis.window.addEventListener('storage', onStorage);
  globalThis.window.addEventListener(APP_MODE_CHANGE_EVENT, onCustom);

  return () => {
    globalThis.window.removeEventListener('storage', onStorage);
    globalThis.window.removeEventListener(APP_MODE_CHANGE_EVENT, onCustom);
  };
};

/**
 * React hook returning the current AppMode. Re-renders the calling
 * component whenever the mode changes (same-tab via custom event,
 * cross-tab via storage event).
 */
export const useAppMode = (): string => {
  return useSyncExternalStore(subscribe, readMode, () => DEFAULT_APP_MODE);
};

/**
 * Set the active AppMode. Writes to localStorage and notifies same-tab
 * subscribers via custom event. No-ops if the value would not change.
 */
export const writeAppMode = (mode: string): void => {
  if (isUndefined(globalThis.window)) {
    return;
  }
  if (readMode() === mode) {
    return;
  }
  globalThis.window.localStorage.setItem(APP_MODE_STORAGE_KEY, mode);
  globalThis.window.dispatchEvent(
    new CustomEvent(APP_MODE_CHANGE_EVENT, { detail: { mode } })
  );
};

/**
 * Clear any persisted AppMode override, returning to the default. Use
 * this on logout or when downgrading from a registered mode that's no
 * longer available.
 */
export const clearAppMode = (): void => {
  if (isUndefined(globalThis.window)) {
    return;
  }
  globalThis.window.localStorage.removeItem(APP_MODE_STORAGE_KEY);
  globalThis.window.dispatchEvent(
    new CustomEvent(APP_MODE_CHANGE_EVENT, {
      detail: { mode: DEFAULT_APP_MODE },
    })
  );
};
