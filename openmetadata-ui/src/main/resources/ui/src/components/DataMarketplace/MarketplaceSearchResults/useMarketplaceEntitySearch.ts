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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { INITIAL_PAGING_VALUE } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../generated/entity/domains/domain';
import { useSearchStore } from '../../../hooks/useSearchStore';
import { nlqSearch, searchQuery } from '../../../rest/searchAPI';

const PAGE_SIZE = 5;

interface Buckets {
  dataProducts: DataProduct[];
  domains: Domain[];
}

interface Scope {
  searchIndex: SearchIndex;
  /** A combined index returns both types and has to be split by entityType. */
  spansBoth: boolean;
  wantsDataProducts: boolean;
  wantsDomains: boolean;
}

const EMPTY: Buckets = { dataProducts: [], domains: [] };

const viaNlq = async (query: string, scope: Scope): Promise<Buckets> => {
  const res = await nlqSearch({
    query,
    pageNumber: INITIAL_PAGING_VALUE,
    pageSize: PAGE_SIZE * 2,
    searchIndex: scope.searchIndex,
  });

  // The union of every search source has no common `entityType`, so narrow
  // once here rather than at each use.
  const hits = res.hits.hits.map(
    (hit) => hit._source as unknown as { entityType?: string }
  );
  // A scoped index returns that type alone, and filtering it would depend on a
  // discriminator the response need not carry.
  const ofType = (entityType: SearchIndex) =>
    (scope.spansBoth
      ? hits.filter((hit) => hit.entityType === entityType)
      : hits
    ).slice(0, PAGE_SIZE);

  return {
    dataProducts: scope.wantsDataProducts
      ? (ofType(SearchIndex.DATA_PRODUCT) as unknown as DataProduct[])
      : [],
    domains: scope.wantsDomains
      ? (ofType(SearchIndex.DOMAIN) as unknown as Domain[])
      : [],
  };
};

const viaSearch = async (query: string, scope: Scope): Promise<Buckets> => {
  const run = (searchIndex: SearchIndex) =>
    searchQuery({
      query,
      pageNumber: INITIAL_PAGING_VALUE,
      pageSize: PAGE_SIZE,
      searchIndex,
    });

  const [dataProductRes, domainRes] = await Promise.all([
    scope.wantsDataProducts ? run(SearchIndex.DATA_PRODUCT) : undefined,
    scope.wantsDomains ? run(SearchIndex.DOMAIN) : undefined,
  ]);

  return {
    dataProducts: (dataProductRes?.hits.hits.map((hit) => hit._source) ??
      []) as DataProduct[],
    domains: (domainRes?.hits.hits.map((hit) => hit._source) ?? []) as Domain[],
  };
};

/**
 * Entities matching a marketplace query, through NLQ when the toggle is on and
 * plain ES otherwise. Scoped to the caller's index: a list page searches only
 * what its own list holds, the overview spans both.
 */
export const useMarketplaceEntitySearch = (
  query: string,
  searchIndex: SearchIndex = SearchIndex.MARKETPLACE
) => {
  const { isNLPEnabled, isNLPActive } = useSearchStore();
  const [dataProducts, setDataProducts] = useState<DataProduct[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // Only the newest query may write state; NLQ latency is variable.
  const requestIdRef = useRef(0);

  const scope = useMemo<Scope>(() => {
    const spansBoth = searchIndex === SearchIndex.MARKETPLACE;

    return {
      searchIndex,
      spansBoth,
      wantsDataProducts: spansBoth || searchIndex === SearchIndex.DATA_PRODUCT,
      wantsDomains: spansBoth || searchIndex === SearchIndex.DOMAIN,
    };
  }, [searchIndex]);

  const fetchResults = useCallback(
    async (value: string) => {
      const requestId = ++requestIdRef.current;
      const isStale = () => requestId !== requestIdRef.current;
      const apply = (buckets: Buckets) => {
        setDataProducts(buckets.dataProducts);
        setDomains(buckets.domains);
      };

      if (!value.trim()) {
        apply(EMPTY);
        setIsSearching(false);

        return;
      }

      setIsSearching(true);
      try {
        const fetcher = isNLPEnabled && isNLPActive ? viaNlq : viaSearch;
        const buckets = await fetcher(value, scope);
        if (!isStale()) {
          apply(buckets);
        }
      } catch {
        if (!isStale()) {
          apply(EMPTY);
        }
      } finally {
        if (!isStale()) {
          setIsSearching(false);
        }
      }
    },
    [isNLPEnabled, isNLPActive, scope]
  );

  useEffect(() => {
    fetchResults(query);
  }, [query, fetchResults]);

  return { dataProducts, domains, isSearching };
};
