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

import { useEffect, useRef } from 'react';

/**
 * Fire {@code fetcher} the first time {@code activeTab} matches {@code tabKey}, and never
 * again unless one of the {@code resetDeps} changes (in which case the hook arms itself for
 * a fresh fetch on the next activation — or fires immediately if the gated tab is already
 * the active one).
 *
 * Use case: tabs whose data drives a count badge (e.g. Queries (5), Tests (2)) AND whose
 * fetch is independent of the entity-detail render. Most users never click these tabs, so
 * eagerly fetching them on page load wastes a server round-trip per page view. Deferring
 * the fetch until first activation moves the cost off the critical path.
 *
 * Caveat: the badge count won't appear before the user activates the tab. Render the tab
 * label without the count until the fetch resolves; the count populates from the consumer's
 * own state once the fetcher resolves.
 *
 * Re-arm semantics: when any {@code resetDeps} entry changes (typically the entity FQN), the
 * hook treats the situation as "new entity, stale data". If the user is already on the gated
 * tab when that change happens, we fire {@code fetcher} immediately rather than waiting for
 * a tab toggle the user has no reason to do — otherwise the badge would show the previous
 * entity's count until something forced a re-activation.
 *
 * @param tabKey         The tab id this hook is gated on (e.g. 'queries').
 * @param activeTab      The currently-active tab id, typically from the URL or page state.
 * @param fetcher        Async function to run on first activation. Errors are swallowed by
 *                       the caller's own try/catch — this hook just fires it.
 * @param resetDeps      Dependencies that should reset the "already fetched" flag. Typically
 *                       includes the entity FQN so navigating to a different entity re-arms.
 */
export function useDeferredTabData(
  tabKey: string,
  activeTab: string | undefined,
  fetcher: () => void | Promise<void>,
  resetDeps: ReadonlyArray<unknown> = []
): void {
  const fetchedRef = useRef(false);
  // Latest-fetcher ref so the resetDeps effect (which deliberately doesn't depend on
  // {@code fetcher}) always calls the closure with up-to-date scope (e.g. tableFqn captured
  // by the consumer).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Reset the once-flag when any reset dep changes — typically when the user navigates to
  // a different entity, even if the tab id is the same. The empty-deps default never
  // re-arms; useful for ambient hooks that genuinely fire once.
  //
  // If the gated tab is the currently-active tab at reset time, fire immediately so the
  // badge updates for the new entity without waiting for a tab toggle. We set the flag to
  // true *before* firing so the activation effect below doesn't double-fire on the same
  // render cycle.
  useEffect(() => {
    fetchedRef.current = false;
    if (activeTab === tabKey) {
      fetchedRef.current = true;
      void fetcherRef.current();
    }
    // `activeTab` and `tabKey` are read above but the intent is to fire only on resetDeps
    // changes — including them in deps would cause every tab switch to also reset, which
    // is the opposite of what we want.
  }, resetDeps);

  useEffect(() => {
    if (activeTab !== tabKey || fetchedRef.current) {
      return;
    }
    fetchedRef.current = true;
    void fetcherRef.current();
    // The fetcher closure changes on every render in most callers — depending on it would
    // re-fire the fetch. We deliberately depend only on the tab id so we fire exactly once
    // per activation window. `fetcherRef` keeps the latest closure available.
  }, [activeTab, tabKey]);
}
