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

import { useCallback, useRef, useState } from 'react';
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

const EMPTY: Buckets = { dataProducts: [], domains: [] };

const viaNlq = async (query: string): Promise<Buckets> => {
  const res = await nlqSearch({
    query,
    pageNumber: INITIAL_PAGING_VALUE,
    pageSize: PAGE_SIZE * 2,
    searchIndex: SearchIndex.MARKETPLACE,
  });

  const hits = res.hits.hits;

  return {
    dataProducts: hits
      .filter((h) => h._source.entityType === SearchIndex.DATA_PRODUCT)
      .slice(0, PAGE_SIZE)
      .map((h) => h._source as unknown as DataProduct),
    domains: hits
      .filter((h) => h._source.entityType === SearchIndex.DOMAIN)
      .slice(0, PAGE_SIZE)
      .map((h) => h._source as unknown as Domain),
  };
};

const viaSearch = async (query: string): Promise<Buckets> => {
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

  return {
    dataProducts: dpRes.hits.hits.map((hit) => hit._source) as DataProduct[],
    domains: domainRes.hits.hits.map((hit) => hit._source) as Domain[],
  };
};

/**
 * Domains and data products matching a marketplace query, through NLQ when the
 * toggle is on and plain ES otherwise. `search` reads the toggle when called
 * instead of subscribing to it, so flipping the toggle never runs a query by
 * itself: as on Explore, NLQ waits for Enter.
 */
export const useMarketplaceEntitySearch = () => {
  const [dataProducts, setDataProducts] = useState<DataProduct[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // Only the newest query may write state; NLQ latency is variable.
  const requestIdRef = useRef(0);

  const search = useCallback(async (value: string) => {
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
      const { isNLPEnabled, isNLPActive } = useSearchStore.getState();
      const fetcher = isNLPEnabled && isNLPActive ? viaNlq : viaSearch;
      const buckets = await fetcher(value);
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
  }, []);

  return { dataProducts, domains, isSearching, search };
};
