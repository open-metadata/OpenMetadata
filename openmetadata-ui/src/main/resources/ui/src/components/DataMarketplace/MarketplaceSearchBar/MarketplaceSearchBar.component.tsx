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
import { INITIAL_PAGING_VALUE } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../generated/entity/domains/domain';
import { useMarketplaceRecentSearches } from '../../../hooks/useMarketplaceRecentSearches';
import { useMarketplaceStore } from '../../../hooks/useMarketplaceStore';
import { searchQuery } from '../../../rest/searchAPI';
import { getDataProductIconByUrl } from '../../../utils/DataProductUtils';
import { getDomainIcon } from '../../../utils/DomainUtils';
import { getDomainDetailsPath } from '../../../utils/RouterUtils';
import { getEncodedFqn } from '../../../utils/StringsUtils';
import './marketplace-search-bar.less';

const PAGE_SIZE = 5;

const MarketplaceSearchBar = ({ isEditView }: { isEditView?: boolean }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { dataProductBasePath } = useMarketplaceStore();
  const [searchValue, setSearchValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [dataProducts, setDataProducts] = useState<DataProduct[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { addSearch } = useMarketplaceRecentSearches();

  const fetchResults = useCallback(async (query: string) => {
    if (!query.trim()) {
      setDataProducts([]);
      setDomains([]);

      return;
    }
    setIsSearching(true);
    try {
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
    } catch {
      setDataProducts([]);
      setDomains([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

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
        `${dataProductBasePath}/${getEncodedFqn(dp.fullyQualifiedName ?? '')}`
      );
    },
    [navigate, dataProductBasePath]
  );

  const handleDomainClick = useCallback(
    (domain: Domain) => {
      setIsOpen(false);
      navigate(getDomainDetailsPath(domain.fullyQualifiedName ?? ''));
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
      <Input
        autoComplete="off"
        data-testid="marketplace-search-input"
        fontSize="xs"
        icon={SearchLg}
        iconClassName="tw:!size-4"
        inputClassName="tw:!pl-9"
        isDisabled={isEditView}
        placeholder={t('label.search-for-type', {
          type:
            t('label.data-product-plural') + ', ' + t('label.domain-plural'),
        })}
        value={searchValue}
        wrapperClassName="marketplace-search-input tw:!items-center"
        onChange={(value) => handleChange(value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSearch(searchValue);
          }
        }}
      />
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
