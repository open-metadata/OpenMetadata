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

import { useSyncExternalStore } from 'react';
import {
  APP_MODE_CHANGE_EVENT,
  APP_MODE_STORAGE_KEY,
  DEFAULT_APP_MODE,
} from '../constants/appMode.constants';

/**
 * AppMode is a generic identifier for the active app shell. The default
 * mode reflects standard OM/Collate UI; plugins or themes can introduce
 * additional modes by registering with `useAppModeRegistry`. The value is
 * persisted to `localStorage` and synchronised across same-tab consumers
 * through a `window` custom event; cross-tab is covered by the native
 * `storage` event.
 */

export type AppMode = string;

const readMode = (): AppMode => {
  if (typeof window === 'undefined') {
    return DEFAULT_APP_MODE;
  }

  return window.localStorage.getItem(APP_MODE_STORAGE_KEY) ?? DEFAULT_APP_MODE;
};

const subscribe = (callback: () => void): (() => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === APP_MODE_STORAGE_KEY) {
      callback();
    }
  };
  const onCustom = () => callback();
  window.addEventListener('storage', onStorage);
  window.addEventListener(APP_MODE_CHANGE_EVENT, onCustom);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(APP_MODE_CHANGE_EVENT, onCustom);
  };
};

export const useAppMode = (): AppMode => {
  return useSyncExternalStore(subscribe, readMode, () => DEFAULT_APP_MODE);
};

export const writeAppMode = (mode: AppMode): void => {
  if (typeof window === 'undefined') {
    return;
  }
  if (readMode() === mode) {
    return;
  }
  window.localStorage.setItem(APP_MODE_STORAGE_KEY, mode);
  window.dispatchEvent(
    new CustomEvent(APP_MODE_CHANGE_EVENT, { detail: { mode } })
  );
};

export const clearAppMode = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(APP_MODE_STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent(APP_MODE_CHANGE_EVENT, {
      detail: { mode: DEFAULT_APP_MODE },
    })
  );
};
