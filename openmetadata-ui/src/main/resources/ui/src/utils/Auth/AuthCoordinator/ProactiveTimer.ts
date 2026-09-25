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

export class ProactiveTimer {
  private handle: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly bufferMs = 60_000) {}

  schedule(expiresAt: number, callback: () => void): void {
    this.cancel();
    // A non-positive `expiresAt` (renewer without an exp claim, an opaque
    // token, or a decoding failure that fell through to 0 in
    // `extractDetailsFromToken`) is treated as "no valid expiry" — do not
    // schedule. Otherwise the timer would fire immediately, the callback
    // would compute expiresAt=0 again, reschedule, and hammer the IdP in a
    // tight loop. The next real 401 will still drive the refresh via the
    // axios interceptor.
    if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
      return;
    }
    const delay = Math.max(0, expiresAt - Date.now() - this.bufferMs);
    this.handle = setTimeout(() => {
      this.handle = null;
      callback();
    }, delay);
  }

  cancel(): void {
    if (this.handle !== null) {
      clearTimeout(this.handle);
      this.handle = null;
    }
  }

  isScheduled(): boolean {
    return this.handle !== null;
  }
}
