import {
  mockFQNWithSpecialChar1,
  mockFQNWithSpecialChar2,
  mockTableNameFromFQN,
  mockTableNameWithSpecialChar,
} from './CommonUtils.mock';
/*
 *  Copyright 2022 Collate
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

import { cloneDeep } from 'lodash';
import { getNameFromFQN, sortTagsCaseInsensitive } from './CommonUtils';
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

    it('Function getNameFromFQN should return the correct table name for fqn with special characters', () => {
      expect(getNameFromFQN(mockFQNWithSpecialChar1)).toEqual(
        mockTableNameWithSpecialChar
      );
    });

    it('Function getNameFromFQN should return the correct table name for fqn with special characters and containing double quotes in schema part in fqn as well', () => {
      expect(getNameFromFQN(mockFQNWithSpecialChar2)).toEqual(
        mockTableNameWithSpecialChar
      );
    });

    it('Table name returned from the function getNameFromFQN should not contain double quotes in it', () => {
      const result = getNameFromFQN(mockFQNWithSpecialChar2);
      const containsDoubleQuotes = result.search('"');

      expect(containsDoubleQuotes > 0).toEqual(false);
    });
  });
});
