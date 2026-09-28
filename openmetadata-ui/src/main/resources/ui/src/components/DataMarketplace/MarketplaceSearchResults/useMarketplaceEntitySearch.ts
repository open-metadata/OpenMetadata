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
import { INITIAL_PAGING_VALUE } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../generated/entity/domains/domain';
import { useSearchStore } from '../../../hooks/useSearchStore';
import { nlqSearch, searchQuery } from '../../../rest/searchAPI';

const PAGE_SIZE = 5;

/**
 * Domains and data products matching a marketplace query, through NLQ when the
 * toggle is on and plain ES otherwise. The marketplace pages have no list to
 * fall back on, so these results are what the search shows.
 */
export const useMarketplaceEntitySearch = (query: string) => {
  const { isNLPEnabled, isNLPActive } = useSearchStore();
  const [dataProducts, setDataProducts] = useState<DataProduct[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // Only the newest query may write state; NLQ latency is variable.
  const requestIdRef = useRef(0);

  const fetchResults = useCallback(
    async (value: string) => {
      const requestId = ++requestIdRef.current;
      const isStale = () => requestId !== requestIdRef.current;

      if (!value.trim()) {
        setDataProducts([]);
        setDomains([]);
        setIsSearching(false);

        return;
      }
      setIsSearching(true);
      try {
        if (isNLPEnabled && isNLPActive) {
          const res = await nlqSearch({
            query: value,
            pageNumber: INITIAL_PAGING_VALUE,
            pageSize: PAGE_SIZE * 2,
            searchIndex: SearchIndex.MARKETPLACE,
          });
          if (isStale()) {
            return;
          }

          // The union of every search source has no common `entityType`, so
          // narrow once here rather than at each use.
          const hits = res.hits.hits.map(
            (hit) => hit._source as unknown as { entityType?: string }
          );
          setDataProducts(
            hits
              .filter((hit) => hit.entityType === SearchIndex.DATA_PRODUCT)
              .slice(0, PAGE_SIZE) as unknown as DataProduct[]
          );
          setDomains(
            hits
              .filter((hit) => hit.entityType === SearchIndex.DOMAIN)
              .slice(0, PAGE_SIZE) as unknown as Domain[]
          );
        } else {
          const [dpRes, domainRes] = await Promise.all([
            searchQuery({
              query: value,
              pageNumber: INITIAL_PAGING_VALUE,
              pageSize: PAGE_SIZE,
              searchIndex: SearchIndex.DATA_PRODUCT,
            }),
            searchQuery({
              query: value,
              pageNumber: INITIAL_PAGING_VALUE,
              pageSize: PAGE_SIZE,
              searchIndex: SearchIndex.DOMAIN,
            }),
          ]);
          if (isStale()) {
            return;
          }

          setDataProducts(
            dpRes.hits.hits.map((hit) => hit._source) as DataProduct[]
          );
          setDomains(domainRes.hits.hits.map((hit) => hit._source) as Domain[]);
        }
      } catch {
        if (isStale()) {
          return;
        }
        setDataProducts([]);
        setDomains([]);
      } finally {
        if (!isStale()) {
          setIsSearching(false);
        }
      }
    },
    [isNLPEnabled, isNLPActive]
  );

  useEffect(() => {
    fetchResults(query);
  }, [query, fetchResults]);

  return { dataProducts, domains, isSearching };
};
