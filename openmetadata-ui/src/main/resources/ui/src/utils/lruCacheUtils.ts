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

/**
 * Minimal bounded LRU cache backed by a Map (insertion-order preserved).
 *
 * Pattern mirrors the ETag interceptor's `touch()` eviction logic in
 * `rest/etagInterceptor.ts`. On every write the key is moved to the back
 * (most-recently-used); when the map exceeds `maxSize` the front entry
 * (least-recently-used) is evicted.
 *
 * Used by the dashboard SWR caches and the user-profile cache to prevent
 * unbounded memory growth during long-lived SPA sessions.
 */
export interface LruCache<T> {
  get(key: string): T | undefined;
  has(key: string): boolean;
  set(key: string, value: T): void;
  delete(key: string): void;
  clear(): void;
}

export function makeLruCache<T>(maxSize: number): LruCache<T> {
  const store = new Map<string, T>();

  return {
    get: (key) => {
      if (!store.has(key)) {
        return undefined;
      }
      const value = store.get(key) as T;
      store.delete(key);
      store.set(key, value);

      return value;
    },
    has: (key) => store.has(key),
    set: (key, value) => {
      store.delete(key);
      store.set(key, value);
      if (store.size > maxSize) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) {
          store.delete(oldest);
        }
      }
    },
    delete: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}
