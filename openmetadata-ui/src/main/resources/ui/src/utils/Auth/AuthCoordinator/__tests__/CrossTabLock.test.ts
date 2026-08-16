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
              opts: { ifAvailable?: boolean },
              cb: LockCb<unknown>
            ) => {
              if (opts.ifAvailable && held.has(name)) {
                return cb(null);
              }
              held.add(name);
              try {
                return await cb({});
              } finally {
                held.delete(name);
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

  it('runs the work when lock is available', async () => {
    const lock = new CrossTabLock(TEST_LOCK_NAME, TEST_CHANNEL_NAME);
    const result = await lock.runExclusive(async () => 42);

    expect(result).toBe(42);
  });

  it('returns follower-waited when the lock is held elsewhere and notifyDone arrives', async () => {
    const lock = new CrossTabLock(TEST_LOCK_NAME, TEST_CHANNEL_NAME);
    held.add(TEST_LOCK_NAME);
    const p = lock.runExclusive(async () => 42, { waitTimeoutMs: 500 });
    // simulate leader completion
    setTimeout(() => lock.notifyDone(), 20);

    await expect(p).resolves.toBe('follower-waited');
  });

  it('throws LockTimeoutError if the leader never notifies', async () => {
    const lock = new CrossTabLock(TEST_LOCK_NAME, TEST_CHANNEL_NAME);
    held.add(TEST_LOCK_NAME);

    await expect(
      lock.runExclusive(async () => 42, { waitTimeoutMs: 50 })
    ).rejects.toBeInstanceOf(LockTimeoutError);
  });
});
