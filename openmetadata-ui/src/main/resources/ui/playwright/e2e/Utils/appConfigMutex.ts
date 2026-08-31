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

import fs from 'fs';
import os from 'os';
import path from 'path';

// Cross-worker mutex for tests that mutate `appConfiguration.defaultAppMode`.
// Playwright fans different spec files across workers, and within-file
// `describe.serial` cannot stop a sibling file's worker from flipping a
// shared server-side setting in the small window between our PUT and the
// boot resolver's fetch. The boot resolver locks the mode into the
// session tuple, so a race there silently corrupts the assertion.
//
// This mutex uses a `wx` (exclusive create) open on a well-known tmp
// file — atomic on POSIX and Windows — with stale-lock detection based
// on the writer PID. Consumers wrap their critical section in
// `withAppConfigLock(async () => { ... })`.
const LOCK_PATH = path.join(os.tmpdir(), 'om-appconfig-mutation.lock');
const LOCK_STALE_MS = 5 * 60_000;
const LOCK_POLL_MS = 50;
const LOCK_ACQUIRE_TIMEOUT_MS = 120_000;

const isPidAlive = (pid: number): boolean => {
  try {
    // Signal 0 doesn't kill; just checks reachability.
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

const acquire = async (): Promise<() => void> => {
  const start = Date.now();
  while (Date.now() - start < LOCK_ACQUIRE_TIMEOUT_MS) {
    try {
      const fd = fs.openSync(LOCK_PATH, 'wx');
      fs.writeSync(fd, `${process.pid}\n${Date.now()}\n`);
      fs.closeSync(fd);

      return () => {
        try {
          fs.unlinkSync(LOCK_PATH);
        } catch {
          // Best-effort — a parallel run of another test cleanup may have
          // already removed it. Not fatal.
        }
      };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') {
        throw err;
      }
      // Stale-lock check: if the file is older than `LOCK_STALE_MS` and
      // the writer PID isn't alive, treat it as abandoned.
      try {
        const raw = fs.readFileSync(LOCK_PATH, 'utf8').split('\n');
        const holderPid = Number(raw[0]);
        const heldAt = Number(raw[1]);
        const age = Date.now() - heldAt;
        const holderAlive = holderPid > 0 && isPidAlive(holderPid);
        if (age > LOCK_STALE_MS || !holderAlive) {
          fs.unlinkSync(LOCK_PATH);

          continue;
        }
      } catch {
        // Lock file vanished between EEXIST and read — retry the acquire.
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
    }
  }
  throw new Error(
    `Timed out (${LOCK_ACQUIRE_TIMEOUT_MS}ms) acquiring appConfig mutex at ${LOCK_PATH}`
  );
};

/**
 * Run `critical` while holding the cross-worker `appConfiguration`
 * mutex. Releases the lock in `finally`, even when `critical` throws.
 * Nested calls in the same process re-enter safely because we never
 * hold the lock across await points other than inside `critical` itself.
 */
export const withAppConfigLock = async <T>(
  critical: () => Promise<T>
): Promise<T> => {
  const release = await acquire();
  try {
    return await critical();
  } finally {
    release();
  }
};
