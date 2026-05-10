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
 * App-wide React Query client.
 *
 * Defaults are tuned for OpenMetadata's data shape:
 *  - {@link staleTime} 30 s — most entity reads are stable for tens of seconds at a time
 *    and pages flip back-and-forth (Schema → Lineage → Schema). The same query reissued
 *    within the window serves cached data instead of refetching.
 *  - {@link gcTime} 5 min — keep results around long enough for a tab-switch round-trip
 *    without holding memory for users who navigate away.
 *  - {@link refetchOnWindowFocus} true — picks up backend changes when the user returns
 *    to the tab, but not so aggressively that idle tabs hammer the API.
 *  - {@link retry} 1 — one network blip retry, no exponential backoff cascade.
 *
 * Per-query overrides in `useQuery({ queryKey, queryFn, staleTime, ... })` always win.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
