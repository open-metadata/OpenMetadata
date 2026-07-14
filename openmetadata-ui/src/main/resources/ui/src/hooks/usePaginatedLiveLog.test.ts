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
import { LogPage, usePaginatedLiveLog } from './usePaginatedLiveLog';

jest.mock('../utils/ToastUtils', () => ({ showErrorToast: jest.fn() }));

const page = (content: string, after?: string, total?: string): LogPage => ({
  content,
  after,
  total,
});

describe('usePaginatedLiveLog', () => {
  it('single page: logs is the page, hasMore false', async () => {
    const fetchPage = jest.fn().mockResolvedValue(page('line1\nline2'));
    const { result } = renderHook(() =>
      usePaginatedLiveLog({
        fetchPage,
        resetKey: 'k',
        enabled: true,
        isLive: false,
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('line1\nline2'));

    expect(result.current.hasMore).toBe(false);
    expect(result.current.totalLines).toBe(2);
    expect(fetchPage).toHaveBeenCalledWith(undefined);
  });

  it('multi page: loadMore appends forward and preserves earlier pages', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(page('page0', '1', '3'))
      .mockResolvedValueOnce(page('page1', '2', '3'))
      .mockResolvedValueOnce(page('tail'));
    const { result } = renderHook(() =>
      usePaginatedLiveLog({
        fetchPage,
        resetKey: 'k',
        enabled: true,
        isLive: false,
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('page0'));

    expect(result.current.hasMore).toBe(true);

    result.current.loadMore();
    await waitFor(() => expect(result.current.logs).toBe('page0page1'));

    expect(result.current.hasMore).toBe(true);

    result.current.loadMore();
    await waitFor(() => expect(result.current.logs).toBe('page0page1tail'));

    expect(result.current.hasMore).toBe(false);
  });

  it('treats after === total as the tail (Airflow contract)', async () => {
    // Airflow returns `after` present and equal to `total` on the last page
    // instead of omitting it. That page must still be recognised as the tail.
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(page('page0', '1', '2'))
      .mockResolvedValue(page('tail', '2', '2'));
    const { result } = renderHook(() =>
      usePaginatedLiveLog({
        fetchPage,
        resetKey: 'k',
        enabled: true,
        isLive: false,
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('page0'));

    expect(result.current.hasMore).toBe(true);

    result.current.loadMore();
    await waitFor(() => expect(result.current.logs).toBe('page0tail'));

    expect(result.current.hasMore).toBe(false);
  });

  it('polls the tail and REPLACES it (no duplication)', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(page('tail-v1'))
      .mockResolvedValue(page('tail-v2'));
    const { result } = renderHook(() =>
      usePaginatedLiveLog({
        fetchPage,
        resetKey: 'k',
        enabled: true,
        isLive: true,
        intervalMs: 20,
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('tail-v1'));
    // Poll replaces the tail — the log does NOT become 'tail-v1tail-v2'.
    await waitFor(() => expect(result.current.logs).toBe('tail-v2'));
  });

  it('rolls over: commits the completed tail and reads to the new tail', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(page('tail-v1'))
      .mockResolvedValueOnce(page('tail-final', '1', '2'))
      .mockResolvedValue(page('newtail'));
    const { result } = renderHook(() =>
      usePaginatedLiveLog({
        fetchPage,
        resetKey: 'k',
        enabled: true,
        isLive: true,
        intervalMs: 20,
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('tail-v1'));
    await waitFor(() => expect(result.current.logs).toBe('tail-finalnewtail'));
  });

  it('fetches the tail once more when isLive flips false (captures final lines)', async () => {
    // A high interval keeps the periodic poll from firing, isolating the
    // single tail fetch triggered by the live→terminal transition.
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(page('tail-v1'))
      .mockResolvedValue(page('tail-v2'));
    const { result, rerender } = renderHook(
      ({ isLive }) =>
        usePaginatedLiveLog({
          fetchPage,
          resetKey: 'k',
          enabled: true,
          isLive,
          intervalMs: 100000,
        }),
      { initialProps: { isLive: true } }
    );

    await waitFor(() => expect(result.current.logs).toBe('tail-v1'));

    expect(fetchPage).toHaveBeenCalledTimes(1);

    rerender({ isLive: false });

    await waitFor(() => expect(result.current.logs).toBe('tail-v2'));

    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('defers the final tail read past an in-flight request when isLive flips false', async () => {
    let resolveInflight: (value: LogPage) => void = () => undefined;
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(page('tail-v1'))
      .mockImplementationOnce(
        () =>
          new Promise<LogPage>((resolve) => {
            resolveInflight = resolve;
          })
      )
      .mockResolvedValue(page('tail-final'));
    const { result, rerender } = renderHook(
      ({ isLive }) =>
        usePaginatedLiveLog({
          fetchPage,
          resetKey: 'k',
          enabled: true,
          isLive,
          intervalMs: 10,
        }),
      { initialProps: { isLive: true } }
    );

    await waitFor(() => expect(result.current.logs).toBe('tail-v1'));
    // The interval fires a tail poll that stays in flight (unresolved).
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));

    // Run goes terminal while that poll is still in flight.
    rerender({ isLive: false });

    // Freeing the lock flushes the deferred final read — the last lines land.
    await act(async () => {
      resolveInflight(page('tail-v1'));
    });

    await waitFor(() => expect(result.current.logs).toBe('tail-final'));

    expect(fetchPage).toHaveBeenCalledTimes(3);
  });
});
