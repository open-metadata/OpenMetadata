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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { makeLruCache } from '../utils/lruCacheUtils';

// 50 distinct keys covers all realistic widget × filter × date-range combinations on
// a single dashboard page with comfortable headroom.
const MAX_WIDGET_CACHE_ENTRIES = 50;

const dashboardWidgetCache = makeLruCache<unknown>(MAX_WIDGET_CACHE_ENTRIES);
const dashboardWidgetRequests = new Map<string, Promise<unknown>>();
let dashboardWidgetCacheEpoch = 0;

/** Drop all dashboard widget cache entries and in-flight requests. Call on logout / user switch or between tests. */
export function clearDashboardWidgetCache(): void {
  dashboardWidgetCacheEpoch++;
  dashboardWidgetCache.clear();
  dashboardWidgetRequests.clear();
}

interface UseDashboardWidgetDataOptions<T> {
  cacheKey: string;
  fetcher: () => Promise<T>;
  initialData: T;
  enabled?: boolean;
}

export const useDashboardWidgetData = <T>({
  cacheKey,
  fetcher,
  initialData,
  enabled = true,
}: UseDashboardWidgetDataOptions<T>) => {
  const initialDataRef = useRef(initialData);
  // Always hold the latest fetcher so refresh() never closes over a stale one,
  // without making fetcher a dependency of the refresh useCallback (which would
  // cause a redundant re-fetch whenever both cacheKey and fetcher change together).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Use has() — not a value-undefined check — so a legitimately cached undefined
  // result (or an error path that returns undefined) is distinguished from a cache miss.
  const isCached = dashboardWidgetCache.has(cacheKey);
  const [data, setData] = useState<T>(
    isCached ? (dashboardWidgetCache.get(cacheKey) as T) : initialData
  );
  const [isLoading, setIsLoading] = useState<boolean>(enabled && !isCached);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      setIsRefreshing(false);

      return;
    }

    const hasCachedData = dashboardWidgetCache.has(cacheKey);

    setIsLoading(!hasCachedData);
    setIsRefreshing(hasCachedData);

    const epoch = dashboardWidgetCacheEpoch;

    let request = dashboardWidgetRequests.get(cacheKey) as
      | Promise<T>
      | undefined;

    if (!request) {
      request = fetcherRef.current();
      dashboardWidgetRequests.set(cacheKey, request);
    }

    try {
      const response = await request;

      // Don't cache undefined — fetchers that return undefined on error would
      // otherwise write a sentinel that has() treats as a hit but get() returns
      // as undefined, making the loading/refreshing state inconsistent.
      // Also guard against a logout/clear that happened while the request was
      // in flight: if the epoch changed the cache was intentionally cleared and
      // we must not re-populate it with the previous user's data.
      if (response !== undefined && epoch === dashboardWidgetCacheEpoch) {
        dashboardWidgetCache.set(cacheKey, response);
      }
      setData(response);
    } catch {
      // Fetchers own user-facing error handling; keep the previous cached data visible.
    } finally {
      dashboardWidgetRequests.delete(cacheKey);
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [cacheKey, enabled]);

  useEffect(() => {
    const hasCached = dashboardWidgetCache.has(cacheKey);

    setData(
      hasCached
        ? (dashboardWidgetCache.get(cacheKey) as T)
        : initialDataRef.current
    );
    setIsLoading(enabled && !hasCached);
  }, [cacheKey, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      data,
      isLoading,
      isRefreshing,
      refresh,
    }),
    [data, isLoading, isRefreshing, refresh]
  );
};
