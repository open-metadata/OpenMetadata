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
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { getMetricTabLineage } from '../../../rest/metricTabsAPI';
import { useMetricAssetLineage } from './useMetricAssetLineage';

jest.mock('../../../rest/metricTabsAPI', () => ({
  getMetricTabLineage: jest.fn(),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useMetricAssetLineage', () => {
  it('reads columns from the live keyed lineage response', async () => {
    (getMetricTabLineage as jest.Mock).mockResolvedValue({
      downstreamEdges: {},
      nodes: {
        revenue: {
          entity: {
            fullyQualifiedName: 'revenue',
            id: 'metric-1',
            name: 'revenue',
            type: 'metric',
          },
        },
      },
      upstreamEdges: {
        'asset-1--->metric-1': {
          columns: [
            { fromColumns: ['orders.amount'], toColumn: 'revenue.value' },
          ],
          fromEntity: { id: 'asset-1', type: 'table' },
          toEntity: { id: 'metric-1', type: 'metric' },
        },
        'asset-2--->metric-1': {
          columns: [
            { fromColumns: ['other.amount'], toColumn: 'revenue.value' },
          ],
          fromEntity: { id: 'asset-2', type: 'table' },
          toEntity: { id: 'metric-1', type: 'metric' },
        },
      },
    });
    const { result } = renderHook(
      () => useMetricAssetLineage('revenue', 'asset-1'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.columns).toHaveLength(1));

    expect(result.current.columns).toEqual([
      { fromColumns: ['orders.amount'], toColumn: 'revenue.value' },
    ]);
  });

  it('reads generated Edge column lineage only from the selected asset-metric edge', async () => {
    (getMetricTabLineage as jest.Mock).mockResolvedValue({
      downstreamEdges: [
        {
          fromEntity: 'metric-1',
          lineageDetails: {
            columnsLineage: [
              { fromColumns: ['wrong.downstream'], toColumn: 'consumer.value' },
            ],
          },
          toEntity: 'asset-1',
        },
      ],
      entity: { id: 'metric-1', name: 'revenue', type: 'metric' },
      upstreamEdges: [
        {
          fromEntity: 'asset-1',
          lineageDetails: {
            columnsLineage: [
              { fromColumns: ['orders.amount'], toColumn: 'revenue.value' },
            ],
          },
          toEntity: 'metric-1',
        },
        {
          fromEntity: 'asset-1',
          lineageDetails: {
            columnsLineage: [
              { fromColumns: ['wrong.column'], toColumn: 'other.value' },
            ],
          },
          toEntity: 'other-entity',
        },
        {
          fromEntity: 'other-asset',
          lineageDetails: {
            columnsLineage: [
              { fromColumns: ['other.column'], toColumn: 'revenue.value' },
            ],
          },
          toEntity: 'metric-1',
        },
      ],
    });
    const { result } = renderHook(
      () => useMetricAssetLineage('revenue', 'asset-1'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.columns).toHaveLength(1));

    expect(result.current.columns).toEqual([
      { fromColumns: ['orders.amount'], toColumn: 'revenue.value' },
    ]);
  });

  it('does not request lineage before an asset is selected', async () => {
    renderHook(() => useMetricAssetLineage('revenue'), { wrapper });

    await waitFor(() => expect(getMetricTabLineage).not.toHaveBeenCalled());
  });
});
