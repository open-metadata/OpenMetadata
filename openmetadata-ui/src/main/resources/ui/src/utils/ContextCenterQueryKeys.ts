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
 * Per-key reconcile state while deletes are being polled.
 *
 * `started` counts deletes accepted since `baseline` and never goes down, so a
 * delete that joins after an earlier one finished still subtracts it. `inFlight`
 * tracks live polls and only reaching zero clears the state.
 */
interface ReconcileState {
  baseline: number;
  started: number;
  inFlight: number;
}

const reconcileStates = new Map<string, ReconcileState>();

/**
 * Never above the absolute target, never above what the server reports, so an
 * already-applied deletion is not subtracted twice.
 */
const clampedTotal = (serverTotal: number | undefined, target: number) =>
  Math.max(
    0,
    serverTotal === undefined ? target : Math.min(serverTotal, target)
  );

/**
 * Converge a badge-count query on the result of an **asynchronous** delete.
 *
 * A hard delete answers `202` and finishes on a background thread, so a single
 * invalidation races it: when the refetch wins, the pre-delete total is cached
 * and nothing fetches again, leaving the badge stale for the session.
 *
 * So drop the count optimistically, then refetch until the server agrees or the
 * ~5s budget runs out. The ceiling is sized for a loaded box, not a happy path;
 * early exit means a fast delete still settles on the first poll.
 *
 * ponytail: bounded poll, because this page sees no completion signal. The
 * backend emits one on `DELETE_ENTITY_CHANNEL` — switch to it if a second
 * surface grows the same polling.
 */
export const reconcileCountAfterAsyncDelete = async (
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  {
    attempts = 5,
    intervalMs = 1_000,
  }: { attempts?: number; intervalMs?: number } = {}
): Promise<void> => {
  const current = queryClient.getQueryData<number>(queryKey);

  // Nothing cached means no badge shows this count, so there is nothing stale
  // to correct — whoever mounts the query next fetches it fresh.
  if (current === undefined) {
    return;
  }

  const cacheKey = JSON.stringify(queryKey);
  // A concurrent delete joins the existing state rather than re-reading a cache
  // a sibling's refetch may have just overwritten with the pre-delete total.
  const state = reconcileStates.get(cacheKey) ?? {
    baseline: current,
    started: 0,
    inFlight: 0,
  };
  state.started += 1;
  state.inFlight += 1;
  reconcileStates.set(cacheKey, state);

  const target = Math.max(0, state.baseline - state.started);
  queryClient.setQueryData(queryKey, target);

  try {
    for (let attempt = 0; attempt < attempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      // `refetchQueries`, not `invalidateQueries`: invalidation only marks an
      // *inactive* query stale without fetching, so this would silently no-op
      // whenever the sidebar observing the key is unmounted.
      await queryClient.refetchQueries({ queryKey });

      const serverTotal = queryClient.getQueryData<number>(queryKey);
      if (serverTotal !== undefined && serverTotal <= target) {
        return;
      }

      // The refetch wrote its raw total in; clamp it so the badge does not jump
      // back to the pre-delete number mid-poll.
      queryClient.setQueryData(queryKey, clampedTotal(serverTotal, target));
    }

    // Budget spent. The delete was accepted, so the clamped figure beats the
    // raw pre-delete total the last refetch left behind.
    queryClient.setQueryData(
      queryKey,
      clampedTotal(queryClient.getQueryData<number>(queryKey), target)
    );
  } finally {
    // Only the last live poll clears the state; `started` stays put so a later
    // delete still accounts for the ones already accepted.
    const active = reconcileStates.get(cacheKey);
    if (active) {
      active.inFlight -= 1;
      if (active.inFlight <= 0) {
        reconcileStates.delete(cacheKey);
      }
    }
  }
};
