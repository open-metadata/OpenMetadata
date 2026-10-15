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

import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { queryClient } from '../queryClient';
import { searchQuery } from '../rest/searchAPI';
import { getTermQuery } from '../utils/SearchPureUtils';
import { CHANGE_WINDOW_DAYS, useOwnedAndFollowed } from './useOwnedAndFollowed';

jest.mock('../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../utils/SearchPureUtils', () => ({
  getTermQuery: jest.fn((terms: unknown) => ({ terms })),
}));

const mockSearchQuery = searchQuery as jest.MockedFunction<typeof searchQuery>;

const DAY_MS = 24 * 60 * 60 * 1000;
const USER_ID = 'user-1';

const hit = (name: string, updatedAt?: number) => ({
  _source: {
    entityType: 'table',
    fullyQualifiedName: `svc.db.${name}`,
    id: name,
    name,
    serviceType: 'BigQuery',
    updatedAt,
  },
});

type Hit = ReturnType<typeof hit>;

/**
 * Answers the three searches by shape: the owned page (data-asset index), the
 * followed page (all index) and the size-0 changed count.
 */
const mockSearches = ({
  owned = [],
  followed = [],
  ownedTotal = owned.length,
  followedTotal = followed.length,
  changed = 0,
}: {
  owned?: Hit[];
  followed?: Hit[];
  ownedTotal?: number;
  followedTotal?: number;
  changed?: number;
}) =>
  mockSearchQuery.mockImplementation((async (request: {
    pageSize: number;
    searchIndex: SearchIndex;
  }) => {
    if (request.pageSize === 0) {
      return { hits: { hits: [], total: { value: changed } } };
    }

    return request.searchIndex === SearchIndex.DATA_ASSET
      ? { hits: { hits: owned, total: { value: ownedTotal } } }
      : { hits: { hits: followed, total: { value: followedTotal } } };
  }) as never);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const renderLoaded = async () => {
  const view = renderHook(() => useOwnedAndFollowed(USER_ID), { wrapper });
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));

  return view.result;
};

describe('useOwnedAndFollowed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it('flags only the assets touched inside the change window', async () => {
    const recent = Date.now() - DAY_MS;
    const old = Date.now() - (CHANGE_WINDOW_DAYS + 3) * DAY_MS;
    mockSearches({ followed: [hit('fresh', recent), hit('stale', old)] });

    const result = await renderLoaded();

    expect(result.current.followed.map((a) => a.hasChanged)).toEqual([
      true,
      false,
    ]);
  });

  it('treats an asset with no updatedAt as unchanged', async () => {
    mockSearches({ followed: [hit('unknown')] });

    const result = await renderLoaded();

    expect(result.current.followed[0].hasChanged).toBe(false);
  });

  // The totals used to be the length of the five-row page.
  it('reports the search totals, not the number of rows fetched', async () => {
    mockSearches({
      followed: [hit('f1')],
      followedTotal: 48,
      owned: [hit('o1'), hit('o2')],
      ownedTotal: 31,
    });

    const result = await renderLoaded();

    expect(result.current.owned).toHaveLength(2);
    expect(result.current).toMatchObject({ followedTotal: 48, ownedTotal: 31 });
    expect(mockSearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 5, trackTotalHits: true })
    );
  });

  // Counting changes among the five rows on screen capped the headline at five.
  it('counts changed followed assets with a size-0 search over the window', async () => {
    mockSearches({ changed: 12, followed: [hit('f1')] });

    const result = await renderLoaded();

    expect(result.current.changedCount).toBe(12);

    const countCall = mockSearchQuery.mock.calls
      .map(([request]) => request)
      .find((request) => request.pageSize === 0);
    const [followerTerm, range] = (
      countCall?.queryFilter as {
        query: { bool: { must: Array<Record<string, unknown>> } };
      }
    ).query.bool.must;

    expect(followerTerm).toEqual({ term: { followers: USER_ID } });
    expect(
      (range as { range: { updatedAt: { gte: number } } }).range.updatedAt.gte
    ).toBeLessThanOrEqual(Date.now() - CHANGE_WINDOW_DAYS * DAY_MS);
  });

  // Columns inherit their table's owners and followers; counted as assets, a
  // single followed table filled the list with its own columns.
  it('excludes column documents from the owned and followed pages', async () => {
    mockSearches({ followed: [hit('f1')] });

    await renderLoaded();

    expect(getTermQuery).toHaveBeenCalledTimes(2);
    expect(getTermQuery).toHaveBeenCalledWith(
      { 'owners.id': [USER_ID] },
      'must',
      undefined,
      { mustNotTerms: { entityType: EntityType.TABLE_COLUMN } }
    );
    expect(getTermQuery).toHaveBeenCalledWith(
      { followers: [USER_ID] },
      'must',
      undefined,
      { mustNotTerms: { entityType: EntityType.TABLE_COLUMN } }
    );
  });

  it('excludes column documents from the changed count', async () => {
    mockSearches({ changed: 1, followed: [hit('f1')] });

    await renderLoaded();

    const countCall = mockSearchQuery.mock.calls
      .map(([request]) => request)
      .find((request) => request.pageSize === 0);

    expect(
      (countCall?.queryFilter as { query: { bool: { must_not: unknown[] } } })
        .query.bool.must_not
    ).toEqual([{ term: { entityType: EntityType.TABLE_COLUMN } }]);
  });

  it('stays idle until the current user resolves', async () => {
    const { result } = renderHook(() => useOwnedAndFollowed(undefined), {
      wrapper,
    });

    // A disabled query is pending forever; the card must not sit in a skeleton.
    expect(result.current.isLoading).toBe(false);
    expect(mockSearchQuery).not.toHaveBeenCalled();
  });

  it('surfaces a failed search instead of reporting an empty list', async () => {
    mockSearchQuery.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useOwnedAndFollowed(USER_ID), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.owned).toEqual([]);
    expect(result.current.followed).toEqual([]);
  });
});
