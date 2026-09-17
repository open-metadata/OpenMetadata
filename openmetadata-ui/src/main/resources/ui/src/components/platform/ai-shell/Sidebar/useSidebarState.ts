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

import { useCallback, useRef, useState } from 'react';

export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'aiShell.sidebar.mainCollapsed';

const readPersisted = (key: string): boolean | null => {
  try {
    const stored = localStorage.getItem(key);

    return stored === null ? null : stored === 'true';
  } catch {
    return null;
  }
};

const persist = (key: string, value: boolean): void => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore storage errors (e.g. private mode quota)
  }
};

// Top-level main-nav collapse preference, defaulting to expanded.
const readTopLevelDefault = (): boolean =>
  readPersisted(SIDEBAR_COLLAPSED_STORAGE_KEY) ?? false;

/**
 * Main-nav collapse state, with context-dependent precedence:
 *
 *  - Top level (no sub-nav): the persisted user preference wins — the user can
 *    collapse/expand the main nav and it is remembered in `localStorage`.
 *  - Inside a sub-context: the main nav ALWAYS starts collapsed (the icon rail);
 *    the persisted preference does NOT keep it expanded. The user may expand it
 *    transiently, but that is never persisted and re-collapses when the active
 *    sub-context changes or on reload — main preference does not win here.
 *
 * @param inSubMode whether the active module renders a sub-nav
 * @param contextKey identifies the active sub-context; a change re-derives the
 *   collapse state (re-railing the main nav)
 */
export const useMainCollapse = (
  inSubMode: boolean,
  contextKey: string | null
): readonly [boolean, () => void, (value: boolean) => void] => {
  const inSubModeRef = useRef(inSubMode);
  inSubModeRef.current = inSubMode;

  const [collapsed, setCollapsed] = useState<boolean>(() =>
    inSubMode ? true : readTopLevelDefault()
  );

  // Re-derive synchronously (during render, not in an effect) when entering/
  // leaving a sub-context or switching between sub-contexts, so the main nav
  // rails in the same commit the sub-panel appears — an effect would run after
  // paint and briefly show both full panels. This is React's supported
  // "adjust state when a prop changes" pattern; the ref-guarded setCollapsed
  // fires only on an actual context change, so within a context an explicit
  // toggle is preserved.
  const prevContextRef = useRef({ inSubMode, contextKey });
  if (
    prevContextRef.current.inSubMode !== inSubMode ||
    prevContextRef.current.contextKey !== contextKey
  ) {
    prevContextRef.current = { inSubMode, contextKey };
    setCollapsed(inSubMode ? true : readTopLevelDefault());
  }

  // Persist only at the top level; a sub-context toggle stays transient.
  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (!inSubModeRef.current) {
        persist(SIDEBAR_COLLAPSED_STORAGE_KEY, next);
      }

      return next;
    });
  }, []);

  const set = useCallback((value: boolean) => {
    setCollapsed(value);
    if (!inSubModeRef.current) {
      persist(SIDEBAR_COLLAPSED_STORAGE_KEY, value);
    }
  }, []);

  return [collapsed, toggle, set] as const;
};
