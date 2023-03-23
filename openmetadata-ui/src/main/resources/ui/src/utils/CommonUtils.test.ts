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

import {
  mockFQNWithSpecialChar1,
  mockFQNWithSpecialChar2,
  mockFQNWithSpecialChar3,
  mockFQNWithSpecialChar4,
  mockFQNWithSpecialChar5,
  mockTableNameFromFQN,
  mockTableNameWithSpecialChar,
  mockTableNameWithSpecialChar3,
  mockTableNameWithSpecialChar4,
  mockTableNameWithSpecialChar5,
} from './CommonUtils.mock';

import { cloneDeep } from 'lodash';
import {
  digitFormatter,
  getNameFromFQN,
  sortTagsCaseInsensitive,
} from './CommonUtils';
import { mockFQN, mockTags, sortedMockTags } from './CommonUtils.mock';

describe('Tests for CommonUtils', () => {
  describe('Tests for sortTagsCaseInsensitive function', () => {
    it('Input of unsorted array to sortTagsCaseInsensitive should return array of tags sorted by tagFQN', () => {
      expect(sortTagsCaseInsensitive(cloneDeep(mockTags))).toEqual(
        sortedMockTags
      );
    });

    it('Input of sorted array to sortTagsCaseInsensitive should return array of tags sorted by tagFQN', () => {
      expect(sortTagsCaseInsensitive(cloneDeep(sortedMockTags))).toEqual(
        sortedMockTags
      );
    });

    it('Array returned by sortTagsCaseInsensitive should not be equal to the unsorted input array of tags', () => {
      expect(sortTagsCaseInsensitive(cloneDeep(mockTags))).not.toEqual(
        mockTags
      );
    });

    it('Function getNameFromFQN should return the correct table name for fqn without special characters', () => {
      expect(getNameFromFQN(mockFQN)).toEqual(mockTableNameFromFQN);
    });

    it('Function getNameFromFQN should return the correct table name for sample_data.ecommerce_db."dim.api/client"', () => {
      expect(getNameFromFQN(mockFQNWithSpecialChar1)).toEqual(
        mockTableNameWithSpecialChar
      );
    });

    it('Function getNameFromFQN should return the correct table name for sample_data."ecommerce_db"."dim.api/client"', () => {
      expect(getNameFromFQN(mockFQNWithSpecialChar2)).toEqual(
        mockTableNameWithSpecialChar
      );
    });

    it('Regular expression in getNameFromFQN should not match for sample_data."ecommerce_db"."dim.api/"client" and should return names by default method', () => {
      expect(getNameFromFQN(mockFQNWithSpecialChar3)).toEqual(
        mockTableNameWithSpecialChar3
      );
    });

    it('Regular expression in getNameFromFQN should not match for sample_data."ecommerce_db"."dim.api/client"" and should return names by default method', () => {
      expect(getNameFromFQN(mockFQNWithSpecialChar4)).toEqual(
        mockTableNameWithSpecialChar4
      );
    });

    it('Regular expression in getNameFromFQN should not match for sample_data."ecommerce_db".""dim.api/client" and should return names by default method', () => {
      expect(getNameFromFQN(mockFQNWithSpecialChar5)).toEqual(
        mockTableNameWithSpecialChar5
      );
    });

    it('Table name returned from the function getNameFromFQN should not contain double quotes in it', () => {
      const result = getNameFromFQN(mockFQNWithSpecialChar2);
      const containsDoubleQuotes = result.search('"');

      expect(containsDoubleQuotes > 0).toBe(false);
    });

    // digitFormatter test
    it('digitFormatter formatter should format number 1000 to 1k', () => {
      const values = [
        { value: 1000, result: '1K' },
        { value: 10000, result: '10K' },
        { value: 10200, result: '10.2K' },
        { value: 1000000, result: '1M' },
        { value: 100000000, result: '100M' },
      ];

      values.map(({ value, result }) => {
        expect(digitFormatter(value)).toEqual(result);
      });
    });
  });
});
