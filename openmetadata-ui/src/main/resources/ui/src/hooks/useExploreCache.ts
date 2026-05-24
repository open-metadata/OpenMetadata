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
import { create } from 'zustand';

/**
 * Stale-while-revalidate cache for the Explore page's per-tab search results.
 *
 * Tab-switch on the Explore page (Tables → Dashboards → Pipelines …) re-runs the same shape of
 * search-fetch with a different `searchIndex`. Results within a session are extremely repetitive:
 * users flip between tabs while the underlying query and filters don't change. Without a cache
 * each switch pays for a full server round-trip.
 *
 * Strategy: keyed by the same string the page already uses to detect "should I re-fetch?" — a
 * JSON-stringified bag of (searchIndex, queryFilter, quickFilter, searchQueryParam, sortValue,
 * sortOrder, page, size, showDeleted). Cache hits within {@link STALE_TIME_MS} render
 * synchronously; the consumer is expected to also kick off a silent background refresh so the
 * cached entry never serves data older than one tab-switch on a stable filter set.
 *
 * Bounded memory: the entry cap is {@link MAX_ENTRIES}. Insertion-ordered Map; on overflow the
 * oldest entry is evicted. A typical `SearchResponse` is 50-500 KB so we cap memory at ~30 MB.
 */

export interface ExploreCacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

const MAX_ENTRIES = 60;
const STALE_TIME_MS = 30_000;

interface ExploreCacheState {
  entries: Map<string, ExploreCacheEntry>;
  /**
   * Read a cached entry. Returns the entry if it exists and was written within
   * {@link STALE_TIME_MS}; otherwise returns {@code undefined}. Caller decides whether to use a
   * stale entry (e.g. for SWR display) or treat it as a miss.
   */
  getCached: <T = unknown>(key: string) => ExploreCacheEntry<T> | undefined;
  /** Write a new entry under {@code key}. Evicts the oldest entry if over capacity. */
  setCached: <T = unknown>(key: string, data: T) => void;
  /** Drop every entry. Call on logout / user switch / explicit refresh. */
  clearCache: VoidFunction;
}

const isFresh = (entry: ExploreCacheEntry): boolean =>
  Date.now() - entry.timestamp < STALE_TIME_MS;

export const useExploreCache = create<ExploreCacheState>()((set, get) => ({
  entries: new Map(),
  getCached: <T = unknown>(key: string): ExploreCacheEntry<T> | undefined => {
    const entry = get().entries.get(key) as ExploreCacheEntry<T> | undefined;
    if (!entry || !isFresh(entry)) {
      return undefined;
    }

    return entry;
  },
  setCached: <T = unknown>(key: string, data: T): void => {
    // Clone first, mutate the clone, then commit — the previous `entries` Map stays untouched
    // so any consumer holding a snapshot reference doesn't observe interim state.
    const next = new Map(get().entries);
    // Re-set keeps insertion order: drop and re-add so this entry is youngest.
    next.delete(key);
    next.set(key, { data, timestamp: Date.now() });
    if (next.size > MAX_ENTRIES) {
      const oldest = next.keys().next().value;
      if (oldest !== undefined) {
        next.delete(oldest);
      }
    }
    set({ entries: next });
  },
  clearCache: () => set({ entries: new Map() }),
}));
