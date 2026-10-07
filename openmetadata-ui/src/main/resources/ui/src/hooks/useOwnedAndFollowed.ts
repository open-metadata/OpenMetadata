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
import { SearchIndex } from '../enums/search.enum';
import { searchQuery } from '../rest/searchAPI';
import { getTermQuery } from '../utils/SearchPureUtils';

const DAY_MS = 24 * 60 * 60 * 1000;

export const CHANGE_WINDOW_DAYS = 7;
const PAGE_SIZE = 5;
const TTL_MS = 60_000;

export const OWNED_ASSETS_QUERY_KEY = ['landingPage', 'widgets', 'ownedAssets'];
export const FOLLOWED_ASSETS_QUERY_KEY = [
  'landingPage',
  'widgets',
  'followedAssets',
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
  owned: TrackedAsset[];
  followed: TrackedAsset[];
  /** Followed assets touched inside the window — the card's headline number. */
  changedCount: number;
  isLoading: boolean;
  isError: boolean;
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
) => {
  // Sorted newest-first because the card only has room for PAGE_SIZE rows: the
  // assets worth surfacing in that slice are the ones that just moved, which is
  // also what the "recently moved" summary above the list claims to describe.
  const response = await searchQuery({
    pageNumber: 1,
    pageSize: PAGE_SIZE,
    queryFilter: getTermQuery(filter),
    searchIndex,
    sortField: 'updatedAt',
    sortOrder: 'desc',
  });

  return (response.hits?.hits ?? []) as unknown as SearchHit[];
};

/**
 * The assets a user owns and the ones they follow, flagged with whether each
 * moved inside the change window.
 *
 * `updatedAt` is the only change signal on the search document, so this reports
 * *that* an asset changed, not what changed about it — distinguishing a schema
 * edit from a lost certification needs the change-event history.
 */
export const useOwnedAndFollowed = (userId?: string): OwnedAndFollowed => {
  const since = Date.now() - CHANGE_WINDOW_DAYS * DAY_MS;
  const enabled = Boolean(userId);

  const [ownedQuery, followedQuery] = useQueries({
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
    ],
  });

  const owned = toAssets(ownedQuery.data ?? [], since);
  const followed = toAssets(followedQuery.data ?? [], since);

  return {
    changedCount: followed.filter((asset) => asset.hasChanged).length,
    followed,
    isError: ownedQuery.isError || followedQuery.isError,
    // Disabled queries stay pending forever, so gate on `enabled` too or the
    // card would sit in a permanent skeleton before the user resolves.
    isLoading: enabled && (ownedQuery.isPending || followedQuery.isPending),
    owned,
  };
};
