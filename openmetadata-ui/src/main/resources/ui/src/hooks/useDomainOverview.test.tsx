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
import { SearchIndex } from '../enums/search.enum';
import { queryClient } from '../queryClient';
import { getAllDomainsWithAssetsCount } from '../rest/domainAPI';
import { searchQuery } from '../rest/searchAPI';
import {
  OverviewFilter,
  UNOWNED_QUERY_FILTER,
  useDomainOverview,
} from './useDomainOverview';

jest.mock('../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../rest/domainAPI', () => ({
  getAllDomainsWithAssetsCount: jest.fn(),
}));

const mockSearchQuery = searchQuery as jest.MockedFunction<typeof searchQuery>;
const mockCounts = getAllDomainsWithAssetsCount as jest.MockedFunction<
  typeof getAllDomainsWithAssetsCount
>;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const domain = (name: string, owner?: string) => ({
  _source: {
    fullyQualifiedName: name,
    id: `id-${name}`,
    name,
    owners: owner ? [{ id: owner, name: owner, type: 'user' }] : [],
  },
});

// The page in hand: two domains, one unowned and one empty. The estate behind
// it is much larger — which is exactly what the chips used to miss.
const PAGE = [domain('finance', 'dale'), domain('marketing')];
const COUNTS = {
  finance: 12,
  marketing: 0,
  ops: 0,
  risk: 4,
  sales: 0,
};
const UNOWNED_TOTAL = 7;

/** Size-0 calls are the count queries; anything else is a page. */
const respond = (page = PAGE) =>
  mockSearchQuery.mockImplementation((request) =>
    Promise.resolve({
      hits: {
        hits: request.pageSize === 0 ? [] : page,
        total: { value: request.pageSize === 0 ? UNOWNED_TOTAL : page.length },
      },
    } as never)
  );

describe('useDomainOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    mockCounts.mockResolvedValue(COUNTS);
    respond();
  });

  it('joins each listed domain to its asset count', async () => {
    const { result } = renderHook(() => useDomainOverview(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(
      result.current.domains.map((entry) => [entry.name, entry.assetCount])
    ).toEqual([
      ['finance', 12],
      ['marketing', 0],
    ]);
  });

  // The chips counted "no owner" and "empty" over the ten rows fetched while
  // "All" was the estate total, so the three never described the same set.
  it('counts every bucket across the estate, not the page in hand', async () => {
    const { result } = renderHook(() => useDomainOverview(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.totalCount).toBe(5);
    expect(result.current.emptyCount).toBe(3);
    expect(result.current.unownedCount).toBe(UNOWNED_TOTAL);
    expect(mockSearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        pageSize: 0,
        queryFilter: UNOWNED_QUERY_FILTER,
        searchIndex: SearchIndex.DOMAIN,
      })
    );
  });

  it('asks the server for the unowned bucket rather than filtering the page', async () => {
    const { result } = renderHook(
      () => useDomainOverview(OverviewFilter.NO_OWNER),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockSearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        pageSize: 10,
        queryFilter: UNOWNED_QUERY_FILTER,
      })
    );
  });

  // Asset counts are not on the search document, so "empty" is resolved
  // through the count map and fetched by name.
  it('fetches the empty bucket by the FQNs the count map reports as empty', async () => {
    const { result } = renderHook(
      () => useDomainOverview(OverviewFilter.EMPTY),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const pageRequest = mockSearchQuery.mock.calls
      .map(([request]) => request)
      .find((request) => request.pageSize !== 0);

    expect(JSON.stringify(pageRequest?.queryFilter)).toContain(
      '"terms":{"fullyQualifiedName":["marketing","ops","sales"]}'
    );
  });

  it('keeps the previous rows on screen while a bucket switch loads', async () => {
    const { result, rerender } = renderHook(
      ({ filter }) => useDomainOverview(filter),
      { initialProps: { filter: OverviewFilter.ALL }, wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockSearchQuery.mockReturnValue(new Promise(() => undefined));
    rerender({ filter: OverviewFilter.NO_OWNER });

    await waitFor(() => expect(result.current.isFetching).toBe(true));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.domains).toHaveLength(2);
  });

  it('keeps the derived rows referentially stable across re-renders', async () => {
    const { result, rerender } = renderHook(() => useDomainOverview(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const settled = result.current.domains;
    rerender();

    expect(result.current.domains).toBe(settled);
  });

  it('surfaces a failed fetch instead of reporting an empty estate', async () => {
    mockCounts.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useDomainOverview(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
