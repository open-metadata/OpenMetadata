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

import { TestCaseType } from '../enums/TestSuite.enum';
import {
  DataQualityRange,
  DataQualityScope,
  DEFAULT_DATA_QUALITY_FILTERS,
  toSearchParams,
} from './dataQualityFilters';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('toSearchParams', () => {
  it('sends no owner, follower or type filter in the default "everything" state', () => {
    const params = toSearchParams(DEFAULT_DATA_QUALITY_FILTERS, 'alice');

    // `all` is the absence of a filter — sending it would narrow to nothing.
    expect(params.owner).toBeUndefined();
    expect(params.followedBy).toBeUndefined();
    expect(params.testCaseType).toBeUndefined();
  });

  it('scopes to the user by owner or follower, never both', () => {
    const mine = toSearchParams(
      { ...DEFAULT_DATA_QUALITY_FILTERS, scope: DataQualityScope.MINE },
      'alice'
    );

    expect(mine.owner).toBe('alice');
    expect(mine.followedBy).toBeUndefined();

    const followed = toSearchParams(
      { ...DEFAULT_DATA_QUALITY_FILTERS, scope: DataQualityScope.FOLLOWED },
      'alice'
    );

    expect(followed.followedBy).toBe('alice');
    expect(followed.owner).toBeUndefined();
  });

  it('turns the range into a window ending now', () => {
    const params = toSearchParams(
      { ...DEFAULT_DATA_QUALITY_FILTERS, range: DataQualityRange.LAST_30_DAYS },
      'alice'
    );

    expect(params.endTimestamp - params.startTimestamp).toBe(30 * DAY_MS);
  });

  it('passes a concrete test type through', () => {
    const params = toSearchParams(
      { ...DEFAULT_DATA_QUALITY_FILTERS, testCaseType: TestCaseType.table },
      'alice'
    );

    expect(params.testCaseType).toBe(TestCaseType.table);
  });
});
