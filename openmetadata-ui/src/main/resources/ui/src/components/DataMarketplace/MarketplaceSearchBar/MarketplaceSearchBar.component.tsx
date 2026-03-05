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

import { Button, Input, Popover, Tag, Typography } from 'antd';
import { debounce, isEmpty } from 'lodash';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { INITIAL_PAGING_VALUE } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../generated/entity/domains/domain';
import { useMarketplaceRecentSearches } from '../../../hooks/useMarketplaceRecentSearches';
import { searchQuery } from '../../../rest/searchAPI';
import { getDataProductIconByUrl } from '../../../utils/DataProductUtils';
import { getDomainIcon } from '../../../utils/DomainUtils';
import {
  getDomainDetailsPath,
  getEntityDetailsPath,
} from '../../../utils/RouterUtils';
import './marketplace-search-bar.less';

const PAGE_SIZE = 5;

const MarketplaceSearchBar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { recentSearches, addSearch, clearSearches } =
    useMarketplaceRecentSearches();
  const [searchValue, setSearchValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [dataProducts, setDataProducts] = useState<DataProduct[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
        addSearch(value.trim());
        fetchResults(value);
        setIsOpen(true);
      }
    },
    [addSearch, fetchResults]
  );

  const handleDataProductClick = useCallback(
    (dp: DataProduct) => {
      setIsOpen(false);
      navigate(
        getEntityDetailsPath(
          EntityType.DATA_PRODUCT,
          dp.fullyQualifiedName ?? ''
        )
      );
    },
    [navigate]
  );

  const handleDomainClick = useCallback(
    (domain: Domain) => {
      setIsOpen(false);
      navigate(getDomainDetailsPath(domain.fullyQualifiedName ?? ''));
    },
    [navigate]
  );

  const handleRecentSearchClick = useCallback(
    (term: string) => {
      setSearchValue(term);
      handleSearch(term);
    },
    [handleSearch]
  );

  const popoverContent = useMemo(() => {
    const hasResults = dataProducts.length > 0 || domains.length > 0;

    if (isSearching) {
      return (
        <div className="marketplace-search-results p-md">
          <Typography.Text className="text-grey-muted">
            {t('label.loading')}...
          </Typography.Text>
        </div>
      );
    }

    if (!hasResults) {
      return (
        <div className="marketplace-search-results p-md">
          <Typography.Text className="text-grey-muted">
            {t('label.no-data-found')}
          </Typography.Text>
        </div>
      );
    }

    return (
      <div className="marketplace-search-results">
        {dataProducts.length > 0 && (
          <div className="search-result-section">
            <Typography.Text className="search-result-section-title">
              {t('label.data-product-plural')}
            </Typography.Text>
            {dataProducts.map((dp) => (
              <div
                className="search-result-item"
                data-testid={`search-result-dp-${dp.id}`}
                key={dp.id}
                role="button"
                tabIndex={0}
                onClick={() => handleDataProductClick(dp)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleDataProductClick(dp);
                  }
                }}>
                <div className="search-result-icon">
                  {getDataProductIconByUrl(dp.style?.iconURL)}
                </div>
                <Typography.Text ellipsis={{ tooltip: true }}>
                  {dp.displayName || dp.name}
                </Typography.Text>
              </div>
            ))}
          </div>
        )}
        {domains.length > 0 && (
          <div className="search-result-section">
            <Typography.Text className="search-result-section-title">
              {t('label.domain-plural')}
            </Typography.Text>
            {domains.map((domain) => (
              <div
                className="search-result-item"
                data-testid={`search-result-domain-${domain.id}`}
                key={domain.id}
                role="button"
                tabIndex={0}
                onClick={() => handleDomainClick(domain)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleDomainClick(domain);
                  }
                }}>
                <div className="search-result-icon">
                  {getDomainIcon(domain.style?.iconURL)}
                </div>
                <Typography.Text ellipsis={{ tooltip: true }}>
                  {domain.displayName || domain.name}
                </Typography.Text>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }, [dataProducts, domains, isSearching, handleDataProductClick, handleDomainClick, t]);

  return (
    <div
      className="marketplace-search-bar"
      data-testid="marketplace-search-bar"
      ref={containerRef}>
        <Popover
          align={{ offset: [0, 4] }}
          content={popoverContent}
          getPopupContainer={() => containerRef.current || document.body}
          open={isOpen && searchValue.trim().length > 0}
          overlayClassName="marketplace-search-overlay"
          overlayStyle={{ width: '100%' }}
          placement="bottom"
          showArrow={false}
          trigger={['click']}
          onOpenChange={(open) => {
            setIsOpen(searchValue.trim().length > 0 && open);
          }}>
          <Input
            autoComplete="off"
            className="marketplace-search-input"
            data-testid="marketplace-search-input"
            placeholder={t('label.search-for-type', {
              type: t('label.data-product-plural') +
                ', ' +
                t('label.domain-plural'),
            })}
            prefix={
              <span className="marketplace-search-icon">
                <svg
                  fill="none"
                  height="20"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="20">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" x2="16.65" y1="21" y2="16.65" />
                </svg>
              </span>
            }
            size="large"
            value={searchValue}
            onChange={(e) => handleChange(e.target.value)}
            onPressEnter={(e) =>
              handleSearch((e.target as HTMLInputElement).value)
            }
          />
        </Popover>
      {!isEmpty(recentSearches) && (
        <div
          className="marketplace-recent-searches"
          data-testid="marketplace-recent-searches">
          <Typography.Text className="recent-search-label">
            {t('label.recent-search-term-plural')}:
          </Typography.Text>
          <div className="recent-search-tags">
            {recentSearches.map((term) => (
              <Tag
                className="recent-search-tag"
                data-testid={`recent-search-${term}`}
                key={term}
                onClick={() => handleRecentSearchClick(term)}>
                {term}
              </Tag>
            ))}
          </div>
          <Button
            className="clear-btn"
            data-testid="clear-recent-searches"
            type="link"
            onClick={clearSearches}>
            {t('label.clear')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default MarketplaceSearchBar;
