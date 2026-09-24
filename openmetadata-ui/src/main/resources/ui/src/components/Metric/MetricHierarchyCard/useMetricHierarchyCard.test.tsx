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
import { Metric } from '../../../generated/entity/data/metric';
import { getMetricHierarchyContext } from '../../../rest/metricsAPI';
import { useMetricHierarchyCard } from './useMetricHierarchyCard';

jest.mock('../../../rest/metricsAPI', () => ({
  getMetricHierarchyContext: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const metric = {
  id: 'current-id',
  name: 'margin',
  fullyQualifiedName: 'margin',
} as Metric;

describe('useMetricHierarchyCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the detail-context endpoint and removes the current metric from siblings', async () => {
    (getMetricHierarchyContext as jest.Mock).mockResolvedValue({
      group: { id: 'group-id', name: 'profitability', metricCount: 4 },
      current: metric,
      ancestors: [{ id: 'root-id', name: 'profit' }],
      siblings: [metric, { id: 'peer-id', name: 'net-margin' }],
      children: [{ id: 'child-id', name: 'emea-margin' }],
      siblingPaging: { offset: 0, limit: 25, total: 2 },
      childrenPaging: { offset: 0, limit: 25, total: 1 },
    });

    const { result } = renderHook(() => useMetricHierarchyCard(metric), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(getMetricHierarchyContext).toHaveBeenCalledWith('current-id', {
      childLimit: 25,
      childOffset: 0,
      siblingLimit: 25,
      siblingOffset: 0,
    });
    expect(result.current.group).toMatchObject({ name: 'profitability' });
    expect(result.current.ancestors).toHaveLength(1);
    expect(result.current.siblings).toEqual([
      expect.objectContaining({ id: 'peer-id' }),
    ]);
    expect(result.current.children).toHaveLength(1);
  });

  it('loads every remaining child page without replacing visible context', async () => {
    (getMetricHierarchyContext as jest.Mock)
      .mockResolvedValueOnce({
        current: metric,
        siblings: [],
        children: [{ id: 'child-1', name: 'child-1' }],
        siblingPaging: { offset: 0, limit: 25, total: 0 },
        childrenPaging: { offset: 0, limit: 1, total: 2 },
      })
      .mockResolvedValueOnce({
        current: metric,
        siblings: [],
        children: [{ id: 'child-2', name: 'child-2' }],
        siblingPaging: { offset: 0, limit: 0, total: 0 },
        childrenPaging: { offset: 1, limit: 25, total: 2 },
      });

    const { result } = renderHook(() => useMetricHierarchyCard(metric), {
      wrapper,
    });

    await waitFor(() => expect(result.current.children).toHaveLength(1));

    await act(async () => {
      await result.current.loadMoreChildren();
    });

    expect(result.current.children.map(({ id }) => id)).toEqual([
      'child-1',
      'child-2',
    ]);
    expect(getMetricHierarchyContext).toHaveBeenLastCalledWith(
      'current-id',
      expect.objectContaining({ childOffset: 1, siblingLimit: 0 })
    );
  });
});
