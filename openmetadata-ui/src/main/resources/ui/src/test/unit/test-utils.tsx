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
import {
  act,
  render,
  RenderOptions,
  RenderResult,
} from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';

/**
 * Wraps {@link render} with a {@link QueryClientProvider} carrying a fresh, isolated
 * {@link QueryClient} per test. Use this for any component that calls a React Query hook
 * (useQuery, useMutation, etc.) — without the provider those hooks throw
 * "No QueryClient set, use QueryClientProvider to set one".
 *
 * Each call creates a NEW client so cached data from one test never leaks to another. The
 * client is configured to disable retries (faster failure when an intentionally-mocked
 * endpoint rejects) and to never refetch on focus/mount (tests don't simulate those events).
 */
export function renderWithQueryClient(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult & { queryClient: QueryClient } {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
    queryClient,
  };
}

/**
 * Flushes React Query's post-fetch observer notification into the component
 * tree. React Query resolves its promise outside React's `act` scope, so a
 * bare `await screen.findBy*` after a fetch-triggering action sees the RQ
 * cache in `success`/`error` but the tree still rendering `pending` — until
 * we tick React once more inside `act`.
 *
 * Two zero-timeout ticks: the first drains the observer notification and
 * React re-render; the second drains any effect the re-render scheduled
 * (derived state, downstream fetches). Enough for most components; complex
 * effect chains may want a third.
 *
 * Prefer this over ad-hoc `await new Promise((r) => setTimeout(r, 0))` at
 * call sites — one helper keeps the pattern greppable and the reasoning in
 * one place.
 */
export async function flushReactQuery(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
