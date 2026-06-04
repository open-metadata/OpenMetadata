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

import { QueryClient } from '@tanstack/react-query';

/**
 * Singleton {@link QueryClient} used by the app. Exporting the instance directly (in addition
 * to providing it via {@code QueryClientProvider}) lets non-hook callers — axios interceptors,
 * AuthProvider's logout handler, anywhere outside React — invalidate and prefetch without
 * threading a ref through the tree.
 *
 * Defaults are tuned for OpenMetadata's typical access pattern. {@code staleTime: 0}
 * implements stale-while-revalidate: cached data renders synchronously on mount (so a
 * hover-prefetch hit still feels instant), AND a background refetch fires to verify the
 * value is current. This restores the network behavior that pre-migration Playwright tests
 * assert on (they do {@code page.reload()} → wait for the entity GET to fire), without
 * losing the perceived-instant feel of the cache. The refetch hits the backend's Caffeine
 * cache so it's sub-ms on the server side.
 *
 * {@code gcTime} (formerly {@code cacheTime}) stays at 30 minutes so back-navigation
 * within the session still benefits from the cached body during the refetch window.
 *
 * Mutations don't retry — a failed PUT shouldn't replay silently on a flaky network.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 30 * 60 * 1000,
      // Default refetch-on-focus to false: OpenMetadata entities don't change second-by-second
      // and many users alt-tab a lot during editing. Pages that need fresh-on-focus opt in
      // explicitly via {@code refetchOnWindowFocus: true} on the individual query.
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry on 4xx — typically a permission or not-found error that won't change on
        // retry. Server-error 5xx retries up to 2 times with React Query's default backoff.
        const status = (error as { response?: { status?: number } })?.response
          ?.status;
        if (status !== undefined && status >= 400 && status < 500) {
          return false;
        }

        return failureCount < 2;
      },
    },
    mutations: {
      // Mutations stay one-shot — a failed PUT shouldn't replay silently. Each call site
      // handles error UI explicitly.
      retry: false,
    },
  },
});
