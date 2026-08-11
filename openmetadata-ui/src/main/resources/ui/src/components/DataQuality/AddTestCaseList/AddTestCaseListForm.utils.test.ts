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
import { EntityReference } from '../../../generated/tests/testCase';
import {
  normalizeSelectedTestProp,
  seedSelectedFromExistingTest,
} from './AddTestCaseListForm.utils';

describe('normalizeSelectedTestProp', () => {
  it('returns [] for nullish', () => {
    expect(normalizeSelectedTestProp(undefined)).toEqual([]);
    expect(normalizeSelectedTestProp(null)).toEqual([]);
  });

  it('returns string[] as-is when already names', () => {
    expect(normalizeSelectedTestProp(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('extracts names from AddTestCaseListChangePayload-shaped value', () => {
    expect(
      normalizeSelectedTestProp({
        selectAll: false,
        includeIds: ['id-1'],
        excludeIds: [],
        testCases: [{ id: 'id-1', name: 'tc_one' }],
      })
    ).toEqual(['tc_one']);
  });

  it('returns [] for payload-shaped non-array when testCases is empty', () => {
    expect(
      normalizeSelectedTestProp({
        selectAll: false,
        includeIds: [],
        excludeIds: [],
        testCases: [],
      })
    ).toEqual([]);
  });
});

describe('seedSelectedFromExistingTest', () => {
  it('returns an empty Map for undefined / empty input', () => {
    expect(seedSelectedFromExistingTest(undefined).size).toBe(0);
    expect(seedSelectedFromExistingTest([]).size).toBe(0);
  });

  it('keys entries by id and preserves the name from the reference', () => {
    const refs: EntityReference[] = [
      { id: 'id-1', name: 'tc_one', type: 'testCase' },
      { id: 'id-2', name: 'tc_two', type: 'testCase' },
    ];
    const seed = seedSelectedFromExistingTest(refs);

    expect(seed.size).toBe(2);
    expect(seed.get('id-1')?.name).toBe('tc_one');
    expect(seed.get('id-2')?.name).toBe('tc_two');
  });

  it('skips references without an id', () => {
    const refs = [
      { id: 'id-1', name: 'tc_one', type: 'testCase' },
      { name: 'tc_no_id', type: 'testCase' } as EntityReference,
    ];
    const seed = seedSelectedFromExistingTest(refs);

    expect(seed.size).toBe(1);
    expect(seed.has('id-1')).toBe(true);
  });
});
