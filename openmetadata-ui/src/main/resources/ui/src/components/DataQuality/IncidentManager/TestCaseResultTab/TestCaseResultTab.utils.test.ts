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
import { TestDataType } from '../../../../generated/tests/testDefinition';
import { formatParameterValue } from './TestCaseResultTab.utils';

describe('formatParameterValue', () => {
  it.each([
    ['10000', TestDataType.Int, '10,000'],
    ['3489.5', TestDataType.Number, '3,489.5'],
    ['0', TestDataType.Float, '0'],
  ])('groups the thousands of a number parameter: %s', (value, type, text) => {
    expect(formatParameterValue(value, type)).toBe(text);
  });

  it.each([
    // A string that only looks numeric, such as a regex or a column name.
    ['10000', TestDataType.String],
    ['10000', undefined],
    ['ROWS', TestDataType.Array],
    ['', TestDataType.Int],
    ['not a number', TestDataType.Int],
  ])('keeps %s (%s) as typed', (value, type) => {
    expect(formatParameterValue(value, type)).toBe(value);
  });

  it('shows nothing for a parameter with no value', () => {
    expect(formatParameterValue(undefined, TestDataType.Int)).toBe('');
  });
});
