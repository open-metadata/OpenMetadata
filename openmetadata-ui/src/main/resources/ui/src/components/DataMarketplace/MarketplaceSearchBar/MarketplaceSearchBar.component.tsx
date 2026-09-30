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

import {
  Input,
  SelectPopover,
  Tooltip,
} from '@openmetadata/ui-core-components';
import { SearchLg } from '@untitledui/icons';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconSuggestionsActive } from '../../../assets/svg/ic-suggestions-active.svg';
import { ReactComponent as IconSuggestionsBlue } from '../../../assets/svg/ic-suggestions-blue.svg';
import { useMarketplaceRecentSearches } from '../../../hooks/useMarketplaceRecentSearches';
import { useSearchStore } from '../../../hooks/useSearchStore';
import MarketplaceSearchResults from '../MarketplaceSearchResults/MarketplaceSearchResults.component';
import { useMarketplaceEntitySearch } from '../MarketplaceSearchResults/useMarketplaceEntitySearch';
import './marketplace-search-bar.less';

const MarketplaceSearchBar = ({ isEditView }: { isEditView?: boolean }) => {
  const { t } = useTranslation();
  const { isNLPEnabled, isNLPActive, setNLPActive, initNLP } = useSearchStore();
  const [searchValue, setSearchValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
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

  const handleSearch = useCallback(
    (value: string) => {
      if (value.trim()) {
        debouncedSearch.cancel();
        search(value);
        addSearch(value);
        setIsOpen(true);
      }
    },
    [debouncedSearch, search, addSearch]
  );

  // A keyword search still waiting on the debounce would otherwise fire as NLQ.
  const handleNLPToggle = useCallback(() => {
    debouncedSearch.cancel();
    setNLPActive(!isNLPActive);
  }, [debouncedSearch, isNLPActive, setNLPActive]);

  const closePopover = useCallback(() => setIsOpen(false), []);

  return (
    <div
      className="marketplace-search-bar"
      data-testid="marketplace-search-bar"
      ref={containerRef}>
      <div className="tw:relative">
        <div className="tw:absolute tw:left-3 tw:top-1/2 tw:-translate-y-1/2 tw:z-10 tw:flex tw:items-center">
          {isNLPEnabled ? (
            <Tooltip
              title={
                isNLPActive
                  ? t('message.natural-language-search-active')
                  : t('label.use-natural-language-search')
              }>
              <button
                className={`marketplace-nlq-button${
                  isNLPActive ? ' active' : ''
                }`}
                data-testid="marketplace-nlq-toggle"
                type="button"
                onClick={handleNLPToggle}>
                {isNLPActive ? (
                  <IconSuggestionsActive />
                ) : (
                  <IconSuggestionsBlue />
                )}
              </button>
            </Tooltip>
          ) : (
            <SearchLg className="tw:size-4 tw:text-text-tertiary" />
          )}
        </div>
        <Input
          autoComplete="off"
          data-testid="marketplace-search-input"
          fontSize="sm"
          inputClassName="tw:!pl-11"
          isDisabled={isEditView}
          placeholder={t('label.search-for-type', {
            type:
              t('label.data-product-plural') + ', ' + t('label.domain-plural'),
          })}
          value={searchValue}
          wrapperClassName="marketplace-search-input tw:!rounded-xl tw:!items-center tw:!py-1"
          onChange={(value) => handleChange(value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch(searchValue);
            }
          }}
        />
      </div>
      <SelectPopover
        isNonModal
        className="!tw:max-h-[400px]"
        isOpen={isOpen && searchValue?.trim().length > 0}
        offset={4}
        placement="bottom"
        size="md"
        style={{ width: containerRef?.current?.offsetWidth }}
        triggerRef={containerRef}
        onOpenChange={(open) => {
          setIsOpen(searchValue.trim().length > 0 && open);
        }}>
        <MarketplaceSearchResults
          dataProducts={dataProducts}
          domains={domains}
          isSearching={isSearching}
          onSelect={closePopover}
        />
      </SelectPopover>
    </div>
  );
};

export default MarketplaceSearchBar;
