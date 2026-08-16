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

export class CrossTabLock {
  private readonly channel: BroadcastChannel;

  constructor(private readonly lockName: string, channelName: string) {
    this.channel = new BroadcastChannel(channelName);
  }

  async runExclusive<T>(
    work: () => Promise<T>,
    options: { waitTimeoutMs?: number } = {}
  ): Promise<T | 'follower-waited'> {
    const waitTimeoutMs = options.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
    const locks = (navigator as unknown as { locks?: LockManager }).locks;
    if (!locks) {
      return this.runWithoutWebLocks(work);
    }
    let acquired = false;
    let result: T | 'follower-waited' = 'follower-waited';
    await locks.request(
      this.lockName,
      { mode: 'exclusive', ifAvailable: true },
      async (lock) => {
        if (!lock) {
          return;
        }
        acquired = true;
        result = await work();
        this.channel.postMessage({ type: 'done' });
      }
    );
    if (!acquired) {
      await this.waitForDone(waitTimeoutMs);
    }

    return result;
  }

  notifyDone(): void {
    this.channel.postMessage({ type: 'done' });
  }

  private async runWithoutWebLocks<T>(
    work: () => Promise<T>
  ): Promise<T | 'follower-waited'> {
    return await work();
    // NOTE: Safari-private-mode without Web Locks falls back to per-tab
    // execution. The document expected volume is low enough that a rare
    // double-refresh in this environment is accepted (spec §5.3).
  }

  private waitForDone(timeoutMs: number): Promise<void> {
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
        if (event.data?.type === 'done') {
          clearTimeout(timer);
          this.channel.removeEventListener('message', onMessage);
          resolve();
        }
      };
      this.channel.addEventListener('message', onMessage);
    });
  }
}
