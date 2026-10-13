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

  it('follows the after cursor forward and the before cursor back', async () => {
    const { result } = renderHook(() => useCursorPagedList(fetchPage));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.onPageChange(2));

    expect(fetchPage).toHaveBeenLastCalledWith({ after: 'next', limit: 15 });

    await act(async () => result.current.onPageChange(1));

    expect(fetchPage).toHaveBeenLastCalledWith({ before: 'prev', limit: 15 });
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
});
