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
import { useCursorPagedList } from './useCursorPagedList';

jest.mock('../utils/ToastUtils', () => ({ showErrorToast: jest.fn() }));

const fetchPage = jest.fn();

describe('useCursorPagedList', () => {
  beforeEach(() => {
    fetchPage.mockReset();
    fetchPage.mockResolvedValue({
      data: ['a'],
      paging: { total: 40, after: 'next', before: 'prev' },
    });
  });

  it('loads the first page with the default page size', async () => {
    const { result } = renderHook(() => useCursorPagedList(fetchPage));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchPage).toHaveBeenCalledWith({ limit: 15 });
    expect(result.current.items).toEqual(['a']);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.showPagination).toBe(true);
  });

  it('follows the after cursor forward and reloads the first page going back to 1', async () => {
    const { result } = renderHook(() => useCursorPagedList(fetchPage));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.onPageChange(2));

    expect(fetchPage).toHaveBeenLastCalledWith({ after: 'next', limit: 15 });

    await act(async () => result.current.onPageChange(1));

    // Page 1 needs no cursor: it is simply the first page again.
    expect(fetchPage).toHaveBeenLastCalledWith({ limit: 15 });
  });

  it('restarts from page 1 when the page size changes', async () => {
    const { result } = renderHook(() => useCursorPagedList(fetchPage));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.onPageChange(2));
    await act(async () => result.current.onPageSizeChange(25));

    expect(result.current.page).toBe(1);
    expect(fetchPage).toHaveBeenLastCalledWith({ limit: 25 });
  });

  it('ignores a slower earlier response once a newer request was made', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    const slowFirst = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValue({ data: ['new'], paging: { total: 1 } });

    const { result, rerender } = renderHook(
      ({ fetcher }) => useCursorPagedList(fetcher),
      { initialProps: { fetcher: slowFirst } }
    );
    rerender({ fetcher: jest.fn(slowFirst) });

    await waitFor(() => expect(result.current.items).toEqual(['new']));

    await act(async () => {
      resolveFirst?.({ data: ['stale'], paging: { total: 1 } });
    });

    expect(result.current.items).toEqual(['new']);
  });

  it('jumps to a page it has not loaded by walking the cursors in between', async () => {
    fetchPage.mockImplementation(({ after }: { after?: string }) => {
      const pageNumber = after ? Number(after.replace('p', '')) : 1;

      return Promise.resolve({
        data: [`item-${pageNumber}`],
        paging: {
          total: 60,
          after: `p${pageNumber + 1}`,
          before: `b${pageNumber}`,
        },
      });
    });
    const { result } = renderHook(() => useCursorPagedList(fetchPage));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.onPageChange(3);
    });

    expect(result.current.page).toBe(3);
    expect(result.current.items).toEqual(['item-3']);

    // Back to page 2 uses page 3's `before` cursor, no walking needed.
    fetchPage.mockClear();
    await act(async () => {
      await result.current.onPageChange(2);
    });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith({ before: 'b3', limit: 15 });
  });

  it('does not cache cursors from a response that arrives after the list restarted', async () => {
    let resolveOldPage2: ((value: unknown) => void) | undefined;
    const oldList = jest.fn(({ after }: { after?: string }) =>
      after
        ? new Promise((resolve) => {
            resolveOldPage2 = resolve;
          })
        : Promise.resolve({
            data: ['old-1'],
            paging: { total: 60, after: 'old-2' },
          })
    );
    const newList = jest.fn(({ after }: { after?: string }) =>
      Promise.resolve({
        data: [after ? `new-${after}` : 'new-1'],
        paging: { total: 60, after: after === 'new-2' ? 'new-3' : 'new-2' },
      })
    );
    const { result, rerender } = renderHook(
      ({ fetcher }) => useCursorPagedList(fetcher),
      { initialProps: { fetcher: oldList as typeof fetchPage } }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Page 2 of the old list is still loading when the filter changes.
    act(() => {
      void result.current.onPageChange(2);
    });
    rerender({ fetcher: newList as typeof fetchPage });
    await waitFor(() => expect(result.current.items).toEqual(['new-1']));
    await act(async () => {
      resolveOldPage2?.({
        data: ['old-2'],
        paging: { total: 60, after: 'old-3' },
      });
    });

    await act(async () => {
      await result.current.onPageChange(3);
    });

    expect(newList).toHaveBeenCalledWith({ after: 'new-2', limit: 15 });
    expect(newList).not.toHaveBeenCalledWith({ after: 'old-3', limit: 15 });
    expect(result.current.items).toEqual(['new-new-3']);
  });
});
