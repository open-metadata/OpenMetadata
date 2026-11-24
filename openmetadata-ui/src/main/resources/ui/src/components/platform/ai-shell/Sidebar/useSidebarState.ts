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

import { useCallback, useEffect, useRef, useState } from 'react';
import { SIDEBAR_COLLAPSED_EVENT } from './appModeSidebar.constants';
import { readCompactSidebarPreference } from './sidebarPreference.utils';

/**
 * Main-nav collapse state, with context-dependent precedence:
 *
 *  - Top level (no sub-nav): the main nav starts from the compact-sidebar
 *    preference. The user may collapse/expand it, but only the Preferences
 *    toggle writes the preference; a manual toggle is transient and resets
 *    when the active sub-context changes or on reload.
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

  // Seeded from the preference, meaningful only at the top level.
  const [topLevelCollapsed, setTopLevelCollapsed] = useState<boolean>(
    readCompactSidebarPreference
  );

  // Transient main-nav expand *inside* a sub-context — never persisted.
  const [subExpanded, setSubExpanded] = useState(false);

  useEffect(() => {
    const onPreferenceChange = (event: Event) => {
      setTopLevelCollapsed(Boolean((event as CustomEvent<boolean>).detail));
      // Inside a sub-context the preference drives the submenu
      // (`useSubCollapse`), so the main nav goes back to its rail; leaving a
      // transient expand would show both full panels.
      setSubExpanded(false);
    };
    globalThis.addEventListener(SIDEBAR_COLLAPSED_EVENT, onPreferenceChange);

    return () =>
      globalThis.removeEventListener(
        SIDEBAR_COLLAPSED_EVENT,
        onPreferenceChange
      );
  }, []);

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
    setTopLevelCollapsed(readCompactSidebarPreference());
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
    setTopLevelCollapsed((prev) => !prev);
  }, []);

  const set = useCallback((value: boolean) => {
    if (inSubModeRef.current) {
      setSubExpanded(!value);

      return;
    }
    setTopLevelCollapsed(value);
  }, []);

  return [collapsed, toggle, set] as const;
};

/**
 * Submenu collapse. The compact-sidebar preference decides how a sub-context
 * opens: compact → the submenu starts on its icon rail (both navs railed),
 * otherwise it starts expanded. A user toggle is transient — never persisted —
 * and is dropped when the active sub-context changes or on reload. Changing the
 * preference (e.g. from the Preferences page) applies straight away.
 *
 * @param contextKey identifies the active sub-context; a change re-derives the
 *   collapse state from the preference
 */
export const useSubCollapse = (
  contextKey: string | null
): readonly [boolean, (value: boolean) => void, () => void] => {
  const [subCollapsed, setSubCollapsed] = useState<boolean>(
    readCompactSidebarPreference
  );

  // Re-derived during render, like `useMainCollapse`'s context reset, so a new
  // sub-context never paints one frame in the previous submenu state.
  const [prevContext, setPrevContext] = useState(contextKey);
  if (prevContext !== contextKey) {
    setPrevContext(contextKey);
    setSubCollapsed(readCompactSidebarPreference());
  }

  useEffect(() => {
    const onPreferenceChange = (event: Event) =>
      setSubCollapsed(Boolean((event as CustomEvent<boolean>).detail));
    globalThis.addEventListener(SIDEBAR_COLLAPSED_EVENT, onPreferenceChange);

    return () =>
      globalThis.removeEventListener(
        SIDEBAR_COLLAPSED_EVENT,
        onPreferenceChange
      );
  }, []);

  const toggle = useCallback(() => setSubCollapsed((prev) => !prev), []);

  return [subCollapsed, setSubCollapsed, toggle] as const;
};
