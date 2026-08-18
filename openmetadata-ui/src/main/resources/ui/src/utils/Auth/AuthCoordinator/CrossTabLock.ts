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
    let acquired = false;
    let leaderValue: T | undefined;
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
    if (acquired) {
      return { role: 'leader', value: leaderValue as T };
    }
    const message = await this.waitForMessage(waitTimeoutMs);

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

  private waitForMessage(timeoutMs: number): Promise<LockMessage> {
    return new Promise((resolve, reject) => {
      // `timer` and `onMessage` reference each other (timeout cleans up the
      // listener, the listener clears the timer), so one must be declared
      // before the other is defined.
      const timer = setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.channel.removeEventListener('message', onMessage);
        reject(new LockTimeoutError());
      }, timeoutMs);
      const onMessage = (event: MessageEvent) => {
        const data = event.data as LockMessage | undefined;
        if (data?.type === 'done' || data?.type === 'failed') {
          clearTimeout(timer);
          this.channel.removeEventListener('message', onMessage);
          resolve(data);
        }
      };
      this.channel.addEventListener('message', onMessage);
    });
  }
}
