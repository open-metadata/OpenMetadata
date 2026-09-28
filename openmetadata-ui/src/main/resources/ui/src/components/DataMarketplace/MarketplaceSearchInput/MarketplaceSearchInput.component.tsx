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

import { debounce } from 'lodash';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SearchIndex } from '../../../enums/search.enum';
import { useSearchStore } from '../../../hooks/useSearchStore';
import { ExploreSearchInput } from '../../discovery/explore/ExploreHeader/ExploreSearchInput';

const SEARCH_DEBOUNCE_MS = 300;
const SUGGESTION_DEBOUNCE_MS = 400;

interface MarketplaceSearchInputProps {
  /** Index the suggestions and the NLQ query are scoped to. */
  searchCriteria: SearchIndex;
  /** Current query, as the page holds it (usually mirrored from the URL). */
  searchQuery?: string;
  /** Push a new query to the page. Debounced while typing, immediate on clear. */
  onSearchChange: (value: string) => void;
  /** i18n key for the placeholder. Defaults to Explore's. */
  placeholderKey?: string;
}

/**
 * Explore's search bar on the marketplace pages. Same control and suggestions,
 * but submitting filters the page's own list instead of navigating to Explore.
 */
const MarketplaceSearchInput = ({
  searchCriteria,
  searchQuery,
  onSearchChange,
  placeholderKey,
}: MarketplaceSearchInputProps) => {
  const { isNLPEnabled, isNLPActive, setNLPActive, initNLP } = useSearchStore();
  const [searchValue, setSearchValue] = useState(searchQuery ?? '');
  const [suggestionSearch, setSuggestionSearch] = useState('');
  const [isSearchBoxOpen, setIsSearchBoxOpen] = useState(false);
  const searchContainerRef = useRef<HTMLFormElement>(null);

  // GlobalSearchBar is absent on these pages, so bootstrap the store.
  useEffect(() => {
    initNLP();
  }, [initNLP]);

  const debouncedSearch = useMemo(
    () => debounce(onSearchChange, SEARCH_DEBOUNCE_MS),
    [onSearchChange]
  );

  const debouncedSuggestionSearch = useMemo(
    () =>
      debounce(
        (value: string) => setSuggestionSearch(value),
        SUGGESTION_DEBOUNCE_MS
      ),
    []
  );

  useEffect(() => {
    debouncedSearch.cancel();
    setSearchValue(searchQuery ?? '');
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
      debouncedSuggestionSearch.cancel();
    };
  }, [debouncedSearch, debouncedSuggestionSearch]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      setIsSearchBoxOpen(Boolean(value) || isNLPActive);
      debouncedSearch(value);
      debouncedSuggestionSearch(value);
    },
    [debouncedSearch, debouncedSuggestionSearch, isNLPActive]
  );

  // Enter applies the query now rather than waiting out the debounce.
  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      debouncedSearch.cancel();
      onSearchChange(searchValue);
      setIsSearchBoxOpen(false);
    },
    [debouncedSearch, onSearchChange, searchValue]
  );

  const handleClearSearch = useCallback(() => {
    debouncedSearch.cancel();
    debouncedSuggestionSearch.cancel();
    setSearchValue('');
    setSuggestionSearch('');
    setIsSearchBoxOpen(false);
    onSearchChange('');
  }, [debouncedSearch, debouncedSuggestionSearch, onSearchChange]);

  const handleSuggestionSelect = useCallback(
    (value: string) => {
      debouncedSearch.cancel();
      setSearchValue(value);
      setIsSearchBoxOpen(false);
      onSearchChange(value);
    },
    [debouncedSearch, onSearchChange]
  );

  const handleNLPToggle = useCallback(
    () => setNLPActive(!isNLPActive),
    [isNLPActive, setNLPActive]
  );

  return (
    <ExploreSearchInput
      isNLPActive={isNLPActive}
      isNLPEnabled={isNLPEnabled}
      isSearchBoxOpen={isSearchBoxOpen}
      placeholderKey={placeholderKey}
      searchContainerRef={searchContainerRef}
      searchCriteria={searchCriteria}
      searchValue={searchValue}
      suggestionSearch={suggestionSearch}
      onClearSearch={handleClearSearch}
      onNLPToggle={handleNLPToggle}
      onSearchBoxOpenChange={setIsSearchBoxOpen}
      onSearchChange={handleSearchChange}
      onSubmit={handleSubmit}
      onSuggestionSelect={handleSuggestionSelect}
    />
  );
};

export default MarketplaceSearchInput;
