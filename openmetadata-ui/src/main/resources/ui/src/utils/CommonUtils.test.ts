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
  filterSelectOptions,
  getTableFQNFromColumnFQN,
  isLinearGradient,
} from './CommonUtils';

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

  describe('isLinearGradient', () => {
    it('should correctly identify linear gradient colors', () => {
      // Linear gradient cases
      expect(
        isLinearGradient('linear-gradient(to right, #ff0000, #00ff00)')
      ).toBe(true);
      expect(isLinearGradient('linear-gradient(45deg, #ff0000, #00ff00)')).toBe(
        true
      );
      expect(
        isLinearGradient(
          'linear-gradient(to bottom, rgba(255,0,0,0.5), rgba(0,255,0,0.5))'
        )
      ).toBe(true);
      expect(
        isLinearGradient(
          'linear-gradient(90deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)'
        )
      ).toBe(true);
      expect(
        isLinearGradient('LINEAR-GRADIENT(to right, #ff0000, #00ff00)')
      ).toBe(true);

      // Non-linear gradient cases
      expect(isLinearGradient('#ff0000')).toBe(false);
      expect(isLinearGradient('rgb(255, 0, 0)')).toBe(false);
      expect(isLinearGradient('rgba(255, 0, 0, 0.5)')).toBe(false);
      expect(isLinearGradient('red')).toBe(false);
      expect(isLinearGradient('transparent')).toBe(false);
      expect(isLinearGradient('hsl(0, 100%, 50%)')).toBe(false);
      expect(isLinearGradient('hsla(0, 100%, 50%, 0.5)')).toBe(false);
      expect(isLinearGradient('inherit')).toBe(false);
      expect(isLinearGradient('')).toBe(false);
    });
  });
});
