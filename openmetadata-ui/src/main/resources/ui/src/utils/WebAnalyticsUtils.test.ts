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

import { getAnalyticInstance, getReferrerPath } from './WebAnalyticsUtils';

const userId = 'userId';

const mockReferrer =
  'http://localhost:3000/settings/members/teams/Organization';

describe('Web Analytics utils', () => {
  it('getAnalyticInstance Should return the analytic instance and must have plugins, storage, page and setAnonymousId property', () => {
    const instance = getAnalyticInstance(userId);

    expect(instance).toHaveProperty('plugins');

    expect(instance).toHaveProperty('storage');

    expect(instance).toHaveProperty('page');

    expect(instance).toHaveProperty('setAnonymousId');
  });

  it('getReferrerPath should return pathname if url is correct', () => {
    const pathname = getReferrerPath(mockReferrer);

    expect(pathname).toBe('/settings/members/teams/Organization');
  });

  it('getReferrerPath should return empty string if url is incorrect', () => {
    const pathname = getReferrerPath('incorrectURL');

    expect(pathname).toBe('');
  });
});
