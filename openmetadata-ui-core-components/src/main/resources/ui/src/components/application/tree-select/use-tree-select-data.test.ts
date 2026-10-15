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
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TreeSelectNode } from './tree-select.types';
import { useTreeSelectData } from './use-tree-select-data';

const nodes: TreeSelectNode[] = [
  { id: 'a', label: 'a', value: 'a', isLeaf: true },
];

const child = (id: string): TreeSelectNode => ({
  id,
  label: id,
  value: id,
  isLeaf: true,
});

/** A branch whose children arrive in two pages of one. */
const renderPagedBranch = () => {
  const root: TreeSelectNode[] = [
    { id: 'root', label: 'root', value: 'root', isLeaf: false },
  ];
  const fetchData = vi
    .fn()
    .mockImplementation(
      async ({ parentId, after }: { parentId?: string; after?: string }) => {
        if (!parentId) {
          return { nodes: root };
        }

        return after
          ? { nodes: [child('c2')], hasMore: false, total: 2 }
          : {
              nodes: [child('c1')],
              hasMore: true,
              total: 2,
              nextCursor: 'cursor-1',
            };
      }
    );

  return { fetchData, ...renderHook(() => useTreeSelectData({ fetchData })) };
};

/** A root listing that arrives in two pages of one. */
const renderPagedRoot = () => {
  const fetchData = vi
    .fn()
    .mockImplementation(async ({ after }: { after?: string }) =>
      after
        ? { nodes: [child('g2')], hasMore: false, total: 2 }
        : {
            nodes: [child('g1')],
            hasMore: true,
            total: 2,
            nextCursor: 'root-cursor-1',
          }
    );

  return { fetchData, ...renderHook(() => useTreeSelectData({ fetchData })) };
};

const renderData = (enabled?: boolean) => {
  const fetchData = vi.fn().mockResolvedValue({ nodes });
  const hook = renderHook(
    (props: { enabled?: boolean }) =>
      useTreeSelectData({ fetchData, enabled: props.enabled }),
    { initialProps: { enabled } }
  );

  return { fetchData, ...hook };
};

