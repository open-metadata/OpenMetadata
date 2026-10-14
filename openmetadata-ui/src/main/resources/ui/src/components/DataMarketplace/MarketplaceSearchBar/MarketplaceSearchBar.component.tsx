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
import { useTranslation } from 'react-i18next';
import { useMarketplaceRecentSearches } from '../../../hooks/useMarketplaceRecentSearches';
import { useSearchStore } from '../../../hooks/useSearchStore';
import { ExploreSearchInput } from '../../discovery/explore/ExploreHeader/ExploreSearchInput';
import MarketplaceSearchResults from '../MarketplaceSearchResults/MarketplaceSearchResults.component';
import { useMarketplaceEntitySearch } from '../MarketplaceSearchResults/useMarketplaceEntitySearch';

const MarketplaceSearchBar = ({ isEditView }: { isEditView?: boolean }) => {
  const { t } = useTranslation();
  const { isNLPEnabled, isNLPActive, setNLPActive, initNLP } = useSearchStore();
  const [searchValue, setSearchValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchContainerRef = useRef<HTMLFormElement>(null);
  const { addSearch } = useMarketplaceRecentSearches();
  const { dataProducts, domains, isSearching, search } =
    useMarketplaceEntitySearch();
  const isNlq = isNLPEnabled && isNLPActive;

  // GlobalSearchBar is absent on marketplace pages, so bootstrap the store if not yet populated.
  useEffect(() => {
    initNLP();
  }, [initNLP]);

  const debouncedSearch = useMemo(() => debounce(search, 400), [search]);

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      if (!value.trim()) {
        setIsOpen(false);
        debouncedSearch.cancel();
        search('');
      } else if (isNlq) {
        // NLQ runs an LLM step per call, so as on Explore it waits for Enter.
        setIsOpen(false);
      } else {
        setIsOpen(true);
        debouncedSearch(value);
      }
    },
    [debouncedSearch, search, isNlq]
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (searchValue.trim()) {
        debouncedSearch.cancel();
        search(searchValue);
        addSearch(searchValue);
        setIsOpen(true);
      }
    },
    [debouncedSearch, search, addSearch, searchValue]
  );

  // A keyword search still waiting on the debounce would otherwise fire as NLQ.
  const handleNLPToggle = useCallback(() => {
    debouncedSearch.cancel();
    setNLPActive(!isNLPActive);
  }, [debouncedSearch, isNLPActive, setNLPActive]);

  const handleClearSearch = useCallback(() => {
    debouncedSearch.cancel();
    setSearchValue('');
    setIsOpen(false);
    search('');
  }, [debouncedSearch, search]);

  const closePopover = useCallback(() => setIsOpen(false), []);

  return (
    <ExploreSearchInput
      showShortcutHint
      isDisabled={isEditView}
      isNLPActive={isNLPActive}
      isNLPEnabled={isNLPEnabled}
      isSearchBoxOpen={isOpen && searchValue.trim().length > 0}
      placeholder={t('label.search-for-type', {
        type: `${t('label.data-product-plural')}, ${t('label.domain-plural')}`,
      })}
      searchContainerRef={searchContainerRef}
      searchValue={searchValue}
      suggestionSearch={searchValue}
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
      onSearchBoxOpenChange={setIsOpen}
      onSearchChange={handleChange}
      onSubmit={handleSubmit}
      onSuggestionSelect={handleChange}
    />
  );
};

export default MarketplaceSearchBar;
