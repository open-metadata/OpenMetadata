/*
 *  Copyright 2025 Collate.
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

import { Box } from '@openmetadata/ui-core-components';
import { debounce } from 'lodash';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HeaderShell from '../../../../components/common/HeaderShell/HeaderShell.component';
import { SearchIndex } from '../../../../enums/search.enum';
import { useCurrentUserPreferences } from '../../../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useSearchStore } from '../../../../hooks/useSearchStore';
import { searchQuery } from '../../../../rest/searchAPI';
import { addToRecentSearched } from '../../../../utils/RecentActivityUtils';
import { getExplorePath } from '../../../../utils/RouterUtils';
import searchClassBase from '../../../../utils/SearchClassBase';
import { ExploreQuickFilters } from './ExploreQuickFilters';
import type { QuickFilter } from './ExploreQuickFilters.interface';
import { ExploreSearchCardInfo } from './ExploreSearchCardInfo';
import { ExploreSearchInput } from './ExploreSearchInput';

export const ExploreSearchCard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchCriteria = useApplicationStore((state) => state.searchCriteria);
  const currentUser = useApplicationStore((state) => state.currentUser);
  const { initNLP, isNLPActive, isNLPEnabled, setNLPActive } = useSearchStore();
  const {
    preferences: { isNLPActive: persistedNLPActive },
    setPreference,
  } = useCurrentUserPreferences();
  const searchContainerRef = useRef<HTMLFormElement>(null);
  // Keep the AI search input aligned with the Explore URL so entity-type tab
  // changes preserve the visible query instead of resetting local state.
  const searchParamValue = useMemo(() => {
    return new URLSearchParams(location.search).get('search') ?? '';
  }, [location.search]);

  const [searchValue, setSearchValue] = useState(searchParamValue);
  const [suggestionSearch, setSuggestionSearch] = useState('');
  const [isSearchBoxOpen, setIsSearchBoxOpen] = useState(false);
  const [assetCount, setAssetCount] = useState<number | null>(null);

  const debouncedSuggestionSearch = useMemo(
    () => debounce((value: string) => setSuggestionSearch(value), 400),
    []
  );

  useEffect(() => {
    initNLP();

    if (persistedNLPActive !== undefined) {
      setNLPActive(persistedNLPActive);
    }
  }, [initNLP, persistedNLPActive, setNLPActive]);

  useEffect(() => {
    let isMounted = true;

    searchQuery({
      query: '*',
      searchIndex: SearchIndex.DATA_ASSET,
      pageSize: 0,
      pageNumber: 1,
      trackTotalHits: true,
    })
      .then((res) => {
        if (isMounted) {
          setAssetCount(res.hits.total.value);
        }
      })
      .catch(() => {
        // Asset count is decorative; keep the header usable if it cannot load.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => debouncedSuggestionSearch.cancel();
  }, [debouncedSuggestionSearch]);

  // Explore tab navigation preserves `?search=...`; sync the controlled input
  // from that source of truth whenever the URL changes.
  useEffect(() => {
    setSearchValue(searchParamValue);
    setSuggestionSearch(searchParamValue);
  }, [searchParamValue]);

  useEffect(() => {
    setIsSearchBoxOpen(false);
  }, [location.pathname, location.search]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      setIsSearchBoxOpen(Boolean(value) || isNLPActive);
      debouncedSuggestionSearch(value);
    },
    [debouncedSuggestionSearch, isNLPActive]
  );

  const searchHandler = useCallback(
    (value: string) => {
      const trimmedSearch = value.trim();
      if (!trimmedSearch) {
        return;
      }

      setIsSearchBoxOpen(false);
      addToRecentSearched(trimmedSearch);

      const tabsInfo = searchClassBase.getTabsInfo();
      const defaultTab = searchCriteria ? tabsInfo[searchCriteria]?.path : '';

      navigate(
        getExplorePath({
          tab: defaultTab,
          search: trimmedSearch,
          isPersistFilters: true,
          extraParameters: { sort: '_score' },
        })
      );
    },
    [navigate, searchCriteria]
  );

  const handleQuickFilterClick = useCallback(
    (filter: QuickFilter) => {
      const ownerName = currentUser?.displayName || currentUser?.name;
      let quickFilter: string | undefined = filter.quickFilter;
      if (filter.quickFilterFn) {
        quickFilter = ownerName ? filter.quickFilterFn(ownerName) : undefined;
      }

      if (filter.quickFilterFn && !quickFilter) {
        return;
      }

      const sort = filter.sort ?? '_score';
      setSearchValue('');
      setSuggestionSearch('');
      setIsSearchBoxOpen(false);
      debouncedSuggestionSearch.cancel();
      navigate(
        getExplorePath({
          isPersistFilters: false,
          search: '',
          extraParameters: quickFilter ? { quickFilter, sort } : { sort },
        })
      );
    },
    [
      navigate,
      currentUser?.displayName,
      currentUser?.name,
      debouncedSuggestionSearch,
    ]
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      searchHandler(searchValue);
    },
    [searchHandler, searchValue]
  );

  const handleSuggestionSelect = useCallback(
    (value: string) => {
      debouncedSuggestionSearch.cancel();
      setSearchValue(value);
      setSuggestionSearch(value);
      searchHandler(value);
    },
    [debouncedSuggestionSearch, searchHandler]
  );

  const handleNLPToggle = useCallback(() => {
    const next = !isNLPActive;
    setNLPActive(next);
    setPreference({ isNLPActive: next });
    if (next) {
      setIsSearchBoxOpen(true);
    }
  }, [isNLPActive, setNLPActive, setPreference]);

  const handleClearSearch = useCallback(() => {
    debouncedSuggestionSearch.cancel();
    setSearchValue('');
    setSuggestionSearch('');
    setIsSearchBoxOpen(false);
    navigate(
      getExplorePath({
        isPersistFilters: true,
        search: '',
        extraParameters: { sort: '_score' },
      })
    );
  }, [debouncedSuggestionSearch, navigate]);

  // Keep the inset on the shared wrapper so the search and quick filters stay
  // aligned. The 896px cap minus 48px per side leaves the requested 800px
  // usable width without introducing another arbitrary outer width.
  const searchActions = (
    <Box
      className="tw:mx-auto tw:flex tw:w-full tw:max-w-4xl tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-3 tw:px-12"
      data-testid="explore-search-actions"
      direction="col">
      <ExploreSearchInput
        isNLPActive={isNLPActive}
        isNLPEnabled={isNLPEnabled}
        isSearchBoxOpen={isSearchBoxOpen}
        searchContainerRef={searchContainerRef}
        searchCriteria={searchCriteria || undefined}
        searchValue={searchValue}
        suggestionSearch={suggestionSearch}
        onClearSearch={handleClearSearch}
        onNLPToggle={handleNLPToggle}
        onSearchBoxOpenChange={setIsSearchBoxOpen}
        onSearchChange={handleSearchChange}
        onSubmit={handleSubmit}
        onSuggestionSelect={handleSuggestionSelect}
      />
      <div className="tw:w-full">
        <ExploreQuickFilters onFilterClick={handleQuickFilterClick} />
      </div>
    </Box>
  );

  const headerLayout = (
    <Box
      align="start"
      className="tw:w-full tw:min-w-0 tw:flex-1"
      data-testid="explore-header-layout"
      direction="row"
      gap={4}>
      <ExploreSearchCardInfo assetCount={assetCount} />
      {searchActions}
    </Box>
  );

  return (
    <HeaderShell
      className="tw:min-h-[108px] tw:w-full tw:overflow-hidden tw:rounded-xl"
      data-testid="explore-search-card"
      padding="comfortable"
      title={headerLayout}
      variant="gradient"
    />
  );
};
