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
import { useSearchStore } from '../../../hooks/useSearchStore';
import { useListSearchInput } from '../../common/atoms/navigation/useListSearchInput';
import MarketplaceSearchControl from '../MarketplaceSearchBar/MarketplaceSearchControl.component';
import MarketplaceSearchResults from '../MarketplaceSearchResults/MarketplaceSearchResults.component';
import { useMarketplaceEntitySearch } from '../MarketplaceSearchResults/useMarketplaceEntitySearch';

interface MarketplaceSearchInputProps {
  /** Current query, as the page holds it (usually mirrored from the URL). */
  searchQuery?: string;
  /** Filter the page's own list. */
  onSearchChange: (value: string) => void;
  /** Re-run the list's current query, for Enter on unchanged text. */
  onRefresh?: () => void;
  placeholder: string;
}

/**
 * The marketplace search field on a list page. Submitting filters the page's
 * own list rather than navigating, and the popover previews the domains and
 * data products the query also matches.
 */
const MarketplaceSearchInput = ({
  searchQuery,
  onSearchChange,
  onRefresh,
  placeholder,
}: MarketplaceSearchInputProps) => {
  const { isNLPEnabled, isNLPActive, setNLPActive, initNLP } = useSearchStore();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isNlq = isNLPEnabled && isNLPActive;
  const { dataProducts, domains, isSearching, search } =
    useMarketplaceEntitySearch();

  // GlobalSearchBar is absent on marketplace pages, so bootstrap the store.
  useEffect(() => {
    initNLP();
  }, [initNLP]);

  const { searchInputValue, handleChange, handleSubmit } = useListSearchInput({
    searchQuery,
    onSearchChange,
    onRefresh,
    // NLQ runs an LLM step per call, so as on Explore it waits for Enter.
    submitOnly: isNlq,
  });

  const handleSearchChange = useCallback(
    (value: string) => {
      handleChange(value);
      // An NLQ query shows nothing until Enter, rather than the last results.
      if (!value.trim() || isNlq) {
        setIsPopoverOpen(false);
        search('');

        return;
      }
      setIsPopoverOpen(true);
      search(value);
    },
    [handleChange, isNlq, search]
  );

  const handleFormSubmit = useCallback(() => {
    handleSubmit();
    if (searchInputValue.trim()) {
      search(searchInputValue);
      setIsPopoverOpen(true);
    }
  }, [handleSubmit, search, searchInputValue]);

  const handleNLPToggle = useCallback(
    () => setNLPActive(!isNLPActive),
    [isNLPActive, setNLPActive]
  );

  const closePopover = useCallback(() => setIsPopoverOpen(false), []);

  return (
    <MarketplaceSearchControl
      containerRef={containerRef}
      isNLPActive={isNLPActive}
      isNLPEnabled={isNLPEnabled}
      isPopoverOpen={isPopoverOpen && searchInputValue.trim().length > 0}
      placeholder={placeholder}
      results={
        <MarketplaceSearchResults
          dataProducts={dataProducts}
          domains={domains}
          isSearching={isSearching}
          onSelect={closePopover}
        />
      }
      searchValue={searchInputValue}
      onNLPToggle={handleNLPToggle}
      onPopoverOpenChange={(open) =>
        setIsPopoverOpen(searchInputValue.trim().length > 0 && open)
      }
      onSearchChange={handleSearchChange}
      onSubmit={handleFormSubmit}
    />
  );
};

export default MarketplaceSearchInput;
