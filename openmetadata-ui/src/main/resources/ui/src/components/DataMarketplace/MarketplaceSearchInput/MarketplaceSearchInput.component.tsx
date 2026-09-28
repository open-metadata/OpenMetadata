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
import { useNavigate } from 'react-router-dom';
import { SearchIndex } from '../../../enums/search.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../generated/entity/domains/domain';
import { useMarketplaceStore } from '../../../hooks/useMarketplaceStore';
import { useSearchStore } from '../../../hooks/useSearchStore';
import { getDomainDetailsPath } from '../../../utils/RouterUtils';
import { getEncodedFqn } from '../../../utils/StringUtils';
import { ExploreSearchInput } from '../../discovery/explore/ExploreHeader/ExploreSearchInput';
import MarketplaceSearchResults from '../MarketplaceSearchResults/MarketplaceSearchResults.component';
import { useMarketplaceEntitySearch } from '../MarketplaceSearchResults/useMarketplaceEntitySearch';

const SEARCH_DEBOUNCE_MS = 300;
const SUGGESTION_DEBOUNCE_MS = 400;

interface MarketplaceSearchInputProps {
  /** Index the suggestions and the NLQ query are scoped to. */
  searchCriteria: SearchIndex;
  /** Current query, as the page holds it (usually mirrored from the URL). */
  searchQuery?: string;
  /**
   * Push a new query to the page. Debounced while typing, immediate on clear.
   * Omitted on a page with no list of its own - the overview, where the
   * suggestions themselves are the result.
   */
  onSearchChange?: (value: string) => void;
  /** Placeholder text. Defaults to Explore's. */
  placeholder?: string;
  /**
   * Render matching entities in the popover instead of Explore's suggestions,
   * whose canned prompts are about tables and dashboards and mean nothing here.
   */
  showEntityResults?: boolean;
  /**
   * Results the page has already fetched. Supplying them keeps the popover and
   * the list identical and costs no extra request — they ask the same index the
   * same question. Without them the popover fetches its own, which is what the
   * overview does, having no list.
   */
  results?: {
    dataProducts?: DataProduct[];
    domains?: Domain[];
    isSearching?: boolean;
  };
}

/**
 * Explore's search bar on the marketplace pages. Same control and suggestions,
 * but submitting filters the page's own list instead of navigating to Explore.
 */
const MarketplaceSearchInput = ({
  searchCriteria,
  searchQuery,
  onSearchChange,
  placeholder,
  showEntityResults,
  results,
}: MarketplaceSearchInputProps) => {
  const navigate = useNavigate();
  const { dataProductBasePath } = useMarketplaceStore();
  const { isNLPEnabled, isNLPActive, setNLPActive, initNLP } = useSearchStore();
  const [searchValue, setSearchValue] = useState(searchQuery ?? '');
  const [suggestionSearch, setSuggestionSearch] = useState('');
  const [isSearchBoxOpen, setIsSearchBoxOpen] = useState(false);
  const searchContainerRef = useRef<HTMLFormElement>(null);

  // GlobalSearchBar is absent on these pages, so bootstrap the store.
  useEffect(() => {
    initNLP();
  }, [initNLP]);

  // Held in a ref so the debounce below is built once. The prop chains down to
  // react-router's `setSearchParams`, whose identity changes on every URL
  // change - rebuilding the debounce there would cancel it mid-flight.
  const onSearchChangeRef = useRef(onSearchChange);
  onSearchChangeRef.current = onSearchChange;

  const pushSearch = useCallback(
    (value: string) => onSearchChangeRef.current?.(value),
    []
  );

  const debouncedSearch = useMemo(
    () => debounce(pushSearch, SEARCH_DEBOUNCE_MS),
    [pushSearch]
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
    return () => debouncedSearch.cancel();
  }, [debouncedSearch]);

  // Separate from the one above: a shared cleanup would cancel this timer
  // whenever the other debounce was rebuilt, killing the popover's query.
  useEffect(() => {
    return () => debouncedSuggestionSearch.cancel();
  }, [debouncedSuggestionSearch]);

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
      pushSearch(searchValue);
      setIsSearchBoxOpen(false);
    },
    [debouncedSearch, pushSearch, searchValue]
  );

  const handleClearSearch = useCallback(() => {
    debouncedSearch.cancel();
    debouncedSuggestionSearch.cancel();
    setSearchValue('');
    setSuggestionSearch('');
    setIsSearchBoxOpen(false);
    pushSearch('');
  }, [debouncedSearch, debouncedSuggestionSearch, pushSearch]);

  const handleSuggestionSelect = useCallback(
    (value: string) => {
      debouncedSearch.cancel();
      setSearchValue(value);
      setIsSearchBoxOpen(false);
      pushSearch(value);
    },
    [debouncedSearch, pushSearch]
  );

  const handleNLPToggle = useCallback(
    () => setNLPActive(!isNLPActive),
    [isNLPActive, setNLPActive]
  );

  // Skipped entirely when the page supplies its own results.
  const fetched = useMarketplaceEntitySearch(
    showEntityResults && !results ? suggestionSearch : '',
    searchCriteria
  );
  const dataProducts = results
    ? results.dataProducts ?? []
    : fetched.dataProducts;
  const domains = results ? results.domains ?? [] : fetched.domains;
  const isSearching = results
    ? Boolean(results.isSearching)
    : fetched.isSearching;

  // Picking a result opens it, as it does on Explore.
  const openEntity = useCallback(
    (path: string) => {
      setIsSearchBoxOpen(false);
      navigate(path, { state: { fromMarketplace: true } });
    },
    [navigate]
  );

  const handleDataProductClick = useCallback(
    (dataProduct: DataProduct) =>
      openEntity(
        `${dataProductBasePath}/${getEncodedFqn(
          dataProduct.fullyQualifiedName ?? ''
        )}`
      ),
    [openEntity, dataProductBasePath]
  );

  const handleDomainClick = useCallback(
    (domain: Domain) =>
      openEntity(getDomainDetailsPath(domain.fullyQualifiedName ?? '')),
    [openEntity]
  );

  return (
    <ExploreSearchInput
      isNLPActive={isNLPActive}
      isNLPEnabled={isNLPEnabled}
      isSearchBoxOpen={isSearchBoxOpen}
      placeholder={placeholder}
      searchContainerRef={searchContainerRef}
      searchCriteria={searchCriteria}
      searchValue={searchValue}
      suggestionSearch={suggestionSearch}
      suggestions={
        showEntityResults ? (
          <MarketplaceSearchResults
            dataProducts={dataProducts}
            domains={domains}
            isSearching={isSearching}
            onDataProductClick={handleDataProductClick}
            onDomainClick={handleDomainClick}
          />
        ) : undefined
      }
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
