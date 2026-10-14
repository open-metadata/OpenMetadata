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
import { SearchIndex } from '../enums/search.enum';
import { Domain } from '../generated/entity/domains/domain';
import { getAllDomainsWithAssetsCount } from '../rest/domainAPI';
import { searchQuery } from '../rest/searchAPI';
import { getEntityName } from '../utils/EntityNameUtils';

export const DOMAIN_OVERVIEW_QUERY_KEY = ['landingPage', 'widgets', 'domains'];
const TTL_MS = 5 * 60 * 1000;

export const OVERVIEW_PAGE_SIZE = 10;

/**
 * The ownership buckets the Domains and Data Products cards filter by. Each
 * one is answered by the server, not by filtering the rows already on screen —
 * those are one page of the estate, and a bucket counted or filtered over a
 * page describes the page.
 */
export enum OverviewFilter {
  ALL = 'all',
  NO_OWNER = 'noOwner',
  EMPTY = 'empty',
}

/** `owners` is a nested field on both indexes, so "has none" needs the nested form. */
export const UNOWNED_QUERY_FILTER = {
  query: {
    bool: {
      must_not: [
        {
          nested: { path: 'owners', query: { exists: { field: 'owners.id' } } },
        },
      ],
    },
  },
};

/**
 * The FQNs a bucket is restricted to, by name. Asset counts are not on either
 * search document, so "empty" is resolved from the count map first and the
 * page fetched by FQN — capped at one page, which is all the card lists, and
 * which keeps the request URL bounded however many entities are empty.
 */
export const fqnQueryFilter = (fqns: string[]) => ({
  query: {
    bool: { must: [{ terms: { fullyQualifiedName: fqns } }] },
  },
});

/** FQNs whose count is zero — every entity is in the map, empty ones included. */
export const emptyFqnsOf = (counts: Record<string, number>): string[] =>
  Object.entries(counts)
    .filter(([, count]) => count === 0)
    .map(([fqn]) => fqn)
    .sort((a, b) => a.localeCompare(b));

/** The documents of one page, untyped — each hook reads its own entity shape. */
export interface OverviewPage {
  sources: unknown[];
}

/** One page for a bucket; "empty" with nothing empty needs no request at all. */
export const fetchOverviewPage = async (
  searchIndex: SearchIndex.DOMAIN | SearchIndex.DATA_PRODUCT,
  filter: OverviewFilter,
  emptyFqns: string[]
): Promise<OverviewPage> => {
  if (filter === OverviewFilter.EMPTY && emptyFqns.length === 0) {
    return { sources: [] };
  }
  const queryFilter = {
    [OverviewFilter.ALL]: undefined,
    [OverviewFilter.NO_OWNER]: UNOWNED_QUERY_FILTER,
    [OverviewFilter.EMPTY]: fqnQueryFilter(
      emptyFqns.slice(0, OVERVIEW_PAGE_SIZE)
    ),
  }[filter];

  const response = await searchQuery({
    pageNumber: 1,
    pageSize: OVERVIEW_PAGE_SIZE,
    query: '',
    queryFilter,
    searchIndex,
  });

  return { sources: response.hits.hits.map((hit) => hit._source) };
};

/** How many entities have no owner, across the estate — a count, so no rows. */
export const fetchUnownedCount = async (
  searchIndex: SearchIndex.DOMAIN | SearchIndex.DATA_PRODUCT
): Promise<number> => {
  const response = await searchQuery({
    pageNumber: 1,
    pageSize: 0,
    query: '',
    queryFilter: UNOWNED_QUERY_FILTER,
    searchIndex,
  });

  return response.hits.total.value;
};

export interface DomainSummary {
  id: string;
  name: string;
  fullyQualifiedName: string;
  ownerName?: string;
  assetCount: number;
}

export interface DomainOverview {
  /** The page for the selected bucket. */
  domains: DomainSummary[];
  /** Every domain, not just the page rendered. */
  totalCount: number;
  /** Estate-wide, from a count query rather than the page in hand. */
  unownedCount: number;
  /** Estate-wide, from the asset-count map. */
  emptyCount: number;
  /** First load only — a bucket switch keeps the previous rows on screen. */
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Domains with their asset counts, and the size of each ownership bucket.
 *
 * The counts come from `/domains/assets/counts`, which returns the whole map in
 * one call — the same source the OSS Domains widget uses, so the numbers agree
 * between the two surfaces. The map lists every domain, so it also gives the
 * total and the "empty" bucket; "no owner" is a size-0 search.
 */
export const useDomainOverview = (
  filter: OverviewFilter = OverviewFilter.ALL
): DomainOverview => {
  const [countsQuery, unownedQuery] = useQueries({
    queries: [
      {
        queryFn: getAllDomainsWithAssetsCount,
        queryKey: [...DOMAIN_OVERVIEW_QUERY_KEY, 'counts'],
        staleTime: TTL_MS,
      },
      {
        queryFn: () => fetchUnownedCount(SearchIndex.DOMAIN),
        queryKey: [...DOMAIN_OVERVIEW_QUERY_KEY, 'unowned'],
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
    // loads, instead of dropping the card back to its first-load skeleton —
    // which unmounted the chips mid-interaction and lost their focus.
    placeholderData: keepPreviousData,
    queryFn: () => fetchOverviewPage(SearchIndex.DOMAIN, filter, emptyFqns),
    queryKey: [
      ...DOMAIN_OVERVIEW_QUERY_KEY,
      'list',
      filter,
      needsCounts ? emptyFqns.slice(0, OVERVIEW_PAGE_SIZE) : [],
    ],
    staleTime: TTL_MS,
  });

  const queries = [countsQuery, unownedQuery, listQuery];
  const listData = listQuery.data;

  // Memoised on the query results, so a re-render with nothing new hands the
  // widget the same arrays and its own memos hold.
  const domains = useMemo<DomainSummary[]>(
    () =>
      ((listData?.sources ?? []) as Domain[]).map((source) => {
        return {
          assetCount: counts?.[source.fullyQualifiedName ?? ''] ?? 0,
          fullyQualifiedName: source.fullyQualifiedName ?? '',
          id: source.id,
          name: getEntityName(source),
          ownerName: source.owners?.length
            ? getEntityName(source.owners[0])
            : undefined,
        };
      }),
    [listData, counts]
  );

  return {
    domains,
    emptyCount: emptyFqns.length,
    isError: queries.some((query) => query.isError),
    isFetching: queries.some((query) => query.isFetching),
    isLoading: queries.some((query) => query.isPending),
    refetch: () =>
      queries.forEach((query) => {
        void query.refetch();
      }),
    totalCount: Object.keys(counts ?? {}).length,
    unownedCount: unownedQuery.data ?? 0,
  };
};
