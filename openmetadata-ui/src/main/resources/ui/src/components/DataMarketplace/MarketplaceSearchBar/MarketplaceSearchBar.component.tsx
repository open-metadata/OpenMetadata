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
  Typography,
} from '@openmetadata/ui-core-components';
import { SearchLg } from '@untitledui/icons';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as IconSuggestionsActive } from '../../../assets/svg/ic-suggestions-active.svg';
import { ReactComponent as IconSuggestionsBlue } from '../../../assets/svg/ic-suggestions-blue.svg';
import { INITIAL_PAGING_VALUE } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../generated/entity/domains/domain';
import { useMarketplaceRecentSearches } from '../../../hooks/useMarketplaceRecentSearches';
import { useMarketplaceStore } from '../../../hooks/useMarketplaceStore';
import { useSearchStore } from '../../../hooks/useSearchStore';
import { nlqSearch, searchQuery } from '../../../rest/searchAPI';
import { getDataProductIconByUrl } from '../../../utils/DataProductUtils';
import { getDomainIcon } from '../../../utils/DomainUtils';
import { getDomainDetailsPath } from '../../../utils/RouterUtils';
import { getEncodedFqn } from '../../../utils/StringUtils';
import './marketplace-search-bar.less';

const PAGE_SIZE = 5;

