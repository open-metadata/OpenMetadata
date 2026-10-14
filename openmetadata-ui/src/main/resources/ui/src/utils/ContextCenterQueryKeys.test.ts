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
import { reconcileCountAfterAsyncDelete } from './ContextCenterQueryKeys';

const KEY = ['test-count'];

// jest.config enables fake timers globally; this helper's whole job is to wait
// between refetches, so it needs a clock that actually advances. `intervalMs: 0`
// keeps the real waits at a tick.
beforeAll(() => jest.useRealTimers());

afterAll(() => jest.useFakeTimers());

/**
 * A client whose query for KEY resolves to whatever the server "currently"
 * reports, so a test can make the background deletion land after N refetches.
 */
const buildClient = (serverTotal: () => number) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  queryClient.setQueryDefaults(KEY, { queryFn: async () => serverTotal() });

  return queryClient;
};

describe('reconcileCountAfterAsyncDelete', () => {
  it('drops the count immediately so the badge does not lag the 202', async () => {
    const queryClient = buildClient(() => 5);
    queryClient.setQueryData(KEY, 5);

    const pending = reconcileCountAfterAsyncDelete(queryClient, KEY, {
      attempts: 1,
      intervalMs: 0,
    });

    // Optimistic value is applied synchronously, before any refetch.
    expect(queryClient.getQueryData(KEY)).toBe(4);

    await pending;
  });

  it('keeps polling while the server still reports the pre-delete total', async () => {
    let refetches = 0;
    // The background delete lands only on the 3rd refetch.
    const queryClient = buildClient(() => (++refetches < 3 ? 5 : 4));
    queryClient.setQueryData(KEY, 5);

    await reconcileCountAfterAsyncDelete(queryClient, KEY, {
      attempts: 5,
      intervalMs: 0,
    });

    expect(refetches).toBe(3);
    expect(queryClient.getQueryData(KEY)).toBe(4);
  });

  it('stops at the first refetch once the server agrees', async () => {
    let refetches = 0;
    const queryClient = buildClient(() => {
      refetches++;

      return 4;
    });
    queryClient.setQueryData(KEY, 5);

    await reconcileCountAfterAsyncDelete(queryClient, KEY, {
      attempts: 5,
      intervalMs: 0,
    });

    expect(refetches).toBe(1);
  });

  it('gives up after the configured attempts instead of polling forever', async () => {
    let refetches = 0;
    // Deletion never lands — the loop must still terminate.
    const queryClient = buildClient(() => {
      refetches++;

      return 5;
    });
    queryClient.setQueryData(KEY, 5);

    await reconcileCountAfterAsyncDelete(queryClient, KEY, {
      attempts: 3,
      intervalMs: 0,
    });

    expect(refetches).toBe(3);
  });

  it('keeps the optimistic value when the budget runs out', async () => {
    // Deletion never lands, so every refetch returns the pre-delete total.
    // Leaving that in the cache would restore the staleness this helper fixes.
    const queryClient = buildClient(() => 5);
    queryClient.setQueryData(KEY, 5);

    await reconcileCountAfterAsyncDelete(queryClient, KEY, {
      attempts: 2,
      intervalMs: 0,
    });

    expect(queryClient.getQueryData(KEY)).toBe(4);
  });

  it('does not let a concurrent delete chain off a polluted cache value', async () => {
    // The server is slow: it keeps reporting 5 while two deletes are in
    // flight. Each refetch writes that 5 back, so a second call reading the
    // cache naively would target 4 instead of 3.
    const queryClient = buildClient(() => 5);
    queryClient.setQueryData(KEY, 5);

    const first = reconcileCountAfterAsyncDelete(queryClient, KEY, {
      attempts: 3,
      intervalMs: 0,
    });
    const second = reconcileCountAfterAsyncDelete(queryClient, KEY, {
      attempts: 3,
      intervalMs: 0,
    });
    await Promise.all([first, second]);

    // Two accepted deletions against a server still reporting 5.
    expect(queryClient.getQueryData(KEY)).toBe(3);
  });

  it('never writes the badge below the target, even mid-poll', async () => {
    // Three deletes from a cached 10 → absolute target 7. The server applies
    // only one and sits at 9. Subtracting all three in-flight deletions from
    // the server's 9 would write 6, below the target and below the truth.
    // Sample every write, not just the end state: the final write would mask
    // a bad intermediate one.
    const queryClient = buildClient(() => 9);
    queryClient.setQueryData(KEY, 10);

    const seen: number[] = [];
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      const v = queryClient.getQueryData<number>(KEY);
      if (v !== undefined) {
        seen.push(v);
      }
    });

    await Promise.all(
      [1, 2, 3].map(() =>
        reconcileCountAfterAsyncDelete(queryClient, KEY, {
          attempts: 2,
          intervalMs: 0,
        })
      )
    );
    unsubscribe();

    // Every value this helper wrote is the target or the server's own figure —
    // never an over-subtracted one below both.
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(7);
    expect(queryClient.getQueryData(KEY)).toBe(7);
  });

  it('accounts for a delete that finished before the next one started', async () => {
    // A and B poll together against a cached 10. A's deletion lands (server 9)
    // and A exits, so only B is still polling when C starts. C must target 7,
    // not 8 — forgetting A would leave the badge one too high for good.
    let serverTotal = 10;
    const queryClient = buildClient(() => serverTotal);
    queryClient.setQueryData(KEY, 10);

    const a = reconcileCountAfterAsyncDelete(queryClient, KEY, {
      attempts: 1,
      intervalMs: 0,
    });
    const b = reconcileCountAfterAsyncDelete(queryClient, KEY, {
      attempts: 4,
      intervalMs: 0,
    });

    serverTotal = 9;
    await a;

    const c = reconcileCountAfterAsyncDelete(queryClient, KEY, {
      attempts: 4,
      intervalMs: 0,
    });
    await Promise.all([b, c]);

    expect(queryClient.getQueryData(KEY)).toBe(7);
  });

  it('does nothing when no count is cached — there is no badge to correct', async () => {
    let refetches = 0;
    const queryClient = buildClient(() => {
      refetches++;

      return 7;
    });

    await reconcileCountAfterAsyncDelete(queryClient, KEY, {
      attempts: 3,
      intervalMs: 0,
    });

    expect(refetches).toBe(0);
    expect(queryClient.getQueryData(KEY)).toBeUndefined();
  });
});
