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
import {
  TWENTY_FOUR_HOUR_MS,
  USER_PROFILE_CACHE_KEY,
  USER_PROFILE_CACHE_MAX_SIZE,
} from '../../constants/constants';
import { User } from '../../generated/entity/teams/user';

interface UserProfileCache {
  timestamp: number;
  profiles: Record<string, User>;
}

/**
 * In-memory source of truth for the current tab. localStorage is only read once
 * (lazily, on first access) and thereafter written from this mirror, so a burst
 * of avatar misses does not re-parse/re-serialize the whole blob per entry.
 */
let memoryCache: UserProfileCache | null = null;
let hydrated = false;
let flushScheduled = false;

const isValidShape = (value: unknown): value is UserProfileCache => {
  const cache = value as UserProfileCache | null;

  return (
    typeof cache === 'object' &&
    cache !== null &&
    typeof cache.timestamp === 'number' &&
    typeof cache.profiles === 'object' &&
    cache.profiles !== null
  );
};

const isExpired = (cache: UserProfileCache): boolean =>
  Date.now() - cache.timestamp >= TWENTY_FOUR_HOUR_MS;

/**
 * Loads the persisted cache into memory exactly once per tab. A malformed blob
 * (invalid JSON, wrong shape, or an older cache format) or an expired window is
 * discarded so callers fall back to re-fetching instead of crashing.
 */
const ensureHydrated = (): void => {
  if (hydrated) {
    return;
  }
  hydrated = true;

  try {
    const raw = localStorage.getItem(USER_PROFILE_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;

    if (isValidShape(parsed) && !isExpired(parsed)) {
      memoryCache = parsed;
    } else {
      memoryCache = null;
      if (raw) {
        localStorage.removeItem(USER_PROFILE_CACHE_KEY);
      }
    }
  } catch {
    memoryCache = null;
  }
};

const flush = (): void => {
  flushScheduled = false;
  try {
    if (memoryCache) {
      localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(memoryCache));
    } else {
      localStorage.removeItem(USER_PROFILE_CACHE_KEY);
    }
  } catch {
    // Storage full/unavailable — persistence is best-effort, so ignore.
  }
};

/**
 * Coalesces a burst of writes into a single serialize+persist on the next tick,
 * keeping the render hot path free of repeated full-cache JSON.stringify calls.
 */
const scheduleFlush = (): void => {
  if (flushScheduled) {
    return;
  }
  flushScheduled = true;
  setTimeout(flush, 0);
};

/**
 * An error-path placeholder (see useUserProfile) has an empty email and no
 * profile. We never persist those so a transient 4xx/5xx does not suppress a
 * user's avatar for the lifetime of the cache.
 */
const isPlaceholderProfile = (user: User): boolean =>
  !user.profile && (user.email ?? '') === '';

/**
 * Returns the persisted profiles keyed by name, or an empty map when the whole
 * cache has aged past its 24h window. The window is fixed from first write — it
 * does not slide on reads.
 */
export const getPersistedUserProfiles = (): Record<string, User> => {
  ensureHydrated();

  return memoryCache?.profiles ?? {};
};

/**
 * Write-through a single profile into the shared cache. The 24h window is
 * stamped once when the cache is (re)created and preserved across subsequent
 * writes; an expired cache is discarded and a new window started. Skips error
 * placeholders and evicts the oldest entries once the cap is exceeded.
 */
export const persistUserProfile = (id: string, user: User): void => {
  if (isPlaceholderProfile(user)) {
    return;
  }

  ensureHydrated();

  if (!memoryCache || isExpired(memoryCache)) {
    memoryCache = { timestamp: Date.now(), profiles: {} };
  }

  memoryCache.profiles[id] = user;

  const ids = Object.keys(memoryCache.profiles);
  if (ids.length > USER_PROFILE_CACHE_MAX_SIZE) {
    ids
      .slice(0, ids.length - USER_PROFILE_CACHE_MAX_SIZE)
      .forEach((staleId) => delete memoryCache?.profiles[staleId]);
  }

  scheduleFlush();
};

/**
 * Drops the cache from memory and storage. Called on logout so one user's
 * cached profiles cannot leak into the next session on a shared browser.
 */
export const clearUserProfileCache = (): void => {
  memoryCache = null;
  hydrated = true;
  flushScheduled = false;
  try {
    localStorage.removeItem(USER_PROFILE_CACHE_KEY);
  } catch {
    // best-effort
  }
};
