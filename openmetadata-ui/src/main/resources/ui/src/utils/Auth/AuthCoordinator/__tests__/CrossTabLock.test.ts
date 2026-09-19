/*
 *  Copyright 2022 Collate.
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

import { CrossTabLock, LockTimeoutError } from '../CrossTabLock';

type LockCb<T> = (lock: unknown | null) => Promise<T>;

const TEST_LOCK_NAME = 'test-lock';
const TEST_CHANNEL_NAME = 'test-channel';

describe('CrossTabLock (Web Locks path)', () => {
  let held: Set<string>;
  // Queue of blocking waiters per lock name. Each entry has a `run` that the
  // release path invokes when it's this waiter's turn, and a `signal` so the
  // release loop can skip aborted requests. Mirrors the real navigator.locks
  // ordering: FIFO among pending waiters, unblocks in the microtask the
  // holder's callback returns in.
  let waiterQueues: Map<string, Array<{ run: () => void; signal?: AbortSignal }>>;

  beforeEach(() => {
    // The global BroadcastChannel stub in setupTests.js hands back independent
    // jest.fn()s for postMessage/addEventListener that never wire together, so
    // notifyDone() can never reach a listener registered on the same channel.
    // Override it locally (this suite only) with a fake that self-delivers,
    // which is what a single-instance unit test of the follower-wait path needs.
    window.BroadcastChannel = jest.fn().mockImplementation(() => {
      const listeners = new Set<(event: MessageEvent) => void>();

      return {
        postMessage: jest.fn((data: unknown) => {
          listeners.forEach((listener) => listener({ data } as MessageEvent));
        }),
        addEventListener: jest.fn(
          (_type: string, listener: (event: MessageEvent) => void) => {
            listeners.add(listener);
          }
        ),
        removeEventListener: jest.fn(
          (_type: string, listener: (event: MessageEvent) => void) => {
            listeners.delete(listener);
          }
        ),
        close: jest.fn(),
      };
    });

    // Real elapsed time is required here (the leader's notifyDone() and the
    // follower's waitForDone() timeout race against each other), but this repo
    // enables Jest fake timers globally (jest.config.js `fakeTimers.enableGlobally`),
    // so this suite opts back into real timers, matching the pattern used
    // elsewhere (e.g. SseStreamUtils.test.ts).
    jest.useRealTimers();
    held = new Set();
    waiterQueues = new Map();

    const releaseNext = (name: string) => {
      const q = waiterQueues.get(name);
      if (!q) {
        return;
      }
      // Drop any aborted entries first so they don't win a phantom slot.
      while (q.length && q[0].signal?.aborted) {
        q.shift();
      }
      const next = q.shift();
      if (next) {
        next.run();
      }
    };

    // Plain `globalThis.navigator = {...}` is a silent no-op under jsdom
    // (navigator is an accessor with no setter on the window proxy), so the
    // fake Locks API must be installed via defineProperty instead.
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        locks: {
          request: jest.fn(
            async (
              name: string,
              opts: { ifAvailable?: boolean; signal?: AbortSignal },
              cb: LockCb<unknown>
            ) => {
              // ifAvailable probe: never queues; returns immediately with
              // either the lock or `null` if held.
              if (opts.ifAvailable) {
                if (held.has(name)) {
                  return cb(null);
                }
                held.add(name);
                try {
                  return await cb({});
                } finally {
                  held.delete(name);
                  releaseNext(name);
                }
              }

              // Blocking path: queue behind the current holder (if any) and
              // resolve when it's our turn OR when our AbortSignal fires.
              if (held.has(name)) {
                await new Promise<void>((resolve, reject) => {
                  const entry = {
                    run: resolve,
                    signal: opts.signal,
                  };
                  const q = waiterQueues.get(name) ?? [];
                  q.push(entry);
                  waiterQueues.set(name, q);

                  if (opts.signal) {
                    const onAbort = () => {
                      const queue = waiterQueues.get(name);
                      if (queue) {
                        const i = queue.indexOf(entry);
                        if (i >= 0) {
                          queue.splice(i, 1);
                        }
                      }
                      // Match browser: aborted lock.request rejects with an
                      // AbortError-shaped DOMException.
                      reject(
                        new DOMException('Aborted', 'AbortError')
                      );
                    };
                    if (opts.signal.aborted) {
                      onAbort();

                      return;
                    }
                    opts.signal.addEventListener('abort', onAbort, {
                      once: true,
                    });
                  }
                });
              }

              held.add(name);
              try {
                return await cb({});
              } finally {
                held.delete(name);
                releaseNext(name);
              }
            }
          ),
        },
      },
    });
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('runs the work as leader when lock is available', async () => {
    const lock = new CrossTabLock(TEST_LOCK_NAME, TEST_CHANNEL_NAME);
    const result = await lock.runExclusive(async () => 42);

    expect(result).toEqual({ role: 'leader', value: 42 });
  });

  it('follower receives leader payload when notifyDone carries it', async () => {
    const lock = new CrossTabLock(TEST_LOCK_NAME, TEST_CHANNEL_NAME);
    held.add(TEST_LOCK_NAME);
    const payload = { idToken: 'from-leader', expiresAt: 12_345 };
    const p = lock.runExclusive(async () => 42, { waitTimeoutMs: 500 });
    setTimeout(() => lock.notifyDone(payload), 20);

    await expect(p).resolves.toEqual({
      role: 'follower',
      message: { type: 'done', payload },
    });
  });

  it('follower receives failed message so it can attempt its own refresh', async () => {
    const lock = new CrossTabLock(TEST_LOCK_NAME, TEST_CHANNEL_NAME);
    held.add(TEST_LOCK_NAME);
    const p = lock.runExclusive(async () => 42, { waitTimeoutMs: 500 });
    setTimeout(() => lock.notifyFailed('boom'), 20);

    await expect(p).resolves.toEqual({
      role: 'follower',
      message: { type: 'failed', reason: 'boom' },
    });
  });

  it('runExclusive broadcasts failed when the leader work throws', async () => {
    const lock = new CrossTabLock(TEST_LOCK_NAME, TEST_CHANNEL_NAME);
    // Each new BroadcastChannel() in the local mock creates an independent
    // listener set, so listen on the lock's own channel — the mock's
    // postMessage self-delivers to same-instance listeners.
    const received: unknown[] = [];
    (
      lock as unknown as {
        channel: {
          addEventListener: (t: string, cb: (e: MessageEvent) => void) => void;
        };
      }
    ).channel.addEventListener('message', (event: MessageEvent) => {
      received.push(event.data);
    });

    await expect(
      lock.runExclusive(async () => {
        throw new Error('renewer blew up');
      })
    ).rejects.toThrow('renewer blew up');

    expect(received).toEqual([{ type: 'failed', reason: 'renewer blew up' }]);
  });

  it('throws LockTimeoutError if the leader never notifies', async () => {
    const lock = new CrossTabLock(TEST_LOCK_NAME, TEST_CHANNEL_NAME);
    held.add(TEST_LOCK_NAME);

    await expect(
      lock.runExclusive(async () => 42, { waitTimeoutMs: 50 })
    ).rejects.toBeInstanceOf(LockTimeoutError);
  });

  // Greptile P1 (r4023829117): before the `publish` hook was added,
  // AuthCoordinator's leader path released the lock (return from
  // `runExclusive`) BEFORE awaiting `setOidcToken` + calling
  // `notifyDone`. A sibling tab's `ifAvailable:true` probe landing in
  // that gap would acquire the freed lock, become another leader, and
  // re-invoke the provider renewer — a duplicate rotating-refresh call
  // that invalidates the first leader's session. These two tests pin
  // the invariant: the lock name is still `held` throughout the
  // `publish` callback (so a concurrent `ifAvailable` probe would still
  // see the lock as taken), and — regression guard — a probe that
  // actually races the callback observes the lock as unavailable.
  it('holds the lock while the publish callback runs', async () => {
    const lock = new CrossTabLock(TEST_LOCK_NAME, TEST_CHANNEL_NAME);
    let heldDuringPublish = false;

    await lock.runExclusive(async () => 'work-result', {
      publish: async () => {
        heldDuringPublish = held.has(TEST_LOCK_NAME);
      },
    });

    expect(heldDuringPublish).toBe(true);
  });

  // Greptile P1 (r4043885089): the previous impl only had (broadcast, soft
  // timeout) as follower signals, so a leader whose refresh legitimately
  // took longer than the 10s wait would trip the timeout even while it was
  // still working — and after AuthCoordinator's one retry, the follower
  // signed out. The event-driven wait now races a THIRD signal: a blocking
  // Web Lock request that unblocks the microsecond the previous holder
  // releases (crashed tab / closed tab / just-finished-and-released). Both
  // regressions this fixes:
  //
  //   1. A leader taking 30s to complete but broadcasting `done` correctly
  //      resolves the follower with that payload — no LockTimeoutError.
  //   2. A leader that dies (closes / crashes) without broadcasting
  //      resolves the follower via the leader-released signal, in the
  //      microtask the holder's callback returns rather than after the
  //      soft 60s ceiling.
  it('follower still receives the leader payload when the leader takes hundreds of ms, well past the previous 10s ceiling would have needed', async () => {
    const lock = new CrossTabLock(TEST_LOCK_NAME, TEST_CHANNEL_NAME);
    // Passing a generous `waitTimeoutMs` here is the point: the default
    // soft ceiling is now 60s (up from 10s) so a slow-but-healthy leader
    // can't trip a spurious LockTimeoutError. The 300ms hold below stands
    // in for the pathological CI cases (30-40s IdP round-trips) the fix
    // is really aimed at; keeping the test itself fast avoids adding
    // multi-second waits to the suite.
    held.add(TEST_LOCK_NAME);
    const payload = { idToken: 'slow-leader', expiresAt: 12_345 };
    const p = lock.runExclusive(async () => 42, { waitTimeoutMs: 5_000 });

    setTimeout(() => lock.notifyDone(payload), 300);

    await expect(p).resolves.toEqual({
      role: 'follower',
      message: { type: 'done', payload },
    });
  });

  it('follower unblocks immediately when the leader releases its lock without broadcasting', async () => {
    const lock = new CrossTabLock(TEST_LOCK_NAME, TEST_CHANNEL_NAME);
    // Model a crashed / closed leader: it acquires the lock, then goes
    // away WITHOUT broadcasting done or failed. The browser releases the
    // lock automatically; the follower's blocking request unblocks in
    // the very next microtask.
    held.add(TEST_LOCK_NAME);
    const start = Date.now();
    const p = lock.runExclusive(async () => 42, { waitTimeoutMs: 5_000 });

    setTimeout(() => {
      held.delete(TEST_LOCK_NAME);
      // Release the queued follower waiter — this is what the browser
      // does under a real navigator.locks on tab teardown.
      const queue = waiterQueues.get(TEST_LOCK_NAME);
      if (queue && queue.length > 0) {
        queue.shift()?.run();
      }
    }, 20);

    await expect(p).resolves.toEqual({
      role: 'follower',
      message: {
        type: 'failed',
        reason: 'leader released lock without broadcasting',
      },
    });
    // Sanity: must have unblocked promptly after the release, not after
    // the 5-second soft ceiling.
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('rejects a concurrent ifAvailable probe while publish is running', async () => {
    const lock = new CrossTabLock(TEST_LOCK_NAME, TEST_CHANNEL_NAME);
    let siblingBecameLeader: boolean | null = null;

    await lock.runExclusive(async () => 'work-result', {
      publish: async () => {
        // A second tab wakes up here and probes with ifAvailable:true.
        // The fake Locks API in this suite returns cb(null) when the
        // name is in `held`, so the sibling's callback receives null
        // and must NOT elevate itself to leader.
        await (
          navigator as unknown as {
            locks: {
              request: (
                name: string,
                opts: { ifAvailable?: boolean },
                cb: (l: unknown | null) => Promise<void>
              ) => Promise<void>;
            };
          }
        ).locks.request(TEST_LOCK_NAME, { ifAvailable: true }, async (l) => {
          siblingBecameLeader = l !== null;
        });
      },
    });

    expect(siblingBecameLeader).toBe(false);
  });
});
