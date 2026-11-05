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
 * Per-entity React Query keys for Context Center sidebar badge counts. Each
 * entity's create/delete/restore call sites invalidate only their own key so
 * e.g. creating an article doesn't also re-fetch the documents/memories/
 * archive counts. A document soft-delete/restore affects both the documents
 * and archive counts and should invalidate both keys.
 */
export const CONTEXT_CENTER_ARTICLES_COUNT_QUERY_KEY = [
  'context-center-articles-count',
];
export const CONTEXT_CENTER_DOCUMENTS_COUNT_QUERY_KEY = [
  'context-center-documents-count',
];
export const CONTEXT_CENTER_ARCHIVE_COUNT_QUERY_KEY = [
  'context-center-archive-count',
];
export const CONTEXT_CENTER_MEMORIES_COUNT_QUERY_KEY = [
  'context-center-memories-count',
];

/** Open memory conflict reviews; resolving one, or any memory write, invalidates it. */
export const CONTEXT_CENTER_MEMORY_REVIEWS_QUERY_KEY = [
  'context-center-memory-reviews',
];

/** One memory with its detail fields, as a conflict review compares it. */
export const CONTEXT_CENTER_MEMORY_DETAIL_QUERY_KEY = [
  'context-center-memory-detail',
];

/**
 * Converge a badge-count query after an async (`202`) delete: poll `hasLanded`
 * until the deleted row is gone, then refetch once and keep the server's
 * figure. Polling the row's absence rather than a precomputed count is what
 * keeps a concurrent restore or soft-delete from skewing the badge.
 *
 * ponytail: bounded poll — the backend emits a completion event on
 * `DELETE_ENTITY_CHANNEL`; switch to it if a second surface needs this.
 * ADR:2026-10-14-context-center-badge-counts-reconcile-by-bounded-poll
 */
export const reconcileCountAfterAsyncDelete = async (
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  hasLanded: () => Promise<boolean>,
  {
    attempts = 5,
    intervalMs = 1_000,
  }: { attempts?: number; intervalMs?: number } = {}
): Promise<void> => {
  for (let attempt = 0; attempt < attempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    if (await hasLanded()) {
      break;
    }
  }

  // `refetchQueries`, not `invalidateQueries`: invalidation only marks an
  // *inactive* query stale without fetching, so this would silently no-op
  // whenever the sidebar observing the key is unmounted.
  await queryClient.refetchQueries({ queryKey });
};
