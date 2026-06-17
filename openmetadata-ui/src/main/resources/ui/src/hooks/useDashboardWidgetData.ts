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

const dashboardWidgetCache = new Map<string, unknown>();
const dashboardWidgetRequests = new Map<string, Promise<unknown>>();

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

  const cachedData = dashboardWidgetCache.get(cacheKey) as T | undefined;
  const [data, setData] = useState<T>(cachedData ?? initialData);
  const [isLoading, setIsLoading] = useState<boolean>(
    enabled && cachedData === undefined
  );
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

    let request = dashboardWidgetRequests.get(cacheKey) as
      | Promise<T>
      | undefined;

    if (!request) {
      request = fetcherRef.current();
      dashboardWidgetRequests.set(cacheKey, request);
    }

    try {
      const response = await request;

      dashboardWidgetCache.set(cacheKey, response);
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
    const nextCachedData = dashboardWidgetCache.get(cacheKey) as T | undefined;

    setData(nextCachedData ?? initialDataRef.current);
    setIsLoading(enabled && nextCachedData === undefined);
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
