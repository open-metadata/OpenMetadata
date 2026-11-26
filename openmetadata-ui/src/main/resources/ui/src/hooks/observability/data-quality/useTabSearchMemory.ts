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
import { useCallback, useEffect, useRef } from 'react';

/**
 * Remembers each tab's latest URL search so a tab switch can restore it.
 *
 * Tab panels that unmount on switch keep their filters only in the query
 * string. Navigating to a bare tab path drops them, while a data provider
 * refetches without the filters the user still sees selected, so summary
 * counts diverge from the listing (ADR:2026-10-29-data-quality-tab-switches-restore-each-tabs-own-query-string).
 *
 * @param isRecording false while another route owns the URL. App mode keeps
 * visited pages mounted, and that route's search is not this page's.
 * @returns the last search recorded for a tab, or '' if it was never visited,
 * so filters never carry from one tab to another.
 */
export const useTabSearchMemory = <T extends string>(
  activeTab: T,
  search: string,
  isRecording = true
) => {
  const searchByTab = useRef<Partial<Record<T, string>>>({});

  // Recorded from the URL rather than in the tab handler: browser back/forward
  // and deep links also move it, and restoring a stale entry would re-apply
  // filters the user has since moved away from.
  useEffect(() => {
    if (isRecording) {
      searchByTab.current[activeTab] = search;
    }
  }, [activeTab, isRecording, search]);

  return useCallback((tab: T) => searchByTab.current[tab] ?? '', []);
};