const MarketplaceSearchBar = ({ isEditView }: { isEditView?: boolean }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { dataProductBasePath } = useMarketplaceStore();
  const { isNLPEnabled, isNLPActive, setNLPActive, initNLP } =
    useSearchStore();
  const [searchValue, setSearchValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [dataProducts, setDataProducts] = useState<DataProduct[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { addSearch } = useMarketplaceRecentSearches();

  // GlobalSearchBar is absent on marketplace pages, so bootstrap the store if not yet populated.
  useEffect(() => {
    initNLP();
  }, [initNLP]);

  const fetchResults = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setDataProducts([]);
        setDomains([]);

        return;
      }
      setIsSearching(true);
      try {
        if (isNLPEnabled && isNLPActive) {
          const res = await nlqSearch({
            query,
            pageNumber: INITIAL_PAGING_VALUE,
            pageSize: PAGE_SIZE * 2,
            searchIndex: SearchIndex.MARKETPLACE,
          });

          const hits = res.hits.hits;
          setDataProducts(
            hits
              .filter((h) => h._source.entityType === SearchIndex.DATA_PRODUCT)
              .slice(0, PAGE_SIZE)
              .map((h) => h._source as unknown as DataProduct)
          );
          setDomains(
            hits
              .filter((h) => h._source.entityType === SearchIndex.DOMAIN)
              .slice(0, PAGE_SIZE)
              .map((h) => h._source as unknown as Domain)
          );
        } else {
          const [dpRes, domainRes] = await Promise.all([
            searchQuery({
              query,
              pageNumber: INITIAL_PAGING_VALUE,
              pageSize: PAGE_SIZE,
              searchIndex: SearchIndex.DATA_PRODUCT,
            }),
            searchQuery({
              query,
              pageNumber: INITIAL_PAGING_VALUE,
              pageSize: PAGE_SIZE,
              searchIndex: SearchIndex.DOMAIN,
            }),
          ]);

          setDataProducts(
            dpRes.hits.hits.map((hit) => hit._source) as DataProduct[]
          );
          setDomains(domainRes.hits.hits.map((hit) => hit._source) as Domain[]);
        }
      } catch {
        setDataProducts([]);
        setDomains([]);
      } finally {
        setIsSearching(false);
      }
    },
    [isNLPEnabled, isNLPActive]
  );

  const debouncedFetch = useMemo(
    () => debounce(fetchResults, 400),
    [fetchResults]
  );

  useEffect(() => {
    return () => {
      debouncedFetch.cancel();
    };
  }, [debouncedFetch]);

  const handleChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      if (value.trim()) {
        setIsOpen(true);
        debouncedFetch(value);
      } else {
        setIsOpen(false);
        setDataProducts([]);
        setDomains([]);
      }
    },
    [debouncedFetch]
  );

  const handleSearch = useCallback(
    (value: string) => {
      if (value.trim()) {
        debouncedFetch.cancel();
        fetchResults(value);
        addSearch(value);
        setIsOpen(true);
      }
    },
    [fetchResults, debouncedFetch, addSearch]
  );

  const handleDataProductClick = useCallback(
    (dp: DataProduct) => {
      setIsOpen(false);
      navigate(
        `${dataProductBasePath}/${getEncodedFqn(dp.fullyQualifiedName ?? '')}`,
        { state: { fromMarketplace: true } }
      );
    },
    [navigate, dataProductBasePath]
  );

  const handleDomainClick = useCallback(
    (domain: Domain) => {
      setIsOpen(false);
      navigate(getDomainDetailsPath(domain.fullyQualifiedName ?? ''), {
        state: { fromMarketplace: true },
      });
    },
    [navigate]
  );

  const popoverContent = useMemo(() => {
    const hasResults = dataProducts.length > 0 || domains.length > 0;

    if (isSearching) {
      return (
        <div className="marketplace-search-results p-md">
          <Typography as="span" className="tw:text-sm tw:text-text-tertiary">
            {t('label.loading')}...
          </Typography>
        </div>
      );
    }

    if (!hasResults) {
      return (
        <div className="marketplace-search-results p-md">
          <Typography as="span" className="tw:text-sm tw:text-text-tertiary">
            {t('label.no-data-found')}
          </Typography>
        </div>
      );
    }

    return (
      <div className="marketplace-search-results">
        {dataProducts.length > 0 && (
          <div className="search-result-section">
            <Typography as="span" className="search-result-section-title">
              {t('label.data-product-plural')}
            </Typography>
            {dataProducts.map((dp) => (
              <div
                className="search-result-item"
                data-testid={`search-result-dp-${dp.id}`}
                key={dp.id}
                role="button"
                tabIndex={0}
                onClick={() => handleDataProductClick(dp)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleDataProductClick(dp);
                  }
                }}>
                <div className="search-result-icon">
                  {getDataProductIconByUrl(dp.style?.iconURL)}
                </div>
                <Typography
                  as="span"
                  className="tw:truncate tw:block tw:text-sm"
                  title={dp.displayName || dp.name}>
                  {dp.displayName || dp.name}
                </Typography>
              </div>
            ))}
          </div>
        )}
        {domains.length > 0 && (
          <div className="search-result-section">
            <Typography as="span" className="search-result-section-title">
              {t('label.domain-plural')}
            </Typography>
            {domains.map((domain) => (
              <div
                className="search-result-item"
                data-testid={`search-result-domain-${domain.id}`}
                key={domain.id}
                role="button"
                tabIndex={0}
                onClick={() => handleDomainClick(domain)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleDomainClick(domain);
                  }
                }}>
                <div className="search-result-icon">
                  {getDomainIcon(domain.style?.iconURL)}
                </div>
                <Typography
                  as="span"
                  className="tw:truncate tw:block tw:text-sm"
                  title={domain.displayName || domain.name}>
                  {domain.displayName || domain.name}
                </Typography>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }, [
    dataProducts,
    domains,
    isSearching,
    handleDataProductClick,
    handleDomainClick,
    t,
  ]);

  return (
    <div
      className="marketplace-search-bar"
      data-testid="marketplace-search-bar"
      ref={containerRef}>
      <div className="tw:relative">
        <div className="tw:absolute tw:left-3 tw:top-1/2 tw:-translate-y-1/2 tw:z-10 tw:flex tw:items-center">
          {isNLPEnabled ? (
            <button
              className={`marketplace-nlq-button${
                isNLPActive ? ' active' : ''
              }`}
              data-testid="marketplace-nlq-toggle"
              title={
                isNLPActive
                  ? t('message.natural-language-search-active')
                  : t('label.use-natural-language-search')
              }
              onClick={() => setNLPActive(!isNLPActive)}>
              {isNLPActive ? (
                <IconSuggestionsActive />
              ) : (
                <IconSuggestionsBlue />
              )}
            </button>
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
        {popoverContent}
      </SelectPopover>
    </div>
  );
};

export default MarketplaceSearchBar;
