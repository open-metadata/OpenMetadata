/*
 *  Copyright 2025 Collate.
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
import { DateTime } from 'luxon';
import { getSimplifiedVersion, getVersionReleaseTimestamp } from './Version';

describe('getSimplifiedVersion', () => {
  it('should drop the build segment', () => {
    expect(getSimplifiedVersion('1.13.202609250000')).toBe('1.13');
    expect(getSimplifiedVersion('2.0.202610050000')).toBe('2.0');
  });

  it('should pass through a version without a build segment', () => {
    expect(getSimplifiedVersion('1.13')).toBe('1.13');
  });

  it('should return empty string for an undefined version', () => {
    expect(getSimplifiedVersion(undefined)).toBe('');
  });
});

describe('getVersionReleaseTimestamp', () => {
  it('should parse the build timestamp to the matching date', () => {
    const ts = getVersionReleaseTimestamp('1.13.202609250000');

    expect(ts).toBeDefined();
    expect(DateTime.fromMillis(ts as number).toFormat('dd MMM yyyy')).toBe(
      '25 Sep 2026'
    );
  });

  it('should return undefined when there is no 12-digit build stamp', () => {
    expect(getVersionReleaseTimestamp('1.13.1')).toBeUndefined();
    expect(getVersionReleaseTimestamp('1.13')).toBeUndefined();
    expect(getVersionReleaseTimestamp(undefined)).toBeUndefined();
  });
});
