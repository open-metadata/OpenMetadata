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

export class LockTimeoutError extends Error {
  constructor(message = 'Cross-tab lock wait timed out') {
    super(message);
    this.name = 'LockTimeoutError';
  }
}

// The soft ceiling that only bounds truly pathological hangs: the leader tab
// is still alive (so its Web Lock is still held and the follower's blocking
// request never unblocks) but its refresh routine is wedged and never
// broadcasts. In every healthy scenario the follower resolves earlier —
// either from the leader's `done`/`failed` broadcast or from the leader
// releasing its Web Lock — so this ceiling is deliberately generous. 60s is
// well past any reasonable IdP round-trip so a slow-but-healthy leader never
// triggers a sign-out, but still catches a genuinely stuck tab within a
// bounded time (Greptile P1 r4043885089).
const DEFAULT_WAIT_TIMEOUT_MS = 60_000;

export type LockDoneMessage = { type: 'done'; payload?: unknown };
export type LockFailedMessage = { type: 'failed'; reason?: string };
export type LockMessage = LockDoneMessage | LockFailedMessage;

export type LockResult<T> =
  | { role: 'leader'; value: T }
  | { role: 'follower'; message: LockMessage };

// Extracted so the message-listener attachment can happen synchronously,
// BEFORE the `ifAvailable:true` probe issues its own lock request. Otherwise
// a leader whose refresh completes in the microseconds between our probe
// returning `null` and our subsequent `addEventListener` call would post its
// `done` broadcast into a void — BroadcastChannel does not queue for late
// subscribers — and the follower would wait out the entire soft timeout and
// then run its own redundant refresh, breaking the "exactly one /auth/refresh
// across tabs" guarantee.
interface MessageListener {
  received: () => LockMessage | undefined;
  onMessage: (cb: (message: LockMessage) => void) => void;
  cancel: () => void;
}

export class CrossTabLock {
  private readonly channel: BroadcastChannel;

  constructor(private readonly lockName: string, channelName: string) {
    this.channel = new BroadcastChannel(channelName);
  }

  // Runs `work` under an exclusive cross-tab lock. The optional `publish`
  // hook runs — still under the lock — immediately after `work` resolves
  // and receives the work's value; use it to persist side-effects (e.g.
  // `setOidcToken`) AND to broadcast the `done` signal so both happen
  // atomically before the lock is released. Without `publish` doing both,
  // a second tab whose `ifAvailable:true` probe lands in the microseconds
  // between the leader's lock release and its own `notifyDone` call would
  // acquire the freed lock, become another leader, and re-invoke the
  // provider renewer — with rotating refresh tokens that duplicate
  // renewal invalidates the first result. Callers that only need
  // `notifyDone` (no persistence) can put just the broadcast in `publish`.
  //
  // If either `work` or `publish` throws, followers are notified with
  // `failed` (also under the lock) so they can attempt their own refresh
  // instead of waiting out the full timeout.
  async runExclusive<T>(
    work: () => Promise<T>,
    options: {
      waitTimeoutMs?: number;
      publish?: (value: T) => Promise<void>;
    } = {}
  ): Promise<LockResult<T>> {
    const waitTimeoutMs = options.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
    const { publish } = options;
    const locks = (navigator as unknown as { locks?: LockManager }).locks;
    if (!locks) {
      const value = await this.runWithoutWebLocks(work);
      if (publish) {
        await publish(value);
      }

      return { role: 'leader', value };
    }

    // Attach the follower message listener BEFORE any lock request so a
    // `done` posted between our probe returning `null` and the follower
    // wait starting is not lost — see the docblock on `MessageListener`.
    const listener = this.attachMessageListener();
    let acquired = false;
    let leaderValue: T | undefined;
    try {
      await locks.request(
        this.lockName,
        { mode: 'exclusive', ifAvailable: true },
        async (lock) => {
          if (!lock) {
            return;
          }
          acquired = true;
          try {
            leaderValue = await work();
            if (publish) {
              await publish(leaderValue);
            }
          } catch (err) {
            this.channel.postMessage({
              type: 'failed',
              reason: err instanceof Error ? err.message : String(err),
            } as LockFailedMessage);

            throw err;
          }
        }
      );
    } catch (err) {
      listener.cancel();

      throw err;
    }
    if (acquired) {
      listener.cancel();

      return { role: 'leader', value: leaderValue as T };
    }
    // Follower path. If a `done`/`failed` already arrived while the probe
    // was in flight, honor it directly and skip the leader-death race.
    const buffered = listener.received();
    if (buffered) {
      listener.cancel();

      return { role: 'follower', message: buffered };
    }
    const message = await this.raceForFollowerOutcome(
      listener,
      waitTimeoutMs,
      locks
    );

    return { role: 'follower', message };
  }

  notifyDone(payload?: unknown): void {
    this.channel.postMessage({ type: 'done', payload } as LockDoneMessage);
  }

  // Global (non-scoped) subscription to `done` broadcasts on the shared
  // channel — lets a passive tab observe sibling refreshes without
  // running its own runExclusive cycle. Used by AuthCoordinator to
  // keep its sync `lastMintedToken` in sync with tokens minted by
  // sibling tabs so the cycle circuit-breaker can distinguish
  // "still-rejected current token" (real refresh loop) from
  // "in-flight straggler carrying a pre-refresh token" across tabs.
  onDoneBroadcast(cb: (payload: unknown) => void): () => void {
    const handler = (event: MessageEvent) => {
      const data = event.data as LockMessage | undefined;
      if (data?.type === 'done') {
        cb(data.payload);
      }
    };
    this.channel.addEventListener('message', handler);

    return () => this.channel.removeEventListener('message', handler);
  }

