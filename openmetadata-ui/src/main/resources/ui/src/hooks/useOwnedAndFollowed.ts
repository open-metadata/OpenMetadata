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

import { useQueries } from '@tanstack/react-query';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { searchQuery } from '../rest/searchAPI';
import { getTermQuery } from '../utils/SearchPureUtils';

const DAY_MS = 24 * 60 * 60 * 1000;

export const CHANGE_WINDOW_DAYS = 7;
const PAGE_SIZE = 5;
const TTL_MS = 60_000;

// Column documents inherit their table's owners and followers, so without this
// one owned or followed table comes back as a row per column — and those rows
// can crowd the table itself out of the five on screen.
const EXCLUDE_COLUMNS = { entityType: EntityType.TABLE_COLUMN };

export const OWNED_ASSETS_QUERY_KEY = ['landingPage', 'widgets', 'ownedAssets'];
export const FOLLOWED_ASSETS_QUERY_KEY = [
  'landingPage',
  'widgets',
  'followedAssets',
];
export const CHANGED_FOLLOWED_COUNT_QUERY_KEY = [
  'landingPage',
  'widgets',
  'changedFollowedCount',
];

export interface TrackedAsset {
  id: string;
  name: string;
  fullyQualifiedName: string;
  entityType: string;
  serviceType?: string;
  /** True when the asset was touched inside the change window. */
  hasChanged: boolean;
}

export interface OwnedAndFollowed {
  /** The first {@link PAGE_SIZE} owned assets, newest change first. */
  owned: TrackedAsset[];
  /** The first {@link PAGE_SIZE} followed assets, newest change first. */
  followed: TrackedAsset[];
  /** Every asset the user owns — not just the rows on screen. */
  ownedTotal: number;
  /** Every asset the user follows — not just the rows on screen. */
  followedTotal: number;
  /**
   * Followed assets touched inside the window, counted by the search engine
   * across all of them — the card's headline number.
   */
  changedCount: number;
  isLoading: boolean;
  isError: boolean;
  /** Re-runs whichever of the searches failed. */
  refetch: () => void;
}

interface SearchHit {
  _source: {
    id: string;
    name: string;
    displayName?: string;
    fullyQualifiedName: string;
    entityType: string;
    serviceType?: string;
    updatedAt?: number;
  };
}

interface TrackedPage {
  hits: SearchHit[];
  total: number;
}

const toAssets = (hits: SearchHit[], since: number): TrackedAsset[] =>
  hits.map(({ _source: source }) => ({
    entityType: source.entityType,
    fullyQualifiedName: source.fullyQualifiedName,
    hasChanged: (source.updatedAt ?? 0) >= since,
    id: source.id,
    name: source.displayName || source.name,
    serviceType: source.serviceType,
  }));

const runSearch = async (
  searchIndex: SearchIndex,
  filter: Record<string, string | string[]>
): Promise<TrackedPage> => {
  // Sorted newest-first because the card only has room for PAGE_SIZE rows: the
  // assets worth surfacing in that slice are the ones that just moved, which is
  // also what the "recently moved" summary above the list claims to describe.
  const response = await searchQuery({
    pageNumber: 1,
    pageSize: PAGE_SIZE,
    queryFilter: getTermQuery(filter, 'must', undefined, {
      mustNotTerms: EXCLUDE_COLUMNS,
    }),
    searchIndex,
    sortField: 'updatedAt',
    sortOrder: 'desc',
    trackTotalHits: true,
  });

  return {
    hits: (response.hits?.hits ?? []) as unknown as SearchHit[],
    total: response.hits?.total?.value ?? 0,
  };
};

/**
 * How many followed assets changed inside the window, as a size-0 count: the
 * five rows on screen are a sample, and counting changes among them alone
 * would cap the headline at five.
 */
const countChangedFollowed = async (
  userId: string,
  since: number
): Promise<number> => {
  const response = await searchQuery({
    pageNumber: 1,
    pageSize: 0,
    queryFilter: {
      query: {
        bool: {
          must: [
            { term: { followers: userId } },
            { range: { updatedAt: { gte: since } } },
          ],
          must_not: [{ term: EXCLUDE_COLUMNS }],
        },
      },
    },
    searchIndex: SearchIndex.ALL,
    trackTotalHits: true,
  });

  return response.hits?.total?.value ?? 0;
};

const windowStart = () => Date.now() - CHANGE_WINDOW_DAYS * DAY_MS;

/**
 * The assets a user owns and the ones they follow, flagged with whether each
 * moved inside the change window, plus the real totals behind both lists.
 *
 * `updatedAt` is the only change signal on the search document, so this reports
 * *that* an asset changed, not what changed about it — distinguishing a schema
 * edit from a lost certification needs the change-event history.
 */
export const useOwnedAndFollowed = (userId?: string): OwnedAndFollowed => {
  const since = windowStart();
  const enabled = Boolean(userId);

  const [ownedQuery, followedQuery, changedQuery] = useQueries({
    queries: [
      {
        enabled,
        queryFn: () =>
          runSearch(SearchIndex.DATA_ASSET, { 'owners.id': [userId ?? ''] }),
        queryKey: [...OWNED_ASSETS_QUERY_KEY, userId],
        staleTime: TTL_MS,
      },
      {
        enabled,
        queryFn: () =>
          runSearch(SearchIndex.ALL, { followers: [userId ?? ''] }),
        queryKey: [...FOLLOWED_ASSETS_QUERY_KEY, userId],
        staleTime: TTL_MS,
      },
      {
        enabled,
        // The window is computed when the request runs, not when the key is
        // built, so the key stays stable across renders.
        queryFn: () => countChangedFollowed(userId ?? '', windowStart()),
        queryKey: [...CHANGED_FOLLOWED_COUNT_QUERY_KEY, userId],
        staleTime: TTL_MS,
      },
    ],
  });

  const queries = [ownedQuery, followedQuery, changedQuery];

  return {
    changedCount: changedQuery.data ?? 0,
    followed: toAssets(followedQuery.data?.hits ?? [], since),
    followedTotal: followedQuery.data?.total ?? 0,
    isError: queries.some((query) => query.isError),
    // Disabled queries stay pending forever, so gate on `enabled` too or the
    // card would sit in a permanent skeleton before the user resolves.
    isLoading: enabled && queries.some((query) => query.isPending),
    owned: toAssets(ownedQuery.data?.hits ?? [], since),
    ownedTotal: ownedQuery.data?.total ?? 0,
    refetch: () =>
      queries
        .filter((query) => query.isError)
        .forEach((query) => void query.refetch()),
  };
};
