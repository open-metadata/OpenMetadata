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
import { showErrorToast } from '../../../utils/ToastUtils';
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

  it('discards a stale load-more children response after navigating to a different metric', async () => {
    const m1 = { id: 'm1', name: 'm1', fullyQualifiedName: 'm1' } as Metric;
    const m2 = { id: 'm2', name: 'm2', fullyQualifiedName: 'm2' } as Metric;
    let resolveStaleLoadMore: (value: unknown) => void = (_value) => undefined;

    (getMetricHierarchyContext as jest.Mock)
      .mockResolvedValueOnce({
        current: m1,
        siblings: [],
        children: [{ id: 'm1-c0', name: 'm1-c0' }],
        siblingPaging: { offset: 0, limit: 25, total: 0 },
        childrenPaging: { offset: 0, limit: 25, total: 3 },
      })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStaleLoadMore = resolve;
        })
      )
      .mockResolvedValueOnce({
        current: m2,
        siblings: [],
        children: [{ id: 'm2-c0', name: 'm2-c0' }],
        siblingPaging: { offset: 0, limit: 25, total: 0 },
        childrenPaging: { offset: 0, limit: 25, total: 1 },
      });

    const { result, rerender } = renderHook(
      ({ metric }: { metric: Metric }) => useMetricHierarchyCard(metric),
      { initialProps: { metric: m1 }, wrapper }
    );

    await waitFor(() => expect(result.current.hasMoreChildren).toBe(true));

    act(() => {
      void result.current.loadMoreChildren();
    });

    rerender({ metric: m2 });

    await waitFor(() => expect(result.current.children).toHaveLength(1));

    expect(result.current.isLoadingChildren).toBe(false);
    expect(result.current.hasMoreChildren).toBe(false);

    await act(async () => {
      resolveStaleLoadMore({
        current: m1,
        siblings: [],
        children: [
          { id: 'm1-c1', name: 'm1-c1' },
          { id: 'm1-c2', name: 'm1-c2' },
        ],
        siblingPaging: { offset: 0, limit: 0, total: 0 },
        childrenPaging: { offset: 1, limit: 25, total: 3 },
      });
    });

    expect(result.current.children.map((m: Metric) => m.id)).toEqual(['m2-c0']);
  });

  it('discards a stale load-more siblings response after navigating to a different metric', async () => {
    const m1 = { id: 'm1', name: 'm1', fullyQualifiedName: 'm1' } as Metric;
    const m2 = { id: 'm2', name: 'm2', fullyQualifiedName: 'm2' } as Metric;
    let resolveStaleLoadMore: (value: unknown) => void = (_value) => undefined;

    (getMetricHierarchyContext as jest.Mock)
      .mockResolvedValueOnce({
        current: m1,
        siblings: [{ id: 'm1-s0', name: 'm1-s0' }],
        children: [],
        siblingPaging: { offset: 0, limit: 25, total: 3 },
        childrenPaging: { offset: 0, limit: 25, total: 0 },
      })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStaleLoadMore = resolve;
        })
      )
      .mockResolvedValueOnce({
        current: m2,
        siblings: [],
        children: [],
        siblingPaging: { offset: 0, limit: 25, total: 0 },
        childrenPaging: { offset: 0, limit: 25, total: 0 },
      });

    const { result, rerender } = renderHook(
      ({ metric }: { metric: Metric }) => useMetricHierarchyCard(metric),
      { initialProps: { metric: m1 }, wrapper }
    );

    await waitFor(() => expect(result.current.hasMoreSiblings).toBe(true));

    act(() => {
      void result.current.loadMoreSiblings();
    });

    rerender({ metric: m2 });

    await waitFor(() => expect(result.current.siblings).toHaveLength(0));

    expect(result.current.isLoadingSiblings).toBe(false);
    expect(result.current.hasMoreSiblings).toBe(false);

    await act(async () => {
      resolveStaleLoadMore({
        current: m1,
        siblings: [
          { id: 'm1-s1', name: 'm1-s1' },
          { id: 'm1-s2', name: 'm1-s2' },
        ],
        children: [],
        siblingPaging: { offset: 1, limit: 25, total: 3 },
        childrenPaging: { offset: 0, limit: 0, total: 0 },
      });
    });

    expect(result.current.siblings.map((m: Metric) => m.id)).toEqual([]);
  });

  it('still loads more rows on the new metric after navigating mid-load-more', async () => {
    const m1 = { id: 'm1', name: 'm1', fullyQualifiedName: 'm1' } as Metric;
    const m2 = { id: 'm2', name: 'm2', fullyQualifiedName: 'm2' } as Metric;
    let resolveStaleLoadMore: (value: unknown) => void = (_value) => undefined;

    (getMetricHierarchyContext as jest.Mock)
      .mockResolvedValueOnce({
        current: m1,
        siblings: [],
        children: [{ id: 'm1-c0', name: 'm1-c0' }],
        siblingPaging: { offset: 0, limit: 25, total: 0 },
        childrenPaging: { offset: 0, limit: 25, total: 3 },
      })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStaleLoadMore = resolve;
        })
      )
      .mockResolvedValueOnce({
        current: m2,
        siblings: [],
        children: [{ id: 'm2-c0', name: 'm2-c0' }],
        siblingPaging: { offset: 0, limit: 25, total: 0 },
        childrenPaging: { offset: 0, limit: 25, total: 3 },
      })
      .mockResolvedValueOnce({
        current: m2,
        siblings: [],
        children: [
          { id: 'm2-c1', name: 'm2-c1' },
          { id: 'm2-c2', name: 'm2-c2' },
        ],
        siblingPaging: { offset: 0, limit: 0, total: 0 },
        childrenPaging: { offset: 1, limit: 25, total: 3 },
      });

    const { result, rerender } = renderHook(
      ({ metric }: { metric: Metric }) => useMetricHierarchyCard(metric),
      { initialProps: { metric: m1 }, wrapper }
    );

    await waitFor(() => expect(result.current.hasMoreChildren).toBe(true));

    act(() => {
      void result.current.loadMoreChildren();
    });

    rerender({ metric: m2 });

    await waitFor(() => expect(result.current.hasMoreChildren).toBe(true));

    await act(async () => {
      await result.current.loadMoreChildren();
    });

    await act(async () => {
      resolveStaleLoadMore({
        current: m1,
        siblings: [],
        children: [
          { id: 'm1-c1', name: 'm1-c1' },
          { id: 'm1-c2', name: 'm1-c2' },
        ],
        siblingPaging: { offset: 0, limit: 0, total: 0 },
        childrenPaging: { offset: 1, limit: 25, total: 3 },
      });
    });

    expect(result.current.children.map((m: Metric) => m.id)).toEqual([
      'm2-c0',
      'm2-c1',
      'm2-c2',
    ]);
    expect(result.current.isLoadingChildren).toBe(false);
  });

  it('suppresses a stale error toast and keeps the new metric load intact', async () => {
    const m1 = { id: 'm1', name: 'm1', fullyQualifiedName: 'm1' } as Metric;
    const m2 = { id: 'm2', name: 'm2', fullyQualifiedName: 'm2' } as Metric;
    let rejectStaleLoadMore: (reason?: unknown) => void = (_reason) =>
      undefined;
    let resolveFreshLoadMore: (value: unknown) => void = (_value) => undefined;

    (getMetricHierarchyContext as jest.Mock)
      .mockResolvedValueOnce({
        current: m1,
        siblings: [],
        children: [{ id: 'm1-c0', name: 'm1-c0' }],
        siblingPaging: { offset: 0, limit: 25, total: 0 },
        childrenPaging: { offset: 0, limit: 25, total: 3 },
      })
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectStaleLoadMore = reject;
        })
      )
      .mockResolvedValueOnce({
        current: m2,
        siblings: [],
        children: [{ id: 'm2-c0', name: 'm2-c0' }],
        siblingPaging: { offset: 0, limit: 25, total: 0 },
        childrenPaging: { offset: 0, limit: 25, total: 3 },
      })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFreshLoadMore = resolve;
        })
      );

    const { result, rerender } = renderHook(
      ({ metric }: { metric: Metric }) => useMetricHierarchyCard(metric),
      { initialProps: { metric: m1 }, wrapper }
    );

    await waitFor(() => expect(result.current.hasMoreChildren).toBe(true));

    let staleLoadMore: Promise<void> = Promise.resolve();
    act(() => {
      staleLoadMore = result.current
        .loadMoreChildren()
        .catch(() => undefined) as Promise<void>;
    });

    rerender({ metric: m2 });
    await waitFor(() => expect(result.current.hasMoreChildren).toBe(true));

    let freshLoadMore: Promise<void> = Promise.resolve();
    act(() => {
      freshLoadMore = result.current
        .loadMoreChildren()
        .catch(() => undefined) as Promise<void>;
    });

    expect(result.current.isLoadingChildren).toBe(true);

    await act(async () => {
      rejectStaleLoadMore(new Error('stale fetch'));
      await staleLoadMore;
    });

    expect(showErrorToast).not.toHaveBeenCalled();
    expect(result.current.isLoadingChildren).toBe(true);

    await act(async () => {
      resolveFreshLoadMore({
        current: m2,
        siblings: [],
        children: [
          { id: 'm2-c1', name: 'm2-c1' },
          { id: 'm2-c2', name: 'm2-c2' },
        ],
        siblingPaging: { offset: 0, limit: 0, total: 0 },
        childrenPaging: { offset: 1, limit: 25, total: 3 },
      });
      await freshLoadMore;
    });

    expect(result.current.children.map((m: Metric) => m.id)).toEqual([
      'm2-c0',
      'm2-c1',
      'm2-c2',
    ]);
    expect(result.current.isLoadingChildren).toBe(false);
  });
});
