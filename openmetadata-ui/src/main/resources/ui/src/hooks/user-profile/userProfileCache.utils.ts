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

interface CachedUserProfile {
  user: User;
  timestamp: number;
}

type UserProfileCache = Record<string, CachedUserProfile>;

const readRawCache = (): UserProfileCache => {
  try {
    const raw = localStorage.getItem(USER_PROFILE_CACHE_KEY);

    return raw ? (JSON.parse(raw) as UserProfileCache) : {};
  } catch {
    // Corrupt/inaccessible storage falls back to an empty cache; the profiles
    // simply get re-fetched instead of breaking the app.
    return {};
  }
};

const writeRawCache = (cache: UserProfileCache): void => {
  try {
    localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full/unavailable — persistence is best-effort, so ignore.
  }
};

/**
 * An error-path placeholder (see useUserProfile) has an empty email and no
 * profile. We never persist those so a transient 4xx/5xx does not suppress a
 * user's avatar for a full 24 hours.
 */
const isPlaceholderProfile = (user: User): boolean =>
  !user.profile && (user.email ?? '') === '';

/**
 * Returns the non-expired persisted profiles keyed by name and rewrites the
 * pruned map back to storage. Used to hydrate the in-memory store on load.
 */
export const getPersistedUserProfiles = (): Record<string, User> => {
  const cache = readRawCache();
  const now = Date.now();
  const valid: Record<string, User> = {};
  const pruned: UserProfileCache = {};

  Object.entries(cache).forEach(([id, entry]) => {
    if (entry && now - entry.timestamp < TWENTY_FOUR_HOUR_MS) {
      valid[id] = entry.user;
      pruned[id] = entry;
    }
  });

  if (Object.keys(pruned).length !== Object.keys(cache).length) {
    writeRawCache(pruned);
  }

  return valid;
};

/**
 * Write-through a single profile with a fresh 24h timestamp. Skips error
 * placeholders and evicts the oldest entries once the cache exceeds its cap.
 */
export const persistUserProfile = (id: string, user: User): void => {
  if (isPlaceholderProfile(user)) {
    return;
  }

  const cache = readRawCache();
  cache[id] = { user, timestamp: Date.now() };

  const ids = Object.keys(cache);
  if (ids.length > USER_PROFILE_CACHE_MAX_SIZE) {
    ids
      .sort((a, b) => cache[a].timestamp - cache[b].timestamp)
      .slice(0, ids.length - USER_PROFILE_CACHE_MAX_SIZE)
      .forEach((staleId) => delete cache[staleId]);
  }

  writeRawCache(cache);
};
