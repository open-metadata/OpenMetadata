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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { getMetricTabAssets } from '../rest/metricTabsAPI';
import {
  fetchMetricLinkedAssetIds,
  METRIC_LINKED_ASSETS_PAGE_LIMIT,
  useMetricLinkedAssets,
} from './useMetricLinkedAssets';
import { metricObservabilityQueryKey } from './useMetricObservability';

jest.mock('../rest/metricTabsAPI', () => ({
  getMetricTabAssets: jest.fn(),
}));

const mockGetMetricTabAssets = getMetricTabAssets as jest.Mock;

const buildPage = (ids: string[], total: number) => ({
  data: ids.map((id) => ({
    asset: { id, type: 'table' },
    direction: 'unrelated',
  })),
  paging: { total },
});

const createWrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return Wrapper;
};

describe('fetchMetricLinkedAssetIds', () => {
  beforeEach(() => {
    mockGetMetricTabAssets.mockReset();
  });

  it('returns the ids of a single page without fetching further', async () => {
    mockGetMetricTabAssets.mockResolvedValueOnce(buildPage(['a', 'b'], 2));

    await expect(fetchMetricLinkedAssetIds('metric-id')).resolves.toEqual([
      'a',
      'b',
    ]);
    expect(mockGetMetricTabAssets).toHaveBeenCalledTimes(1);
  });

  it('fetches every remaining page when the metric links more assets than one page holds', async () => {
    const total = METRIC_LINKED_ASSETS_PAGE_LIMIT * 2 + 1;
    mockGetMetricTabAssets.mockImplementation(
      (_id: string, { offset }: { offset: number }) =>
        Promise.resolve(buildPage([`asset-${offset}`], total))
    );

    const ids = await fetchMetricLinkedAssetIds('metric-id');

    expect(mockGetMetricTabAssets).toHaveBeenCalledTimes(3);
    expect(mockGetMetricTabAssets).toHaveBeenCalledWith('metric-id', {
      limit: METRIC_LINKED_ASSETS_PAGE_LIMIT,
      offset: METRIC_LINKED_ASSETS_PAGE_LIMIT * 2,
    });
    expect(ids).toEqual([
      'asset-0',
      `asset-${METRIC_LINKED_ASSETS_PAGE_LIMIT}`,
      `asset-${METRIC_LINKED_ASSETS_PAGE_LIMIT * 2}`,
    ]);
  });
});

describe('useMetricLinkedAssets', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mockGetMetricTabAssets.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('does not fetch until the metric id is known', () => {
    const { result } = renderHook(() => useMetricLinkedAssets(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockGetMetricTabAssets).not.toHaveBeenCalled();
    expect(result.current.assetCount).toBe(0);
  });

  it('refetches linked assets and invalidates the health rollup on refresh', async () => {
    mockGetMetricTabAssets.mockResolvedValueOnce(buildPage(['a'], 1));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useMetricLinkedAssets('metric-id'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.assetIds).toEqual(['a']));

    mockGetMetricTabAssets.mockResolvedValueOnce(buildPage(['a', 'b'], 2));

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.assetCount).toBe(2));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: metricObservabilityQueryKey('metric-id'),
    });
  });
});
