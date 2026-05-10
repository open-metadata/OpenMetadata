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
 * a fresh fetch on the next activation).
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

  // Reset the once-flag when any reset dep changes — typically when the user navigates to
  // a different entity, even if the tab id is the same. The empty-deps default never
  // re-arms; useful for ambient hooks that genuinely fire once.
  useEffect(() => {
    fetchedRef.current = false;
  }, resetDeps);

  useEffect(() => {
    if (activeTab !== tabKey || fetchedRef.current) {
      return;
    }
    fetchedRef.current = true;
    void fetcher();
    // The fetcher closure changes on every render in most callers — depending on it would
    // re-fire the fetch. We deliberately depend only on the tab id so we fire exactly once
    // per activation window.
  }, [activeTab, tabKey]);
}
