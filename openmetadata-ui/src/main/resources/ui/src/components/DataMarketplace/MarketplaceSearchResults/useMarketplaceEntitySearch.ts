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
 * Entities matching a marketplace query, through NLQ when the toggle is on and
 * plain ES otherwise. Scoped to the caller's index: a list page searches only
 * what its own list holds, the overview spans both.
 */
export const useMarketplaceEntitySearch = (
  query: string,
  searchIndex: SearchIndex = SearchIndex.MARKETPLACE
) => {
  const spansBoth = searchIndex === SearchIndex.MARKETPLACE;
  const wantsDataProducts =
    spansBoth || searchIndex === SearchIndex.DATA_PRODUCT;
  const wantsDomains = spansBoth || searchIndex === SearchIndex.DOMAIN;
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
            searchIndex,
          });
          if (isStale()) {
            return;
          }

          // The union of every search source has no common `entityType`, so
          // narrow once here rather than at each use.
          const hits = res.hits.hits.map(
            (hit) => hit._source as unknown as { entityType?: string }
          );
          // Only a combined index needs splitting by type; a scoped one returns
          // that type alone, and filtering it would depend on a discriminator
          // the response need not carry.
          const ofType = (entityType: SearchIndex) =>
            (spansBoth
              ? hits.filter((hit) => hit.entityType === entityType)
              : hits
            ).slice(0, PAGE_SIZE);

          setDataProducts(
            wantsDataProducts
              ? (ofType(SearchIndex.DATA_PRODUCT) as unknown as DataProduct[])
              : []
          );
          setDomains(
            wantsDomains
              ? (ofType(SearchIndex.DOMAIN) as unknown as Domain[])
              : []
          );
        } else {
          const run = (index: SearchIndex) =>
            searchQuery({
              query: value,
              pageNumber: INITIAL_PAGING_VALUE,
              pageSize: PAGE_SIZE,
              searchIndex: index,
            });
          const [dpRes, domainRes] = await Promise.all([
            wantsDataProducts ? run(SearchIndex.DATA_PRODUCT) : undefined,
            wantsDomains ? run(SearchIndex.DOMAIN) : undefined,
          ]);
          if (isStale()) {
            return;
          }

          setDataProducts(
            (dpRes?.hits.hits.map((hit) => hit._source) ?? []) as DataProduct[]
          );
          setDomains(
            (domainRes?.hits.hits.map((hit) => hit._source) ?? []) as Domain[]
          );
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
    [isNLPEnabled, isNLPActive, searchIndex, spansBoth, wantsDataProducts, wantsDomains]
  );

  useEffect(() => {
    fetchResults(query);
  }, [query, fetchResults]);

  return { dataProducts, domains, isSearching };
};
