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

const readRawCache = (): UserProfileCache | null => {
  try {
    const raw = localStorage.getItem(USER_PROFILE_CACHE_KEY);

    return raw ? (JSON.parse(raw) as UserProfileCache) : null;
  } catch {
    // Corrupt/inaccessible storage falls back to no cache; the profiles simply
    // get re-fetched instead of breaking the app.
    return null;
  }
};

const writeRawCache = (cache: UserProfileCache): void => {
  try {
    localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full/unavailable — persistence is best-effort, so ignore.
  }
};

const isExpired = (cache: UserProfileCache): boolean =>
  Date.now() - cache.timestamp >= TWENTY_FOUR_HOUR_MS;

/**
 * An error-path placeholder (see useUserProfile) has an empty email and no
 * profile. We never persist those so a transient 4xx/5xx does not suppress a
 * user's avatar for the lifetime of the cache.
 */
const isPlaceholderProfile = (user: User): boolean =>
  !user.profile && (user.email ?? '') === '';

/**
 * Returns the persisted profiles keyed by name, or an empty map when the whole
 * cache has aged past its 24h window (in which case the stale blob is cleared).
 * The window is fixed from first write — it does not slide on reads.
 */
export const getPersistedUserProfiles = (): Record<string, User> => {
  const cache = readRawCache();

  if (!cache) {
    return {};
  }

  if (isExpired(cache)) {
    localStorage.removeItem(USER_PROFILE_CACHE_KEY);

    return {};
  }

  return cache.profiles;
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

  const existing = readRawCache();
  const cache: UserProfileCache =
    existing && !isExpired(existing)
      ? existing
      : { timestamp: Date.now(), profiles: {} };

  cache.profiles[id] = user;

  const ids = Object.keys(cache.profiles);
  if (ids.length > USER_PROFILE_CACHE_MAX_SIZE) {
    ids
      .slice(0, ids.length - USER_PROFILE_CACHE_MAX_SIZE)
      .forEach((staleId) => delete cache.profiles[staleId]);
  }

  writeRawCache(cache);
};
