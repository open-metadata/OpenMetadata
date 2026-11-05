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

// Reclaim a lock only if it is CURRENTLY stale. Re-reads the file on every call
// (never a value cached across poll iterations) and steals it atomically by
// renaming it aside: `rename` is atomic, so of several racing waiters exactly
// one wins and the losers get ENOENT. Renaming — rather than unlinking the live
// path — is what prevents the double-unlink race where two waiters each remove
// the lock and both then believe they hold it. A holder that has since written
// a FRESH lock reads as not-stale here, so its lock is never stolen.
const tryReclaimStaleLock = (): void => {
  try {
    const raw = fs.readFileSync(LOCK_PATH, 'utf8').split('\n');
    const holderPid = Number(raw[0]);
    const heldAt = Number(raw[1]);
    const stale =
      Date.now() - heldAt > LOCK_STALE_MS ||
      !(holderPid > 0 && isPidAlive(holderPid));
    if (!stale) {
      return;
    }
    const stolen = `${LOCK_PATH}.stale.${process.pid}`;
    fs.renameSync(LOCK_PATH, stolen);
    try {
      fs.unlinkSync(stolen);
    } catch {
      // The stolen copy is ours to remove; a failure here just leaves a stray
      // temp file, never a held lock.
    }
  } catch {
    // Lock vanished / was reclaimed by a peer between read and rename — just
    // let the caller retry the exclusive create.
  }
};

const acquireFileLock = async (): Promise<() => void> => {
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
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw err;
      }
      tryReclaimStaleLock();
      await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
    }
  }
  throw new Error(
    `Timed out (${LOCK_ACQUIRE_TIMEOUT_MS}ms) acquiring appConfig mutex at ${LOCK_PATH}`
  );
};

// In-process reentrancy depth. Playwright runs each spec file in its own worker
// process and tests within a worker serially, so there is no in-process
// concurrency to guard — this counter only distinguishes a genuinely NESTED
// `withAppConfigLock` call (already holding the file lock on this process's call
// stack) from a fresh acquire. Cross-process exclusion is the file lock's job.
let heldDepth = 0;

/**
 * Run `critical` while holding the cross-worker `appConfiguration` mutex.
 * Releases the file lock in `finally`, even when `critical` throws.
 *
 * A NESTED call from within a `critical` already holding the lock re-enters
 * without touching the file lock (the process already owns it). Without this the
 * nested call would hit its own EEXIST, judge the live holder alive-and-fresh,
 * and busy-wait to the acquire timeout — a self-deadlock.
 */
export const withAppConfigLock = async <T>(
  critical: () => Promise<T>
): Promise<T> => {
  if (heldDepth > 0) {
    heldDepth += 1;
    try {
      return await critical();
    } finally {
      heldDepth -= 1;
    }
  }

  const release = await acquireFileLock();
  heldDepth += 1;
  try {
    return await critical();
  } finally {
    heldDepth -= 1;
    release();
  }
};
