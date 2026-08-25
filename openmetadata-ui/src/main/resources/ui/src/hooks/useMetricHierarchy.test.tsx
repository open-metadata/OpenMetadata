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
import type { ReactNode } from 'react';
import { Kind } from '../generated/api/data/metricHierarchyItem';
import { getMetricGroupMetrics } from '../rest/metricGroupsAPI';
import { getMetricHierarchy, getMetrics } from '../rest/metricsAPI';
import type { MetricTreeNode } from '../utils/MetricEntityUtils/MetricHierarchyUtils';
import {
  isGroupRow,
  isLoadMoreRow,
} from '../utils/MetricEntityUtils/MetricHierarchyUtils';
import { useMetricHierarchy } from './useMetricHierarchy';

jest.mock('../rest/metricGroupsAPI', () => ({
  getMetricGroupMetrics: jest.fn(),
}));

jest.mock('../rest/metricsAPI', () => ({
  getMetricHierarchy: jest.fn(),
  getMetrics: jest.fn(),
}));

jest.mock('../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useMetricHierarchy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMetricHierarchy as jest.Mock).mockResolvedValue({
      data: [],
      paging: { offset: 0, limit: 20, total: 0 },
    });
    (getMetricGroupMetrics as jest.Mock).mockResolvedValue({
      data: [],
      paging: { offset: 0, limit: 50, total: 0 },
    });
    (getMetrics as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
  });

  it('pages top-level groups and standalone roots through the hierarchy endpoint', async () => {
    (getMetricHierarchy as jest.Mock).mockResolvedValue({
      data: [
        {
          kind: Kind.Metric,
          metric: { id: 'root-id', name: 'revenue' },
        },
      ],
      paging: { offset: 20, limit: 20, total: 45 },
    });

    const { result } = renderHook(
      () =>
        useMetricHierarchy({
          enabled: true,
          page: 2,
          pageSize: 20,
          query: 'revenue',
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(getMetricHierarchy).toHaveBeenCalledWith({
      limit: 20,
      offset: 20,
      q: 'revenue',
    });
    expect(result.current.paging).toEqual({
      offset: 20,
      limit: 20,
      total: 45,
    });
    expect(result.current.topLevelNodes[0].row).toMatchObject({
      id: 'root-id',
      name: 'revenue',
    });
  });

  it('preserves group context when a hierarchy query matches grouped descendants', async () => {
    (getMetricHierarchy as jest.Mock).mockResolvedValue({
      data: [
        {
          kind: Kind.MetricGroup,
          group: {
            id: 'group-id',
            name: 'profitability',
            metricCount: 1,
          },
        },
      ],
      paging: { offset: 0, limit: 20, total: 1 },
    });
    (getMetricGroupMetrics as jest.Mock).mockResolvedValue({
      data: [{ id: 'root-id', name: 'margin' }],
      paging: { offset: 0, limit: 50, total: 1 },
    });

    const { result } = renderHook(
      () =>
        useMetricHierarchy({
          enabled: true,
          page: 1,
          pageSize: 20,
          query: 'emea margin',
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.topLevelNodes).toHaveLength(1));

    expect(getMetricGroupMetrics).not.toHaveBeenCalled();
    expect(result.current.collapsedGroupIds).toEqual(['group:group-id']);
    expect(result.current.buildRows(result.current.topLevelNodes)).toEqual([
      expect.objectContaining({ isGroupRow: true }),
    ]);

    act(() => {
      result.current.toggleGroup('group:group-id');
    });

    await waitFor(() => expect(getMetricGroupMetrics).toHaveBeenCalled());

    expect(getMetricHierarchy).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      q: 'emea margin',
    });
    expect(getMetricGroupMetrics).toHaveBeenCalledWith('group-id', {
      limit: 50,
      offset: 0,
      q: 'emea margin',
      rootOnly: true,
    });
    expect(result.current.buildRows(result.current.topLevelNodes)).toEqual([
      expect.objectContaining({ isGroupRow: true }),
      expect.objectContaining({ id: 'root-id' }),
    ]);
  });

  it('hydrates visible groups and exposes paged membership without truncation', async () => {
    (getMetricHierarchy as jest.Mock).mockResolvedValue({
      data: [
        {
          kind: Kind.MetricGroup,
          group: {
            id: 'group-id',
            name: 'profitability',
            metricCount: 3,
          },
        },
      ],
      paging: { offset: 0, limit: 20, total: 1 },
    });
    (getMetricGroupMetrics as jest.Mock)
      .mockResolvedValueOnce({
        data: [
          { id: 'm1', name: 'margin' },
          { id: 'm2', name: 'profit' },
        ],
        paging: { offset: 0, limit: 2, total: 3 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'm3', name: 'ebitda' }],
        paging: { offset: 2, limit: 2, total: 3 },
      });

    const { result } = renderHook(
      () => useMetricHierarchy({ enabled: true, page: 1, pageSize: 20 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.topLevelNodes).toHaveLength(1));

    expect(getMetricGroupMetrics).not.toHaveBeenCalled();

    act(() => {
      result.current.toggleGroup('group:group-id');
    });

    await waitFor(() =>
      expect(result.current.topLevelNodes[0].members).toHaveLength(2)
    );

    let rows = result.current.buildRows(result.current.topLevelNodes);

    expect(isGroupRow(rows[0])).toBe(true);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'm1' }),
        expect.objectContaining({ id: 'm2' }),
        expect.objectContaining({ isLoadMoreRow: true, scope: 'group' }),
      ])
    );

    await act(async () => {
      await result.current.loadMoreGroupMembers('group-id');
    });

    rows = result.current.buildRows(result.current.topLevelNodes);

    expect(rows).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'm3' })])
    );
    expect(rows.some(isLoadMoreRow)).toBe(false);
    expect(getMetricGroupMetrics).toHaveBeenLastCalledWith('group-id', {
      limit: 50,
      offset: 2,
      rootOnly: true,
    });
  });

  it('ignores stale group membership when search changes during expansion', async () => {
    let resolveStaleMembers: (value: unknown) => void = (_value) => undefined;
    (getMetricHierarchy as jest.Mock).mockResolvedValue({
      data: [
        {
          kind: Kind.MetricGroup,
          group: { id: 'group-id', name: 'profitability', metricCount: 1 },
        },
      ],
      paging: { offset: 0, limit: 20, total: 1 },
    });
    (getMetricGroupMetrics as jest.Mock)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStaleMembers = resolve;
        })
      )
      .mockResolvedValueOnce({
        data: [{ id: 'new-root', name: 'new margin' }],
        paging: { offset: 0, limit: 50, total: 1 },
      });

    const { result, rerender } = renderHook(
      ({ query }: { query: string }) =>
        useMetricHierarchy({ enabled: true, query }),
      { initialProps: { query: 'old' }, wrapper }
    );

    await waitFor(() => expect(result.current.topLevelNodes).toHaveLength(1));
    act(() => result.current.toggleGroup('group:group-id'));
    await waitFor(() => expect(getMetricGroupMetrics).toHaveBeenCalledTimes(1));

    rerender({ query: 'new' });
    await waitFor(() =>
      expect(getMetricHierarchy).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'new' })
      )
    );
    await waitFor(() => expect(result.current.topLevelNodes).toHaveLength(1));

    await act(async () =>
      resolveStaleMembers({
        data: [{ id: 'old-root', name: 'old margin' }],
        paging: { offset: 0, limit: 50, total: 1 },
      })
    );

    expect(result.current.topLevelNodes[0].members).toBeUndefined();

    act(() => result.current.toggleGroup('group:group-id'));

    await waitFor(() =>
      expect(result.current.topLevelNodes[0].members).toEqual([
        expect.objectContaining({ id: 'new-root' }),
      ])
    );

    expect(getMetricGroupMetrics).toHaveBeenLastCalledWith(
      'group-id',
      expect.objectContaining({ q: 'new' })
    );
  });

  it('loads variants only after their parent is expanded', async () => {
    (getMetricHierarchy as jest.Mock).mockResolvedValue({
      data: [
        {
          kind: Kind.Metric,
          metric: {
            id: 'root-id',
            name: 'revenue',
            fullyQualifiedName: 'revenue',
            childrenCount: 1,
          },
        },
      ],
      paging: { offset: 0, limit: 20, total: 1 },
    });
    (getMetrics as jest.Mock).mockResolvedValue({
      data: [{ id: 'child-id', name: 'emea-revenue' }],
      paging: { total: 1 },
    });

    const { result } = renderHook(
      () => useMetricHierarchy({ enabled: true, page: 1, pageSize: 20 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.topLevelNodes).toHaveLength(1));

    expect(getMetrics).not.toHaveBeenCalled();

    act(() => {
      result.current.toggleExpand(
        true,
        result.current.topLevelNodes[0].row as never
      );
    });

    await waitFor(() => expect(getMetrics).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        result.current.buildRows(result.current.topLevelNodes)[0]
      ).toMatchObject({
        children: [expect.objectContaining({ id: 'child-id' })],
      })
    );
  });

  it('renders root, child, and grandchild exactly once for grouped hierarchies', async () => {
    (getMetricHierarchy as jest.Mock).mockResolvedValue({
      data: [
        {
          kind: Kind.MetricGroup,
          group: { id: 'group-id', name: 'profitability', metricCount: 3 },
        },
      ],
      paging: { offset: 0, limit: 20, total: 1 },
    });
    (getMetricGroupMetrics as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'root-id',
          name: 'margin',
          fullyQualifiedName: 'margin',
          childrenCount: 1,
        },
      ],
      paging: { offset: 0, limit: 50, total: 1 },
    });
    (getMetrics as jest.Mock).mockImplementation(({ parent }) =>
      Promise.resolve(
        parent === 'margin'
          ? {
              data: [
                {
                  id: 'child-id',
                  name: 'margin-emea',
                  fullyQualifiedName: 'margin-emea',
                  childrenCount: 1,
                },
              ],
              paging: { total: 1 },
            }
          : {
              data: [
                {
                  id: 'grandchild-id',
                  name: 'margin-emea-daily',
                  fullyQualifiedName: 'margin-emea-daily',
                },
              ],
              paging: { total: 1 },
            }
      )
    );

    const { result } = renderHook(
      () => useMetricHierarchy({ enabled: true, page: 1, pageSize: 20 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.topLevelNodes).toHaveLength(1));

    expect(getMetricGroupMetrics).not.toHaveBeenCalled();

    act(() => {
      result.current.toggleGroup('group:group-id');
    });

    await waitFor(() =>
      expect(getMetricGroupMetrics).toHaveBeenCalledWith(
        'group-id',
        expect.objectContaining({ rootOnly: true })
      )
    );

    const root = result.current.topLevelNodes[0].members?.[0];

    expect(root).toBeDefined();

    if (!root) {
      throw new Error('Expected an expanded root Metric');
    }

    act(() => result.current.toggleExpand(true, root));

    await waitFor(() =>
      expect(
        (
          result.current.buildRows(result.current.topLevelNodes)[1] as {
            children?: Array<{ id: string }>;
          }
        ).children?.[0].id
      ).toBe('child-id')
    );

    const rowsAfterChild = result.current.buildRows(
      result.current.topLevelNodes
    );
    const child = (rowsAfterChild[1] as { children: MetricTreeNode[] })
      .children[0];
    act(() => result.current.toggleExpand(true, child));

    await waitFor(() => {
      const rows = result.current.buildRows(result.current.topLevelNodes);
      const renderedRoot = rows[1] as {
        id: string;
        children?: Array<{
          id: string;
          children?: Array<{ id: string }>;
        }>;
      };
      const ids = [
        renderedRoot.id,
        renderedRoot.children?.[0].id,
        renderedRoot.children?.[0].children?.[0].id,
      ];

      expect(ids).toEqual(['root-id', 'child-id', 'grandchild-id']);
      expect(new Set(ids).size).toBe(3);
    });
  });
});
