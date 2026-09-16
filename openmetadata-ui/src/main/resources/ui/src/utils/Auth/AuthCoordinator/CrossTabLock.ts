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

const DEFAULT_WAIT_TIMEOUT_MS = 10_000;

export type LockDoneMessage = { type: 'done'; payload?: unknown };
export type LockFailedMessage = { type: 'failed'; reason?: string };
export type LockMessage = LockDoneMessage | LockFailedMessage;

export type LockResult<T> =
  | { role: 'leader'; value: T }
  | { role: 'follower'; message: LockMessage };

export class CrossTabLock {
  private readonly channel: BroadcastChannel;

  constructor(private readonly lockName: string, channelName: string) {
    this.channel = new BroadcastChannel(channelName);
  }

  // Runs `work` under an exclusive cross-tab lock. The leader broadcast is NOT
  // sent from here — the caller is responsible for persisting any side-effects
  // (e.g. `setOidcToken`) and then calling `notifyDone(payload)` so followers
  // never observe a `done` signal before the fresh token is on disk.
  // If `work` throws, followers are notified with `failed` so they can attempt
  // their own refresh instead of waiting out the full timeout.
  async runExclusive<T>(
    work: () => Promise<T>,
    options: { waitTimeoutMs?: number } = {}
  ): Promise<LockResult<T>> {
    const waitTimeoutMs = options.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
    const locks = (navigator as unknown as { locks?: LockManager }).locks;
    if (!locks) {
      return { role: 'leader', value: await this.runWithoutWebLocks(work) };
    }
    // Attach the follower listener BEFORE requesting the lock. Otherwise a
    // leader whose refresh completes in the microseconds between our
    // `locks.request(..., ifAvailable:true)` returning `null` and our
    // subsequent `addEventListener('message', ...)` call would post its
    // `done` broadcast into a void — BroadcastChannel does not queue for
    // late subscribers — and the follower would wait out the full timeout
    // and then run its own redundant refresh, breaking the "exactly one
    // /auth/refresh across tabs" guarantee. Registering the listener up
    // front closes that window: if we end up acquiring the lock ourselves
    // we tear the pending listener down before returning.
    const pending = this.startListening(waitTimeoutMs);
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
      pending.cancel();

      throw err;
    }
    if (acquired) {
      pending.cancel();

      return { role: 'leader', value: leaderValue as T };
    }
    const message = await pending.promise;

    return { role: 'follower', message };
  }

  notifyDone(payload?: unknown): void {
    this.channel.postMessage({ type: 'done', payload } as LockDoneMessage);
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

  // Split of `waitForMessage` that returns both the promise and a sync
  // `cancel` handle. The listener is attached BEFORE `locks.request` runs so
  // no `done` / `failed` broadcast can slip through the gap while we discover
  // which role we're playing; `cancel()` tears everything down when we turn
  // out to be the leader (or the lock request itself throws) and no follower
  // wait is actually needed.
  private startListening(timeoutMs: number): {
    promise: Promise<LockMessage>;
    cancel: () => void;
  } {
    let cancel = () => undefined as void;
    const promise = new Promise<LockMessage>((resolve, reject) => {
      let settled = false;
      // `timer` and `onMessage` reference each other (the timeout tears
      // the listener down, and the listener clears the timer), so one has
      // to be declared before the other is defined. Disable the check on
      // the single line that needs it rather than restructure around the
      // cyclic reference.
      const timer = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.channel.removeEventListener('message', onMessage);
        reject(new LockTimeoutError());
      }, timeoutMs);
      const onMessage = (event: MessageEvent) => {
        const data = event.data as LockMessage | undefined;
        if (settled || (data?.type !== 'done' && data?.type !== 'failed')) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        this.channel.removeEventListener('message', onMessage);
        resolve(data);
      };
      this.channel.addEventListener('message', onMessage);
      // `cancel()` sets `settled` before tearing down so the pending promise
      // is neither resolved nor rejected. That leaves it dangling forever,
      // which is fine: on the leader path we return before consuming it, and
      // a never-settled promise does not raise an unhandled-rejection.
      cancel = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        this.channel.removeEventListener('message', onMessage);
      };
    });

    return { promise, cancel };
  }
}
