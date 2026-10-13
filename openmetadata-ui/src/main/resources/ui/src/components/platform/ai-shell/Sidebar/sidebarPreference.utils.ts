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

import {
  SIDEBAR_COLLAPSED_EVENT,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
} from './appModeSidebar.constants';

const readPersisted = (key: string): boolean | null => {
  try {
    const stored = localStorage.getItem(key);

    return stored === null ? null : stored === 'true';
  } catch {
    return null;
  }
};

export const persistSidebarPreference = (key: string, value: boolean): void => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore storage errors (e.g. private mode quota)
  }
};

/**
 * The "compact sidebar" preference: the top-level main nav starts as the icon
 * rail. Defaults to expanded.
 */
export const readCompactSidebarPreference = (): boolean =>
  readPersisted(SIDEBAR_COLLAPSED_STORAGE_KEY) ?? false;

/**
 * Sets the compact sidebar preference from outside the sidebar (e.g. the
 * Preferences page); a mounted sidebar applies it straight away.
 */
export const setCompactSidebarPreference = (compact: boolean): void => {
  persistSidebarPreference(SIDEBAR_COLLAPSED_STORAGE_KEY, compact);
  globalThis.dispatchEvent(
    new CustomEvent<boolean>(SIDEBAR_COLLAPSED_EVENT, { detail: compact })
  );
};
