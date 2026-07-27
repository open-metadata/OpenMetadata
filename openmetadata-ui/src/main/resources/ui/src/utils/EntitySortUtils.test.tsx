/*
 *  Copyright 2023 Collate.
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
import { columnSorter, getColumnSorter } from './EntitySortUtils';

describe('EntitySortUtils unit tests', () => {
  describe('columnSorter method', () => {
    it('columnSorter method should return 1 if the 2nd column should be come before 1st column', () => {
      const result = columnSorter({ name: 'name2' }, { name: 'name1' });

      expect(result).toBe(1);
    });

    it('columnSorter method should return -1 if the 1st column should be come before 2nd column', () => {
      const result = columnSorter({ name: 'name1' }, { name: 'name2' });

      expect(result).toBe(-1);
    });
  });

  describe('getColumnSorter', () => {
    type TestType = { name: string };

    it('should return -1 if the 1st value should be before 2nd value', () => {
      const sorter = getColumnSorter<TestType, 'name'>('name');
      const item1 = { name: 'abc' };
      const item2 = { name: 'xyz' };

      expect(sorter(item1, item2)).toBe(-1);
    });

    it('should return 0 when both values are the same', () => {
      const sorter = getColumnSorter<TestType, 'name'>('name');
      const item1 = { name: 'abc' };
      const item2 = { name: 'abc' };

      expect(sorter(item1, item2)).toBe(0);
    });

    it('should return 1 if the 1st value should be after 2nd value', () => {
      const sorter = getColumnSorter<TestType, 'name'>('name');
      const item1 = { name: 'abc' };
      const item2 = { name: 'xyz' };

      expect(sorter(item2, item1)).toBe(1);
    });

    it('should return 1 if the 1st value should be after 2nd value for alphanumeric values', () => {
      const sorter = getColumnSorter<TestType, 'name'>('name');
      const item1 = { name: 'abc10' };
      const item2 = { name: 'abc20' };

      expect(sorter(item2, item1)).toBe(1);
    });
  });
});
