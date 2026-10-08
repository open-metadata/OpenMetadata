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

import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { AGGREGATE_PAGE_SIZE_LARGE } from '../constants/constants';
import { SearchIndex } from '../enums/search.enum';
import { getAllDataProductsWithAssetsCount } from '../rest/dataProductAPI';
import { postAggregateFieldOptions } from '../rest/miscAPI';
import { getAggregations } from '../utils/ExplorePureUtils';
import {
  emptyFqnsOf,
  fetchOverviewPage,
  fetchUnownedCount,
  OverviewFilter,
  OVERVIEW_PAGE_SIZE,
} from './useDomainOverview';

export const DATA_PRODUCTS_QUERY_KEY = [
  'landingPage',
  'widgets',
  'dataProducts',
];
const TTL_MS = 5 * 60 * 1000;
const DOMAIN_FIELD = 'domains.fullyQualifiedName';

export interface DataProductSummary {
  id: string;
  name: string;
  fullyQualifiedName: string;
  domainName?: string;
  ownerName?: string;
  assetCount: number;
  /** Only ever compared, never formatted — so the epoch unit does not matter. */
  updatedAt: number;
}

export interface DataProductsOverview {
  /** The page for the selected bucket. */
  products: DataProductSummary[];
  /** Every data product, from the asset-count map. */
  totalCount: number;
  /** Estate-wide, from a count query rather than the page in hand. */
  unownedCount: number;
  /** Estate-wide, from the asset-count map. */
  emptyCount: number;
  /** Domains holding at least one data product, across the estate. */
  domainCount: number;
  /** First load only — a bucket switch keeps the previous rows on screen. */
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
}

interface DataProductSource {
  id: string;
  name: string;
  displayName?: string;
  fullyQualifiedName: string;
  domains?: Array<{ displayName?: string; name?: string }>;
  owners?: Array<{ displayName?: string; name?: string }>;
  updatedAt?: number;
}

const firstName = (
  refs?: Array<{ displayName?: string; name?: string }>
): string | undefined =>
  refs?.length ? refs[0].displayName || refs[0].name : undefined;

/** Distinct domains across every data product — a terms aggregation, not a page. */
const fetchDomainCount = async (): Promise<number> => {
  const response = await postAggregateFieldOptions({
    deleted: false,
    fieldName: DOMAIN_FIELD,
    index: SearchIndex.DATA_PRODUCT,
    size: AGGREGATE_PAGE_SIZE_LARGE,
  });

  return (
    getAggregations(response.data.aggregations ?? {})[DOMAIN_FIELD]?.buckets
      .length ?? 0
  );
};

/**
 * Data products with their domain, owner and asset count, and the size of each
 * ownership bucket.
 *
 * Asset counts come from `/dataProducts/assets/counts`: the data-product search
 * document deliberately leaves `assets` out, so reading a length off it put
 * every product at zero. The map is one request for the whole estate — the
 * source the OSS Data Products widget uses — and, since it lists every product,
 * it also gives the total and the "empty" bucket.
 */
export const useDataProducts = (
  filter: OverviewFilter = OverviewFilter.ALL
): DataProductsOverview => {
  const [countsQuery, unownedQuery, domainsQuery] = useQueries({
    queries: [
      {
        queryFn: getAllDataProductsWithAssetsCount,
        queryKey: [...DATA_PRODUCTS_QUERY_KEY, 'counts'],
        staleTime: TTL_MS,
      },
      {
        queryFn: () => fetchUnownedCount(SearchIndex.DATA_PRODUCT),
        queryKey: [...DATA_PRODUCTS_QUERY_KEY, 'unowned'],
        staleTime: TTL_MS,
      },
      {
        queryFn: fetchDomainCount,
        queryKey: [...DATA_PRODUCTS_QUERY_KEY, 'domains'],
        staleTime: TTL_MS,
      },
    ],
  });

  const counts = countsQuery.data;
  const emptyFqns = useMemo(() => emptyFqnsOf(counts ?? {}), [counts]);
  const needsCounts = filter === OverviewFilter.EMPTY;

  const listQuery = useQuery({
    // "Empty" is resolved through the count map, so it waits for it.
    enabled: !needsCounts || Boolean(counts),
    // A bucket switch keeps the previous rows on screen while the next page
    // loads, instead of dropping the card back to its first-load skeleton.
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchOverviewPage(SearchIndex.DATA_PRODUCT, filter, emptyFqns),
    queryKey: [
      ...DATA_PRODUCTS_QUERY_KEY,
      'list',
      filter,
      needsCounts ? emptyFqns.slice(0, OVERVIEW_PAGE_SIZE) : [],
    ],
    staleTime: TTL_MS,
  });

  const queries = [countsQuery, unownedQuery, domainsQuery, listQuery];
  const listData = listQuery.data;

  // Memoised on the query results, so a re-render with nothing new hands the
  // widget the same array and its sort memo holds.
  const products = useMemo<DataProductSummary[]>(
    () =>
      ((listData?.sources ?? []) as DataProductSource[]).map((source) => ({
        assetCount: counts?.[source.fullyQualifiedName] ?? 0,
        domainName: firstName(source.domains),
        fullyQualifiedName: source.fullyQualifiedName,
        id: source.id,
        name: source.displayName || source.name,
        ownerName: firstName(source.owners),
        updatedAt: source.updatedAt ?? 0,
      })),
    [listData, counts]
  );

  return {
    domainCount: domainsQuery.data ?? 0,
    emptyCount: emptyFqns.length,
    isError: queries.some((query) => query.isError),
    isFetching: queries.some((query) => query.isFetching),
    isLoading: queries.some((query) => query.isPending),
    products,
    refetch: () =>
      queries.forEach((query) => {
        void query.refetch();
      }),
    totalCount: Object.keys(counts ?? {}).length,
    unownedCount: unownedQuery.data ?? 0,
  };
};
