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
import { getAllDataProductsWithAssetsCount } from '../rest/dataProductAPI';
import { postAggregateFieldOptions } from '../rest/miscAPI';
import { searchQuery } from '../rest/searchAPI';
import { useDataProducts } from './useDataProducts';
import { OverviewFilter, UNOWNED_QUERY_FILTER } from './useDomainOverview';

jest.mock('../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../rest/dataProductAPI', () => ({
  getAllDataProductsWithAssetsCount: jest.fn(),
}));

jest.mock('../rest/miscAPI', () => ({
  postAggregateFieldOptions: jest.fn(),
}));

const mockSearchQuery = searchQuery as jest.MockedFunction<typeof searchQuery>;
const mockCounts = getAllDataProductsWithAssetsCount as jest.MockedFunction<
  typeof getAllDataProductsWithAssetsCount
>;
const mockAggregate = postAggregateFieldOptions as jest.MockedFunction<
  typeof postAggregateFieldOptions
>;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

// The data-product search document leaves `assets` out entirely — reading a
// length off it is what put every product at zero.
const product = (name: string, owner?: string) => ({
  _source: {
    domains: [{ displayName: 'Retail', name: 'retail' }],
    fullyQualifiedName: name,
    id: `id-${name}`,
    name,
    owners: owner ? [{ name: owner }] : [],
    updatedAt: 100,
  },
});

const PAGE = [product('campaign', 'dale'), product('orphan')];
const COUNTS = { campaign: 56, fraud: 0, orphan: 0, signals: 3 };
const UNOWNED_TOTAL = 9;

const respond = (page = PAGE) =>
  mockSearchQuery.mockImplementation((request) =>
    Promise.resolve({
      hits: {
        hits: request.pageSize === 0 ? [] : page,
        total: { value: request.pageSize === 0 ? UNOWNED_TOTAL : page.length },
      },
    } as never)
  );

const domainBuckets = (...keys: string[]) =>
  ({
    data: {
      aggregations: {
        'sterms#domains.fullyQualifiedName': {
          buckets: keys.map((key) => ({ doc_count: 1, key })),
        },
      },
    },
  } as never);

describe('useDataProducts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    mockCounts.mockResolvedValue(COUNTS);
    mockAggregate.mockResolvedValue(domainBuckets('retail', 'risk', 'ops'));
    respond();
  });

  it('reads asset counts from the count map, not the search document', async () => {
    const { result } = renderHook(() => useDataProducts(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(
      result.current.products.map((entry) => [entry.name, entry.assetCount])
    ).toEqual([
      ['campaign', 56],
      ['orphan', 0],
    ]);
  });

  it('counts every bucket and every domain across the estate', async () => {
    const { result } = renderHook(() => useDataProducts(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.totalCount).toBe(4);
    expect(result.current.emptyCount).toBe(2);
    expect(result.current.unownedCount).toBe(UNOWNED_TOTAL);
    // Distinct domains over every product, not over the page's one domain.
    expect(result.current.domainCount).toBe(3);
    expect(mockAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldName: 'domains.fullyQualifiedName',
        index: SearchIndex.DATA_PRODUCT,
      })
    );
  });

  it('queries the selected bucket server-side', async () => {
    const { result } = renderHook(
      () => useDataProducts(OverviewFilter.NO_OWNER),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockSearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        pageSize: 10,
        queryFilter: UNOWNED_QUERY_FILTER,
        searchIndex: SearchIndex.DATA_PRODUCT,
      })
    );
  });

  it('fetches the empty bucket by the FQNs the count map reports as empty', async () => {
    const { result } = renderHook(() => useDataProducts(OverviewFilter.EMPTY), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const pageRequest = mockSearchQuery.mock.calls
      .map(([request]) => request)
      .find((request) => request.pageSize !== 0);

    expect(JSON.stringify(pageRequest?.queryFilter)).toContain(
      '"terms":{"fullyQualifiedName":["fraud","orphan"]}'
    );
  });

  it('keeps the derived rows referentially stable across re-renders', async () => {
    const { result, rerender } = renderHook(() => useDataProducts(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const settled = result.current.products;
    rerender();

    // The widget sorts in a memo keyed on this array; a fresh one per render
    // meant that memo never held.
    expect(result.current.products).toBe(settled);
  });

  it('surfaces a failed fetch instead of reporting no products', async () => {
    mockCounts.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useDataProducts(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
