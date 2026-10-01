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
import { searchQuery } from '../rest/searchAPI';
import React from 'react';
import { queryClient } from '../queryClient';
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

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useOwnedAndFollowed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it('flags only the assets touched inside the change window', async () => {
    const recent = Date.now() - DAY_MS;
    const old = Date.now() - (CHANGE_WINDOW_DAYS + 3) * DAY_MS;
    mockSearchQuery.mockResolvedValue({
      hits: { hits: [hit('fresh', recent), hit('stale', old)] },
    } as never);

    const { result } = renderHook(() => useOwnedAndFollowed(USER_ID), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.followed.map((a) => a.hasChanged)).toEqual([
      true,
      false,
    ]);
    expect(result.current.changedCount).toBe(1);
  });

  it('treats an asset with no updatedAt as unchanged', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: { hits: [hit('unknown')] },
    } as never);

    const { result } = renderHook(() => useOwnedAndFollowed(USER_ID), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.changedCount).toBe(0);
  });

  it('counts changes among followed assets only, not owned ones', async () => {
    const recent = Date.now() - DAY_MS;
    mockSearchQuery
      .mockResolvedValueOnce({
        hits: { hits: [hit('owned-a', recent), hit('owned-b', recent)] },
      } as never)
      .mockResolvedValueOnce({
        hits: { hits: [hit('followed', recent)] },
      } as never);

    const { result } = renderHook(() => useOwnedAndFollowed(USER_ID), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.owned).toHaveLength(2);
    // The headline number is about what the user follows, not what they own.
    expect(result.current.changedCount).toBe(1);
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
