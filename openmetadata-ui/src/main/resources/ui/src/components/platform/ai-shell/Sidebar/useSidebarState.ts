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

import { useCallback, useState } from 'react';

export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'aiShell.sidebar.mainCollapsed';
export const SUB_COLLAPSED_STORAGE_KEY = 'aiShell.sidebar.submenuCollapsed';

const readPersisted = (key: string, fallback: boolean): boolean => {
  try {
    const stored = localStorage.getItem(key);

    return stored === null ? fallback : stored === 'true';
  } catch {
    return fallback;
  }
};

const persist = (key: string, value: boolean): void => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore storage errors (e.g. private mode quota)
  }
};

/**
 * Persisted collapse state for a sidebar panel. The value is read from and
 * written to `localStorage` under `storageKey` so it survives a full reload —
 * navigating (or a `page.goto` in tests) never resets an explicit expand/
 * collapse choice, matching the pre-migration AskCollate sidebar. Collapse is
 * purely user-controlled via the returned `toggle`/`set`; routing never mutates
 * it, otherwise clicking into a submenu item would rail the main nav or pop the
 * submenu open on its own.
 *
 * @param storageKey persistence key
 * @param defaultCollapsed value used when nothing is stored yet
 */
export const usePersistedCollapse = (
  storageKey: string,
  defaultCollapsed: boolean
): readonly [boolean, () => void, (value: boolean) => void] => {
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    readPersisted(storageKey, defaultCollapsed)
  );

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      persist(storageKey, next);

      return next;
    });
  }, [storageKey]);

  const set = useCallback(
    (value: boolean) => {
      setCollapsed(value);
      persist(storageKey, value);
    },
    [storageKey]
  );

  return [collapsed, toggle, set] as const;
};
