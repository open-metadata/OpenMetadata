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
import {
  getPersistedUserProfiles,
  persistUserProfile,
} from './userProfileCache.utils';

const buildUser = (name: string): User =>
  ({
    id: name,
    name,
    email: `${name}@example.com`,
    profile: { images: { image512: `${name}-512` } },
  } as User);

describe('userProfileCache.utils', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('persists and reads back a profile', () => {
    persistUserProfile('john', buildUser('john'));

    expect(getPersistedUserProfiles().john.email).toBe('john@example.com');
  });

  it('drops entries older than 24 hours and rewrites the pruned cache', () => {
    const fresh = buildUser('fresh');
    const stale = buildUser('stale');
    const now = Date.now();
    localStorage.setItem(
      USER_PROFILE_CACHE_KEY,
      JSON.stringify({
        fresh: { user: fresh, timestamp: now },
        stale: { user: stale, timestamp: now - TWENTY_FOUR_HOUR_MS - 1 },
      })
    );

    const result = getPersistedUserProfiles();

    expect(result.fresh).toBeDefined();
    expect(result.stale).toBeUndefined();
    expect(
      JSON.parse(localStorage.getItem(USER_PROFILE_CACHE_KEY) ?? '{}')
    ).not.toHaveProperty('stale');
  });

  it('does not persist error placeholders (no profile, empty email)', () => {
    persistUserProfile('ghost', { id: 'ghost', name: 'ghost', email: '' });

    expect(getPersistedUserProfiles()).toEqual({});
  });

  it('evicts the oldest entries once the size cap is exceeded', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    for (let i = 0; i <= USER_PROFILE_CACHE_MAX_SIZE; i++) {
      nowSpy.mockReturnValue(i);
      persistUserProfile(`user-${i}`, buildUser(`user-${i}`));
    }

    const result = getPersistedUserProfiles();

    expect(Object.keys(result)).toHaveLength(USER_PROFILE_CACHE_MAX_SIZE);
    expect(result['user-0']).toBeUndefined();
    expect(result[`user-${USER_PROFILE_CACHE_MAX_SIZE}`]).toBeDefined();
  });

  it('returns an empty map when storage is corrupt', () => {
    localStorage.setItem(USER_PROFILE_CACHE_KEY, 'not-json');

    expect(getPersistedUserProfiles()).toEqual({});
  });
});
