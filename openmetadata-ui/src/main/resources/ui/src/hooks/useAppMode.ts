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

import { isUndefined } from 'lodash';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  APP_MODE_STORAGE_KEY,
  DEFAULT_APP_MODE,
} from '../constants/appMode.constants';

interface AppModeStore {
  currentMode: string;
  setMode: (mode: string) => void;
  reset: () => void;
}

export const useAppModeStore = create<AppModeStore>()(
  persist(
    (set) => ({
      currentMode: DEFAULT_APP_MODE,
      setMode: (mode) => set({ currentMode: mode }),
      reset: () => set({ currentMode: DEFAULT_APP_MODE }),
    }),
    {
      name: APP_MODE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Cross-tab sync: persist middleware writes localStorage but doesn't
// listen for changes from other tabs. Re-hydrate when another tab edits
// the same key so all tabs converge on the new mode. The listener's
// natural scope is the page lifetime, so we never remove it; the flag
// prevents duplicate registrations if the module re-executes (HMR /
// `jest.resetModules`).
let storageListenerRegistered = false;

if (!isUndefined(globalThis.window) && !storageListenerRegistered) {
  storageListenerRegistered = true;
  globalThis.window.addEventListener('storage', (event) => {
    if (event.key === APP_MODE_STORAGE_KEY) {
      void useAppModeStore.persist.rehydrate();
    }
  });
}

export const useAppMode = (): string =>
  useAppModeStore((state) => state.currentMode);

export const writeAppMode = (mode: string): void =>
  useAppModeStore.getState().setMode(mode);

export const clearAppMode = (): void => useAppModeStore.getState().reset();