  notifyFailed(reason?: string): void {
    this.channel.postMessage({ type: 'failed', reason } as LockFailedMessage);
  }

  private async runWithoutWebLocks<T>(work: () => Promise<T>): Promise<T> {
    return await work();
    // NOTE: Safari-private-mode without Web Locks falls back to per-tab
    // execution. The document expected volume is low enough that a rare
    // double-refresh in this environment is accepted (spec §5.3).
  }

  // Synchronous attach: buffers at most one terminal message received before
  // a subscriber calls `onMessage`. Followers drain the buffer immediately
  // after they discover they didn't win the `ifAvailable:true` probe so a
  // broadcast that arrived during the probe window isn't lost.
  private attachMessageListener(): MessageListener {
    let buffered: LockMessage | undefined;
    let subscriber: ((message: LockMessage) => void) | undefined;
    const handler = (event: MessageEvent) => {
      const data = event.data as LockMessage | undefined;
      if (data?.type !== 'done' && data?.type !== 'failed') {
        return;
      }
      if (subscriber) {
        subscriber(data);
      } else {
        buffered = data;
      }
    };
    this.channel.addEventListener('message', handler);

    return {
      received: () => buffered,
      onMessage: (cb) => {
        subscriber = cb;
        if (buffered) {
          const msg = buffered;
          buffered = undefined;
          cb(msg);
        }
      },
      cancel: () => this.channel.removeEventListener('message', handler),
    };
  }

  // Event-driven follower wait — races three signals:
  //
  //   1. Leader broadcasts `done` or `failed`  →  return that message.
  //   2. Leader's Web Lock is released         →  return synthetic `failed`
  //                                               so the coordinator's
  //                                               follower-message path
  //                                               re-acquires cleanly. This
  //                                               is how we detect a crashed
  //                                               / closed / navigated-away
  //                                               leader — Web Locks are
  //                                               released by the browser on
  //                                               context teardown, so a
  //                                               blocking lock request
  //                                               unblocks in milliseconds
  //                                               rather than waiting for
  //                                               the soft timeout.
  //   3. Soft timeout                          →  reject with
  //                                               `LockTimeoutError`.
  //                                               Only bounds pathological
  //                                               hangs where the leader
  //                                               tab is alive (Web Lock
  //                                               still held) but wedged.
  //
  // Fixes greptile P1 r4043885089: the previous implementation only had (1)
  // and (3), with the timeout at 10s. A leader whose IdP round-trip
  // legitimately took >10s would trip the timeout even though it was still
  // working, and the follower would sign out as soon as the retry budget
  // was exhausted. Signal (2) makes leader-death detection near-instant,
  // and moving the timeout to 60s stops treating slow-but-healthy leaders
  // as failures.
  private async raceForFollowerOutcome(
    listener: MessageListener,
    timeoutMs: number,
    locks: LockManager
  ): Promise<LockMessage> {
    const abort = new AbortController();
    let settled = false;

    return new Promise<LockMessage>((resolve, reject) => {
      const finish = (
        outcome:
          | { kind: 'resolve'; message: LockMessage }
          | { kind: 'reject'; error: Error }
      ) => {
        if (settled) {
          return;
        }
        settled = true;
        // `timer` is declared below; the finish/timer cycle is intentional
        // (timer's callback calls finish, finish clears timer) so one side
        // has to reference the other before declaration.
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        clearTimeout(timer);
        abort.abort();
        listener.cancel();
        if (outcome.kind === 'resolve') {
          resolve(outcome.message);
        } else {
          reject(outcome.error);
        }
      };

      const timer = setTimeout(() => {
        finish({ kind: 'reject', error: new LockTimeoutError() });
      }, timeoutMs);

      listener.onMessage((message) => {
        finish({ kind: 'resolve', message });
      });

      // Blocking follower lock request. Resolves when the previous holder
      // releases (leader tab closed / crashed / finished + released the
      // lock normally). We deliberately do NO work in the callback — just
      // signal that the leader is gone and return, which releases the lock
      // immediately so the coordinator's retry can re-acquire it. Aborted
      // when the message-broadcast or timeout path wins first; the
      // `AbortError` is caught below.
      //
      // Grace window before synthesising `failed`: a HEALTHY leader
      // finishes by calling `notifyDone()` inside `publish` and then
      // returning from the lock callback. `notifyDone()`'s postMessage
      // dispatches asynchronously — even though the call itself happens
      // under the lock, the message can arrive at followers AFTER the
      // lock release grant. Without a grace, our blocking request would
      // preempt the pending `done`, we'd resolve `failed`, and the
      // coordinator would retry — a duplicate `renewer()` invocation
      // that with rotating refresh tokens invalidates the first result.
      // The grace holds THIS tab's newly-acquired lock briefly (~ one
      // event-loop turn plus a comfortable buffer for cross-context
      // postMessage) so a pending broadcast can land at our listener
      // and win the race via `finish()` first. Greptile r4053143978 /
      // gitar-bot r4053151880.
      const HANDOFF_GRACE_MS = 250;
      locks
        .request(
          this.lockName,
          { mode: 'exclusive', signal: abort.signal },
          async () => {
            await new Promise<void>((r) => setTimeout(r, HANDOFF_GRACE_MS));
            finish({
              kind: 'resolve',
              message: {
                type: 'failed',
                reason: 'leader released lock without broadcasting',
              },
            });
          }
        )
        .catch(() => {
          // AbortError from `abort.abort()` when the message or timeout path
          // won the race first — safe to swallow. Same catch handles a rare
          // browser-level rejection (e.g. Web Locks disabled mid-session);
          // in that case the message + timeout paths still cover us.
        });
    });
  }
}
