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

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchStore } from '../../../hooks/useSearchStore';
import { useListSearchInput } from '../../common/atoms/navigation/useListSearchInput';
import { ExploreSearchInput } from '../../discovery/explore/ExploreHeader/ExploreSearchInput';
import MarketplaceSearchResults from '../MarketplaceSearchResults/MarketplaceSearchResults.component';
import { useMarketplaceEntitySearch } from '../MarketplaceSearchResults/useMarketplaceEntitySearch';

interface MarketplaceSearchInputProps {
  /** Current query, as the page holds it (usually mirrored from the URL). */
  searchQuery?: string;
  /**
   * Filter the page's own list. Omitted on the overview, which has no list:
   * there the matching domains and data products show in the popover instead.
   */
  onSearchChange?: (value: string) => void;
  /** Re-run the list's current query, for Enter on unchanged text. */
  onRefresh?: () => void;
  /** Placeholder text. Defaults to Explore's. */
  placeholder?: string;
  isDisabled?: boolean;
}

/**
 * Explore's search bar on the marketplace pages. Submitting filters the page's
 * own list, or shows the matches on the overview, instead of navigating to
 * Explore.
 */
const MarketplaceSearchInput = ({
  searchQuery,
  onSearchChange,
  onRefresh,
  placeholder,
  isDisabled,
}: MarketplaceSearchInputProps) => {
  const { isNLPEnabled, isNLPActive, setNLPActive, initNLP } = useSearchStore();
  const [isSearchBoxOpen, setIsSearchBoxOpen] = useState(false);
  const searchContainerRef = useRef<HTMLFormElement>(null);
  const showsResults = !onSearchChange;
  const isNlq = isNLPEnabled && isNLPActive;
  const { dataProducts, domains, isSearching, search } =
    useMarketplaceEntitySearch();

  // GlobalSearchBar is absent on these pages, so bootstrap the store.
  useEffect(() => {
    initNLP();
  }, [initNLP]);

  const { searchInputValue, handleChange, handleSubmit, handleClear } =
    useListSearchInput({
      searchQuery,
      onSearchChange: onSearchChange ?? search,
      onRefresh,
      // NLQ runs an LLM step per call, so as on Explore it waits for Enter.
      submitOnly: isNlq,
    });

  // A list page's results are the list itself, so only the overview has a
  // popover, and only once there is text for it to match.
  const isPopoverOpen =
    showsResults && isSearchBoxOpen && Boolean(searchInputValue.trim());

  const handleSearchChange = useCallback(
    (value: string) => {
      handleChange(value);
      // An NLQ query shows nothing until Enter, rather than the last results.
      setIsSearchBoxOpen(Boolean(value) && !isNlq);
    },
    [handleChange, isNlq]
  );

  const handleFormSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      handleSubmit();
      setIsSearchBoxOpen(true);
    },
    [handleSubmit]
  );

  const handleClearSearch = useCallback(() => {
    handleClear();
    setIsSearchBoxOpen(false);
  }, [handleClear]);

  const handleNLPToggle = useCallback(
    () => setNLPActive(!isNLPActive),
    [isNLPActive, setNLPActive]
  );

  const closePopover = useCallback(() => setIsSearchBoxOpen(false), []);

  return (
    <ExploreSearchInput
      isDisabled={isDisabled}
      isNLPActive={isNLPActive}
      isNLPEnabled={isNLPEnabled}
      isSearchBoxOpen={isPopoverOpen}
      placeholder={placeholder}
      searchContainerRef={searchContainerRef}
      searchValue={searchInputValue}
      suggestionSearch={searchInputValue}
      suggestions={
        <MarketplaceSearchResults
          dataProducts={dataProducts}
          domains={domains}
          isSearching={isSearching}
          onSelect={closePopover}
        />
      }
      onClearSearch={handleClearSearch}
      onNLPToggle={handleNLPToggle}
      onSearchBoxOpenChange={setIsSearchBoxOpen}
      onSearchChange={handleSearchChange}
      onSubmit={handleFormSubmit}
      onSuggestionSelect={handleSearchChange}
    />
  );
};

export default MarketplaceSearchInput;
