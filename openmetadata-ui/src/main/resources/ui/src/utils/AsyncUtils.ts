/*
 *  Copyright 2025 Collate.
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
 * Run an async worker over `items` with at most `limit` executions in flight at
 * once, instead of one-at-a-time (`for … await`) or all-at-once (`Promise.all`).
 *
 * Results are written back by original index, so the returned array is in the
 * same order as `items`. A worker that rejects propagates its rejection (wrap
 * per-item error handling inside `worker` if you need isolation).
 *
 * If `shouldStop` is provided and returns `true`, no further items are started;
 * already in-flight tasks still settle. Indices that were never started are left
 * as holes (`undefined`) — filter the result if the caller needs only completed
 * values.
 */
export const runWithConcurrencyLimit = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  shouldStop?: () => boolean
): Promise<(R | undefined)[]> => {
  const results = new Array<R | undefined>(items.length);
  let next = 0;

  const runNext = async (): Promise<void> => {
    while (next < items.length && !shouldStop?.()) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  };

  const poolSize = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: poolSize }, () => runNext()));

  return results;
};