describe('useTreeSelectData', () => {
  it('fetches the root on mount by default', async () => {
    const { fetchData, result } = renderData();

    await waitFor(() => expect(result.current.treeData).toEqual(nodes));

    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it('does not fetch while disabled', () => {
    const { fetchData, result } = renderData(false);

    expect(fetchData).not.toHaveBeenCalled();
    expect(result.current.treeData).toEqual([]);
  });

  it('fetches the root once it becomes enabled', async () => {
    const { fetchData, result, rerender } = renderData(false);

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.treeData).toEqual(nodes));

    expect(fetchData).toHaveBeenCalledTimes(1);
    expect(fetchData).toHaveBeenCalledWith(
      expect.objectContaining({ searchTerm: '' })
    );
  });

  it('records what a truncated branch needs to ask for its next page', async () => {
    const { result } = renderPagedBranch();

    await waitFor(() => expect(result.current.treeData).toHaveLength(1));
    await act(() => result.current.loadChildren('root'));

    expect(result.current.treeData[0]).toMatchObject({
      hasMoreChildren: true,
      childrenTotal: 2,
      childrenCursor: 'cursor-1',
    });
    expect(result.current.treeData[0].children).toHaveLength(1);
  });

  it('appends the next page rather than replacing the branch', async () => {
    const { fetchData, result } = renderPagedBranch();

    await waitFor(() => expect(result.current.treeData).toHaveLength(1));
    await act(() => result.current.loadChildren('root'));
    await act(() => result.current.loadMoreChildren('root'));

    expect(fetchData).toHaveBeenLastCalledWith(
      expect.objectContaining({ parentId: 'root', after: 'cursor-1' })
    );
    expect(result.current.treeData[0].children?.map(({ id }) => id)).toEqual([
      'c1',
      'c2',
    ]);
    expect(result.current.treeData[0].hasMoreChildren).toBe(false);
  });

  // The consumer may prune a whole page (an exclude list), leaving the branch
  // rendered empty while the server still has more to give.
  it('keeps a branch resumable when a page arrives empty', async () => {
    const fetchData = vi
      .fn()
      .mockImplementation(async ({ parentId }: { parentId?: string }) =>
        parentId
          ? { nodes: [], hasMore: true, total: 2, nextCursor: 'cursor-1' }
          : {
              nodes: [
                { id: 'root', label: 'root', value: 'root', isLeaf: false },
              ],
            }
      );
    const { result } = renderHook(() => useTreeSelectData({ fetchData }));

    await waitFor(() => expect(result.current.treeData).toHaveLength(1));
    await act(() => result.current.loadChildren('root'));

    expect(result.current.treeData[0]).toMatchObject({
      hasMoreChildren: true,
      childrenCursor: 'cursor-1',
    });
  });

  it('ignores a load-more on a branch that has everything', async () => {
    const { fetchData, result } = renderPagedBranch();

    await waitFor(() => expect(result.current.treeData).toHaveLength(1));
    await act(() => result.current.loadMoreChildren('root'));

    // Root fetch only — an unloaded branch has no cursor to resume from.
    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it('records what a truncated root listing needs for its next page', async () => {
    const { result } = renderPagedRoot();

    await waitFor(() => expect(result.current.treeData).toHaveLength(1));

    expect(result.current.hasMoreRoot).toBe(true);
    expect(result.current.rootTotal).toBe(2);
  });

  it('appends the next root page rather than replacing the listing', async () => {
    const { fetchData, result } = renderPagedRoot();

    await waitFor(() => expect(result.current.treeData).toHaveLength(1));
    await act(() => result.current.loadMoreRoot());

    expect(fetchData).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: 'root-cursor-1' })
    );
    expect(result.current.treeData.map(({ id }) => id)).toEqual(['g1', 'g2']);
    expect(result.current.hasMoreRoot).toBe(false);
  });

  it('ignores a load-more on a root listing that has everything', async () => {
    const { fetchData, result } = renderData();

    await waitFor(() => expect(result.current.treeData).toHaveLength(1));
    await act(() => result.current.loadMoreRoot());

    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  // A swallowed failure would read as "no more pages" and hide the row.
  it('keeps the root cursor when an append page rejects', async () => {
    const fetchData = vi
      .fn()
      .mockImplementationOnce(async () => ({
        nodes: [child('g1')],
        hasMore: true,
        total: 2,
        nextCursor: 'root-cursor-1',
      }))
      .mockImplementationOnce(async () => {
        throw new Error('boom');
      });

    const { result } = renderHook(() =>
      useTreeSelectData({ fetchData, onFetchError: () => undefined })
    );

    await waitFor(() => expect(result.current.hasMoreRoot).toBe(true));
    await act(() => result.current.loadMoreRoot());

    expect(result.current.hasMoreRoot).toBe(true);
    expect(result.current.treeData.map(({ id }) => id)).toEqual(['g1']);
  });

  // One shared controller let a load-more cancel an expand, and the reverse.
  it('does not let a root append and a branch load cancel each other', async () => {
    const signals: Record<string, AbortSignal | undefined> = {};
    const fetchData = vi
      .fn()
      .mockImplementation(
        async ({
          parentId,
          after,
          signal,
        }: {
          parentId?: string;
          after?: string;
          signal?: AbortSignal;
        }) => {
          signals[parentId ? 'branch' : after ? 'append' : 'root'] = signal;

          if (parentId) {
            return { nodes: [child('c1')] };
          }

          return after
            ? { nodes: [child('g2')], hasMore: false }
            : {
                nodes: [{ id: 'g1', label: 'g1', value: 'g1', isLeaf: false }],
                hasMore: true,
                nextCursor: 'root-cursor-1',
              };
        }
      );

    const { result } = renderHook(() => useTreeSelectData({ fetchData }));

    await waitFor(() => expect(result.current.treeData).toHaveLength(1));
    await act(async () => {
      const branch = result.current.loadChildren('g1');
      const append = result.current.loadMoreRoot();
      await Promise.all([branch, append]);
    });

    expect(signals.branch?.aborted).toBe(false);
    expect(signals.append?.aborted).toBe(false);
  });
});
