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

type CacheModule = typeof import('./userProfileCache.utils');

const buildUser = (name: string): User =>
  ({
    id: name,
    name,
    email: `${name}@example.com`,
    profile: { images: { image512: `${name}-512` } },
  } as User);

const readStorage = () =>
  JSON.parse(localStorage.getItem(USER_PROFILE_CACHE_KEY) ?? 'null');

describe('userProfileCache.utils', () => {
  let getPersistedUserProfiles: CacheModule['getPersistedUserProfiles'];
  let persistUserProfile: CacheModule['persistUserProfile'];
  let clearUserProfileCache: CacheModule['clearUserProfileCache'];

  beforeEach(() => {
    // Reset module-level in-memory cache so each test hydrates from a clean slate.
    jest.resetModules();
    jest.useFakeTimers();
    jest.setSystemTime(1_000_000);
    localStorage.clear();
    ({
      getPersistedUserProfiles,
      persistUserProfile,
      clearUserProfileCache,
    } = require('./userProfileCache.utils'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('persists and reads back a profile from the in-memory mirror', () => {
    persistUserProfile('john', buildUser('john'));

    expect(getPersistedUserProfiles().john.email).toBe('john@example.com');
  });

  it('coalesces writes into a single storage flush on the next tick', () => {
    persistUserProfile('a', buildUser('a'));
    persistUserProfile('b', buildUser('b'));

    expect(readStorage()).toBeNull();

    jest.runAllTimers();

    expect(Object.keys(readStorage().profiles)).toEqual(['a', 'b']);
  });

  it('drops the whole cache once it is older than 24 hours', () => {
    localStorage.setItem(
      USER_PROFILE_CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now() - TWENTY_FOUR_HOUR_MS - 1,
        profiles: { fresh: buildUser('fresh'), stale: buildUser('stale') },
      })
    );

    expect(getPersistedUserProfiles()).toEqual({});
    expect(localStorage.getItem(USER_PROFILE_CACHE_KEY)).toBeNull();
  });

  it('keeps a fixed window across writes (does not slide on new writes)', () => {
    jest.setSystemTime(1000);
    persistUserProfile('a', buildUser('a'));

    jest.setSystemTime(1000 + TWENTY_FOUR_HOUR_MS - 1);
    persistUserProfile('b', buildUser('b'));
    jest.runAllTimers();

    const raw = readStorage();

    expect(raw.timestamp).toBe(1000);
    expect(Object.keys(raw.profiles)).toEqual(['a', 'b']);
  });

  it('starts a fresh window when writing into an expired cache', () => {
    jest.setSystemTime(1000);
    persistUserProfile('old', buildUser('old'));

    jest.setSystemTime(1000 + TWENTY_FOUR_HOUR_MS + 5);
    persistUserProfile('new', buildUser('new'));

    const result = getPersistedUserProfiles();

    expect(result.old).toBeUndefined();
    expect(result.new).toBeDefined();
  });

  it('does not persist error placeholders (no profile, empty email)', () => {
    persistUserProfile('ghost', { id: 'ghost', name: 'ghost', email: '' });
    jest.runAllTimers();

    expect(getPersistedUserProfiles()).toEqual({});
    expect(readStorage()).toBeNull();
  });

  it('evicts the oldest entries once the size cap is exceeded', () => {
    for (let i = 0; i <= USER_PROFILE_CACHE_MAX_SIZE; i++) {
      persistUserProfile(`user-${i}`, buildUser(`user-${i}`));
    }

    const result = getPersistedUserProfiles();

    expect(Object.keys(result)).toHaveLength(USER_PROFILE_CACHE_MAX_SIZE);
    expect(result['user-0']).toBeUndefined();
    expect(result[`user-${USER_PROFILE_CACHE_MAX_SIZE}`]).toBeDefined();
  });

  it('returns an empty map when storage is corrupt (invalid JSON)', () => {
    localStorage.setItem(USER_PROFILE_CACHE_KEY, 'not-json');

    expect(getPersistedUserProfiles()).toEqual({});
  });

  it('falls back to empty for a valid-JSON blob of the wrong shape', () => {
    // e.g. the pre-refactor Record<string, {user, timestamp}> format, or null.
    localStorage.setItem(
      USER_PROFILE_CACHE_KEY,
      JSON.stringify({ someUser: { user: buildUser('x'), timestamp: 1 } })
    );

    expect(getPersistedUserProfiles()).toEqual({});
    expect(() => persistUserProfile('y', buildUser('y'))).not.toThrow();
  });

  it('clearUserProfileCache wipes memory and storage', () => {
    persistUserProfile('john', buildUser('john'));
    jest.runAllTimers();

    expect(readStorage()).not.toBeNull();

    clearUserProfileCache();

    expect(getPersistedUserProfiles()).toEqual({});
    expect(localStorage.getItem(USER_PROFILE_CACHE_KEY)).toBeNull();
  });
});
