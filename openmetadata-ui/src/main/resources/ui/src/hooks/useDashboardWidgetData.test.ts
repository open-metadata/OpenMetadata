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
import {
  clearDashboardWidgetCache,
  useDashboardWidgetData,
} from './useDashboardWidgetData';

const createDeferred = <T>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
};

describe('useDashboardWidgetData', () => {
  beforeEach(() => {
    clearDashboardWidgetCache();
  });

  it('should fetch widget data and reuse cached data before refreshing', async () => {
    const fetcher = jest.fn().mockResolvedValue(['fresh']);
    const { result, unmount } = renderHook(() =>
      useDashboardWidgetData({
        cacheKey: 'widget-cache-key',
        fetcher,
        initialData: [],
      })
    );

    await waitFor(() => expect(result.current.data).toEqual(['fresh']));
    expect(fetcher).toHaveBeenCalledTimes(1);

    unmount();

    const refresh = createDeferred<string[]>();
    const refreshFetcher = jest.fn().mockReturnValue(refresh.promise);
    const { result: cachedResult } = renderHook(() =>
      useDashboardWidgetData({
        cacheKey: 'widget-cache-key',
        fetcher: refreshFetcher,
        initialData: [],
      })
    );

    expect(cachedResult.current.data).toEqual(['fresh']);
    expect(cachedResult.current.isLoading).toBe(false);

    await waitFor(() => expect(cachedResult.current.isRefreshing).toBe(true));

    await act(async () => {
      refresh.resolve(['refreshed']);
      await refresh.promise;
    });

    expect(cachedResult.current.data).toEqual(['refreshed']);
    expect(refreshFetcher).toHaveBeenCalledTimes(1);
  });

  it('should coalesce simultaneous requests for the same cache key', async () => {
    const request = createDeferred<string[]>();
    const fetcher = jest.fn().mockReturnValue(request.promise);

    const firstHook = renderHook(() =>
      useDashboardWidgetData({
        cacheKey: 'shared-widget-key',
        fetcher,
        initialData: [],
      })
    );
    const secondHook = renderHook(() =>
      useDashboardWidgetData({
        cacheKey: 'shared-widget-key',
        fetcher,
        initialData: [],
      })
    );

    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      request.resolve(['shared']);
      await request.promise;
    });

    expect(firstHook.result.current.data).toEqual(['shared']);
    expect(secondHook.result.current.data).toEqual(['shared']);
  });

  it('should not fetch data when disabled', () => {
    const fetcher = jest.fn().mockResolvedValue(['fresh']);
    const { result } = renderHook(() =>
      useDashboardWidgetData({
        cacheKey: 'disabled-widget-key',
        enabled: false,
        fetcher,
        initialData: ['initial'],
      })
    );

    expect(result.current.data).toEqual(['initial']);
    expect(result.current.isLoading).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('should clear cached data when clearDashboardWidgetCache is called', async () => {
    const fetcher = jest.fn().mockResolvedValue(['cached']);
    const { result, unmount } = renderHook(() =>
      useDashboardWidgetData({
        cacheKey: 'clear-cache-key',
        fetcher,
        initialData: [],
      })
    );

    await waitFor(() => expect(result.current.data).toEqual(['cached']));
    unmount();

    clearDashboardWidgetCache();

    const nextRequest = createDeferred<string[]>();
    const nextFetcher = jest.fn().mockReturnValue(nextRequest.promise);
    const { result: nextResult } = renderHook(() =>
      useDashboardWidgetData({
        cacheKey: 'clear-cache-key',
        fetcher: nextFetcher,
        initialData: ['initial'],
      })
    );

    expect(nextResult.current.data).toEqual(['initial']);
    expect(nextResult.current.isLoading).toBe(true);
    expect(nextFetcher).toHaveBeenCalledTimes(1);
  });
});
