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

  // Persisted preference, meaningful only at the top level.
  const [topLevelCollapsed, setTopLevelCollapsed] =
    useState<boolean>(readTopLevelDefault);

  // Transient main-nav expand *inside* a sub-context — never persisted.
  const [subExpanded, setSubExpanded] = useState(false);

  // Re-rail the main nav (drop any transient expand) whenever the sub-context
  // changes, synchronously during render so it lands in the same commit the new
  // context does. The "previous context" marker MUST be state, not a ref: a ref
  // mutation persists across a discarded/interrupted render while the paired
  // `setSubExpanded(false)` is dropped, which would skip the reset and leave the
  // main nav un-railed with the sub-panel open (both expanded → main hidden).
  // This is React's documented "adjust state when a prop changes" pattern.
  const [prevContext, setPrevContext] = useState({ inSubMode, contextKey });
  if (
    prevContext.inSubMode !== inSubMode ||
    prevContext.contextKey !== contextKey
  ) {
    setPrevContext({ inSubMode, contextKey });
    setSubExpanded(false);
  }

  // Derived, not transition-reset: a sub-context always rails the main nav
  // (unless the user transiently expanded it), the top level follows the
  // persisted preference. Deriving it means entering a sub-context rails the
  // main nav on the very first render — no race with async module sync, and no
  // frame showing both full panels.
  const collapsed = inSubMode ? !subExpanded : topLevelCollapsed;

  const toggle = useCallback(() => {
    if (inSubModeRef.current) {
      setSubExpanded((prev) => !prev);

      return;
    }
    setTopLevelCollapsed((prev) => {
      const next = !prev;
      persist(SIDEBAR_COLLAPSED_STORAGE_KEY, next);

      return next;
    });
  }, []);

  const set = useCallback((value: boolean) => {
    if (inSubModeRef.current) {
      setSubExpanded(!value);

      return;
    }
    setTopLevelCollapsed(value);
    persist(SIDEBAR_COLLAPSED_STORAGE_KEY, value);
  }, []);

  return [collapsed, toggle, set] as const;
};
