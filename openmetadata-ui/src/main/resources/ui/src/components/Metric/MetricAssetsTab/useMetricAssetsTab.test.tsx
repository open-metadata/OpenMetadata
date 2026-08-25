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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import {
  Direction,
  MetricAssetDirection,
} from '../../../generated/api/data/metricObservability';
import {
  getMetricTabAssetDetails,
  getMetricTabAssets,
  removeMetricTabAssets,
} from '../../../rest/metricTabsAPI';
import { useMetricAssetsCount, useMetricAssetsTab } from './useMetricAssetsTab';

jest.mock('../../../rest/metricTabsAPI', () => ({
  getMetricTabAssetDetails: jest.fn(),
  getMetricTabAssets: jest.fn(),
  removeMetricTabAssets: jest.fn(),
}));

const firstRelation: MetricAssetDirection = {
  affectsHealth: true,
  asset: {
    id: 'asset-1',
    name: 'orders',
    type: EntityType.TABLE,
    fullyQualifiedName: 'service.database.schema.orders',
  },
  direction: Direction.Upstream,
};
const secondRelation: MetricAssetDirection = {
  affectsHealth: false,
  asset: {
    id: 'asset-2',
    name: 'sales_dashboard',
    type: EntityType.DASHBOARD,
    fullyQualifiedName: 'service.sales_dashboard',
  },
  direction: Direction.Downstream,
};

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('useMetricAssetsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMetricTabAssetDetails as jest.Mock).mockResolvedValue({});
    (getMetricTabAssets as jest.Mock).mockImplementation(
      (_id: string, params: { offset?: number }) =>
        Promise.resolve({
          data: params.offset === 10 ? [secondRelation] : [firstRelation],
          paging: { limit: 10, offset: params.offset ?? 0, total: 20 },
        })
    );
  });

  it('sends paging, search, entity type, and direction to the server', async () => {
    const { result } = renderHook(
      () => useMetricAssetsTab({ metricFqn: 'revenue', metricId: 'metric-id' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.assets).toHaveLength(1));

    expect(getMetricTabAssets).toHaveBeenCalledWith(
      'metric-id',
      {
        direction: undefined,
        entityType: undefined,
        limit: 10,
        offset: 0,
        q: undefined,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    act(() => {
      result.current.setFilters({
        direction: Direction.Upstream,
        search: ' orders ',
        type: EntityType.TABLE,
      });
    });

    await waitFor(() =>
      expect(getMetricTabAssets).toHaveBeenLastCalledWith(
        'metric-id',
        {
          direction: Direction.Upstream,
          entityType: EntityType.TABLE,
          limit: 10,
          offset: 0,
          q: 'orders',
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
  });

  it('enriches every asset on the bounded visible page in parallel', async () => {
    (getMetricTabAssets as jest.Mock).mockResolvedValue({
      data: [firstRelation, secondRelation],
      paging: { limit: 10, offset: 0, total: 2 },
    });
    (getMetricTabAssetDetails as jest.Mock).mockImplementation(
      (_type: string, fqn: string) =>
        Promise.resolve({
          description: `${fqn} description`,
          owners: [{ id: `${fqn}-owner`, name: 'alice', type: 'user' }],
        })
    );
    const { result } = renderHook(
      () => useMetricAssetsTab({ metricFqn: 'revenue', metricId: 'metric-id' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.pageAssets).toHaveLength(2));

    await waitFor(() =>
      expect(getMetricTabAssetDetails).toHaveBeenCalledTimes(2)
    );

    expect(getMetricTabAssetDetails).toHaveBeenCalledWith(
      EntityType.TABLE,
      firstRelation.asset.fullyQualifiedName,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(getMetricTabAssetDetails).toHaveBeenCalledWith(
      EntityType.DASHBOARD,
      secondRelation.asset.fullyQualifiedName,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    await waitFor(() =>
      expect(
        result.current.detailsById.get(secondRelation.asset.id)?.description
      ).toBe(`${secondRelation.asset.fullyQualifiedName} description`)
    );
  });

  it('isolates per-card detail loading and errors and supports retry', async () => {
    let resolveFirstDetails: (value: unknown) => void = (_value) => undefined;
    (getMetricTabAssets as jest.Mock).mockResolvedValue({
      data: [firstRelation, secondRelation],
      paging: { limit: 10, offset: 0, total: 2 },
    });
    (getMetricTabAssetDetails as jest.Mock).mockImplementation(
      (_type: string, fqn: string) =>
        fqn === firstRelation.asset.fullyQualifiedName
          ? new Promise((resolve) => {
              resolveFirstDetails = resolve;
            })
          : Promise.reject(new Error('detail failed'))
    );
    const { result } = renderHook(
      () => useMetricAssetsTab({ metricFqn: 'revenue', metricId: 'metric-id' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() =>
      expect(result.current.detailLoadingIds).toContain(firstRelation.asset.id)
    );
    await waitFor(() =>
      expect(result.current.detailErrorIds).toContain(secondRelation.asset.id)
    );

    act(() => result.current.refetchAssetDetails(secondRelation.asset.id));

    await waitFor(() =>
      expect(getMetricTabAssetDetails).toHaveBeenCalledTimes(3)
    );

    await act(async () => resolveFirstDetails({ description: 'Orders' }));

    await waitFor(() =>
      expect(result.current.detailLoadingIds).not.toContain(
        firstRelation.asset.id
      )
    );
  });

  it('keeps cross-page selection and retains only failed rows after a partial unlink', async () => {
    (removeMetricTabAssets as jest.Mock).mockResolvedValue({
      failedRequest: [{ request: { id: firstRelation.asset.id } }],
      numberOfRowsFailed: 1,
      numberOfRowsPassed: 1,
    });
    const { result } = renderHook(
      () => useMetricAssetsTab({ metricFqn: 'revenue', metricId: 'metric-id' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() =>
      expect(result.current.pageAssets[0]).toEqual(firstRelation)
    );
    act(() => result.current.toggleAsset(firstRelation));
    act(() => result.current.setPage(2));
    await waitFor(() =>
      expect(result.current.pageAssets[0]).toEqual(secondRelation)
    );
    act(() => result.current.toggleAsset(secondRelation));

    expect(result.current.selectedIds).toEqual(
      new Set([firstRelation.asset.id, secondRelation.asset.id])
    );

    await act(async () => result.current.unlinkSelected());

    expect(removeMetricTabAssets).toHaveBeenCalledWith('revenue', [
      expect.objectContaining({ id: firstRelation.asset.id }),
      expect.objectContaining({ id: secondRelation.asset.id }),
    ]);
    expect(result.current.selectedIds).toEqual(
      new Set([firstRelation.asset.id])
    );
  });

  it('provides a lightweight, fresh count query for a badge before the tab opens', async () => {
    (getMetricTabAssets as jest.Mock).mockResolvedValue({
      data: [],
      paging: { limit: 1, offset: 0, total: 27 },
    });
    const { result } = renderHook(() => useMetricAssetsCount('metric-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.count).toBe(27));

    expect(getMetricTabAssets).toHaveBeenCalledWith(
      'metric-id',
      { limit: 1, offset: 0 },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    await act(async () => result.current.refetch());

    expect(getMetricTabAssets).toHaveBeenCalledTimes(2);
  });
});
