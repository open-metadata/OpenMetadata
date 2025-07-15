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

import { filterSelectOptions, getTableFQNFromColumnFQN } from './CommonUtils';

describe('Tests for CommonUtils', () => {
  describe('filterSelectOptions', () => {
    it('should return true if input matches option labelValue', () => {
      const input = 'test';
      const option = {
        labelValue: 'Test Label',
        value: 'testValue',
        label: 'Test Label',
      };

      expect(filterSelectOptions(input, option)).toBe(true);
    });

    it('should return true if input matches option value', () => {
      const input = 'test';
      const option = {
        labelValue: 'Label',
        label: 'Label',
        value: 'testValue',
      };

      expect(filterSelectOptions(input, option)).toBe(true);
    });

    it('should return false if input does not match option labelValue or value', () => {
      const input = 'test';
      const option = { labelValue: 'Label', value: 'value', label: 'Label' };

      expect(filterSelectOptions(input, option)).toBe(false);
    });

    it('should return false if option is undefined', () => {
      const input = 'test';

      expect(filterSelectOptions(input)).toBe(false);
    });

    it('should handle non-string option value gracefully', () => {
      const input = 'test';
      const option = { labelValue: 'Label', value: 123, label: 'Label' };

      expect(filterSelectOptions(input, option)).toBe(false);
    });

    it('should handle empty input gracefully', () => {
      const input = '';
      const option = { labelValue: 'Label', value: 'value', label: 'Label' };

      expect(filterSelectOptions(input, option)).toBe(true);
    });
  });

  describe('getTableFQNFromColumnFQN', () => {
    it('should return the table FQN from a column FQN', () => {
      const columnFQN = 'service.database.schema.table.column';
      const tableFQN = getTableFQNFromColumnFQN(columnFQN);

      expect(tableFQN).toBe('service.database.schema.table');
    });

    it('should return the table FQN as it is if table FQN is provided', () => {
      const tableFQN = 'service.database.schema.table';
      const result = getTableFQNFromColumnFQN(tableFQN);

      expect(result).toBe(tableFQN);
    });
  });
});
