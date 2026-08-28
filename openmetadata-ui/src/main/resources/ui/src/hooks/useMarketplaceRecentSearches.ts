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

import { get } from 'lodash';
import { useCallback, useMemo } from 'react';
import {
  MarketplaceRecentSearchEntry,
  usePersistentStorage,
} from './currentUserStore/useCurrentUserStore';
import { useApplicationStore } from './useApplicationStore';

const MAX_RECENT_SEARCHES = 5;

export const useMarketplaceRecentSearches = () => {
  const currentUser = useApplicationStore((state) => state.currentUser);
  const { preferences, setUserPreference } = usePersistentStorage();

  const recentSearches = useMemo(() => {
    if (!currentUser) {
      return [];
    }
    const entries: MarketplaceRecentSearchEntry[] = get(
      preferences,
      [currentUser.name, 'marketplaceRecentSearches'],
      []
    );

    return [...entries]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((entry) => entry.term);
  }, [currentUser, preferences]);

  const addSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed || !currentUser) {
        return;
      }

      // Read live state to avoid stale closure over preferences
      const livePrefs = usePersistentStorage.getState().preferences;
      const entries: MarketplaceRecentSearchEntry[] = get(
        livePrefs,
        [currentUser.name, 'marketplaceRecentSearches'],
        []
      );

      const filtered = entries.filter((entry) => entry.term !== trimmed);
      filtered.unshift({ term: trimmed, timestamp: Date.now() });

      if (filtered.length > MAX_RECENT_SEARCHES) {
        filtered.pop();
      }

      setUserPreference(currentUser.name, {
        marketplaceRecentSearches: filtered,
      });
    },
    [currentUser, setUserPreference]
  );

  const clearSearches = useCallback(() => {
    if (!currentUser) {
      return;
    }
    setUserPreference(currentUser.name, {
      marketplaceRecentSearches: [],
    });
  }, [currentUser, setUserPreference]);

  return { recentSearches, addSearch, clearSearches };
};
