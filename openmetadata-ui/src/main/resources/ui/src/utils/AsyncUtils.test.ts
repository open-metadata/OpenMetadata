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
import { runWithConcurrencyLimit } from './AsyncUtils';

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

// Manually-resolved promise so ordering is controlled without timers
// (the repo's Jest config uses fake timers, so setTimeout would never fire).
const createDeferred = (): Deferred => {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });

  return { promise, resolve };
};

describe('runWithConcurrencyLimit', () => {
  it('returns results in original order regardless of settle order', async () => {
    const items = [0, 1, 2, 3];
    const gates = items.map(() => createDeferred());
    const pending = runWithConcurrencyLimit(items, 4, async (_, index) => {
      await gates[index].promise;

      return index;
    });

    // Settle in reverse order — the result array must still be index-ordered.
    gates[3].resolve();
    gates[2].resolve();
    gates[1].resolve();
    gates[0].resolve();

    await expect(pending).resolves.toEqual([0, 1, 2, 3]);
  });

  it('never exceeds the concurrency limit', async () => {
    const items = Array.from({ length: 6 }, (_, i) => i);
    const gates = items.map(() => createDeferred());
    let inFlight = 0;
    let peak = 0;

    const pending = runWithConcurrencyLimit(items, 3, async (index) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await gates[index].promise;
      inFlight -= 1;

      return index;
    });

    // Only the initial pool of 3 may be in flight before anything settles.
    expect(peak).toBe(3);

    gates.forEach((gate) => gate.resolve());
    await pending;

    expect(peak).toBe(3);
  });

  it('stops starting new work once shouldStop returns true', async () => {
    const items = Array.from({ length: 8 }, (_, i) => i);
    const gates = items.map(() => createDeferred());
    const started: number[] = [];
    let stop = false;

    const pending = runWithConcurrencyLimit(
      items,
      2,
      async (index) => {
        started.push(index);
        await gates[index].promise;

        return index;
      },
      () => stop
    );

    expect(started).toEqual([0, 1]);

    stop = true;
    gates[0].resolve();
    gates[1].resolve();
    await pending;

    // No further items are started after the stop signal trips.
    expect(started).toEqual([0, 1]);
  });

  it('processes every item when limit exceeds item count', async () => {
    const worker = jest.fn(async (n: number) => n * 2);
    const results = await runWithConcurrencyLimit([1, 2, 3], 10, worker);

    expect(worker).toHaveBeenCalledTimes(3);
    expect(results).toEqual([2, 4, 6]);
  });

  it('isolates per-item failures when the worker catches its own errors', async () => {
    const results = await runWithConcurrencyLimit(
      [1, 2, 3, 4],
      2,
      async (n) => {
        try {
          if (n % 2 === 0) {
            throw new Error(`fail ${n}`);
          }

          return n;
        } catch {
          return null;
        }
      }
    );

    expect(results).toEqual([1, null, 3, null]);
  });

  it('returns an empty array for empty input', async () => {
    const worker = jest.fn();
    const results = await runWithConcurrencyLimit([], 4, worker);

    expect(results).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });
});
