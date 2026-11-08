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
  isSelectAllPayload,
  isValidTestCaseSelection,
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

describe('isValidTestCaseSelection', () => {
  it('returns false for nullish values', () => {
    expect(isValidTestCaseSelection(undefined)).toBe(false);
    expect(isValidTestCaseSelection(null)).toBe(false);
  });

  it('returns true for a non-empty array of names', () => {
    expect(isValidTestCaseSelection(['tc_a', 'tc_b'])).toBe(true);
  });

  it('returns false for an empty array', () => {
    expect(isValidTestCaseSelection([])).toBe(false);
  });

  it('returns true for a non-empty array of test case objects', () => {
    expect(isValidTestCaseSelection([{ name: 'tc_a' }])).toBe(true);
  });

  it('returns true for a select-all payload even with empty testCases', () => {
    expect(
      isValidTestCaseSelection({
        selectAll: true,
        includeIds: [],
        excludeIds: [],
        testCases: [],
      })
    ).toBe(true);
  });

  it('returns true for a select-all payload with the empty filter the picker sends', () => {
    expect(
      isValidTestCaseSelection({
        selectAll: true,
        includeIds: [],
        excludeIds: [],
        testCases: [],
        filter: {},
      })
    ).toBe(true);
  });

  it('returns false for a select-all payload with exclusions', () => {
    expect(
      isValidTestCaseSelection({
        selectAll: true,
        includeIds: [],
        excludeIds: ['tc-excluded'],
        testCases: [],
      })
    ).toBe(false);
  });

  it('returns false for a select-all payload with an active filter', () => {
    expect(
      isValidTestCaseSelection({
        selectAll: true,
        includeIds: [],
        excludeIds: [],
        testCases: [],
        filter: { any: 'fullyQualifiedName:svc.db.sch.t' },
      })
    ).toBe(false);
  });

  it('returns true for a partial payload with includeIds', () => {
    expect(
      isValidTestCaseSelection({
        selectAll: false,
        includeIds: ['id-1'],
        excludeIds: [],
        testCases: [{ id: 'id-1', name: 'tc_one' }],
      })
    ).toBe(true);
  });

  it('returns false for a partial payload with no includeIds and empty testCases', () => {
    expect(
      isValidTestCaseSelection({
        selectAll: false,
        includeIds: [],
        excludeIds: [],
        testCases: [],
      })
    ).toBe(false);
  });

  it('returns false for non-payload objects', () => {
    expect(isValidTestCaseSelection({ foo: 'bar' })).toBe(false);
    expect(isValidTestCaseSelection(42)).toBe(false);
    expect(isValidTestCaseSelection('tc_a')).toBe(false);
  });
});

describe('isSelectAllPayload', () => {
  it('returns true for a select-all payload', () => {
    expect(
      isSelectAllPayload({
        selectAll: true,
        includeIds: [],
        excludeIds: [],
        testCases: [],
      })
    ).toBe(true);
  });

  it('returns true for a select-all payload with the empty filter the picker sends', () => {
    expect(
      isSelectAllPayload({
        selectAll: true,
        includeIds: [],
        excludeIds: [],
        testCases: [],
        filter: {},
      })
    ).toBe(true);
  });

  it('returns false for a select-all payload with exclusions', () => {
    expect(
      isSelectAllPayload({
        selectAll: true,
        includeIds: [],
        excludeIds: ['tc-excluded'],
        testCases: [],
      })
    ).toBe(false);
  });

  it('returns false for a select-all payload with an active filter', () => {
    expect(
      isSelectAllPayload({
        selectAll: true,
        includeIds: [],
        excludeIds: [],
        testCases: [],
        filter: { any: 'fullyQualifiedName:svc.db.sch.t' },
      })
    ).toBe(false);
  });

  it('returns false for a partial-selection payload', () => {
    expect(
      isSelectAllPayload({
        selectAll: false,
        includeIds: ['id-1'],
        excludeIds: [],
        testCases: [{ id: 'id-1', name: 'tc_one' }],
      })
    ).toBe(false);
  });

  it('returns false for arrays', () => {
    expect(isSelectAllPayload(['tc_a'])).toBe(false);
    expect(isSelectAllPayload([])).toBe(false);
  });

  it('returns false for nullish and non-object values', () => {
    expect(isSelectAllPayload(undefined)).toBe(false);
    expect(isSelectAllPayload(null)).toBe(false);
    expect(isSelectAllPayload(42)).toBe(false);
    expect(isSelectAllPayload('tc_a')).toBe(false);
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
