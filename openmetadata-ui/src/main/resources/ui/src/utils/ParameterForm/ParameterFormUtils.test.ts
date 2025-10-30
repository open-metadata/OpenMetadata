/*
 *  Copyright 2024 Collate.
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
import { TestCaseParameterDefinition } from '../../generated/tests/testDefinition';
import {
  getColumnSet,
  getSelectedColumnsSet,
  validateEquals,
  validateGreaterThanOrEquals,
  validateLessThanOrEquals,
  validateNotEquals,
} from './ParameterFormUtils';

describe('ParameterFormUtils', () => {
  describe('validateNotEquals', () => {
    it('should return a resolved promise if fieldValue is not equal to value', async () => {
      const fieldValue = 5;
      const value = 10;

      await expect(
        validateNotEquals(fieldValue, value)
      ).resolves.toBeUndefined();
    });

    it('should return a rejected promise, if fieldValue is equal to value', async () => {
      const fieldValue = 10;
      const value = 10;

      await expect(validateNotEquals(fieldValue, value)).rejects.toThrow(
        'message.value-should-not-equal-to-value'
      );
    });
  });

  describe('validateGreaterThanOrEquals', () => {
    it('should return a resolved promise if value is greater than fieldValue', async () => {
      const fieldValue = 10;
      const value = 15;

      await expect(
        validateGreaterThanOrEquals(fieldValue, value)
      ).resolves.toBeUndefined();
    });

    it('should return a resolved promise if value is equal to fieldValue', async () => {
      const fieldValue = 15;
      const value = 15;

      await expect(
        validateGreaterThanOrEquals(fieldValue, value)
      ).resolves.toBeUndefined();
    });

    it('should return a rejected promise, if value is not greater than fieldValue', async () => {
      const fieldValue = 15;
      const value = 10;

      await expect(
        validateGreaterThanOrEquals(fieldValue, value)
      ).rejects.toThrow('message.maximum-value-error');
    });
  });

  describe('validateLessThanOrEquals', () => {
    it('should return a resolved promise if value is less than fieldValue', async () => {
      const fieldValue = 5;
      const value = 3;

      await expect(
        validateLessThanOrEquals(fieldValue, value)
      ).resolves.toBeUndefined();
    });

    it('should return a resolved promise if value is equal to fieldValue', async () => {
      const fieldValue = 5;
      const value = 5;

      await expect(
        validateLessThanOrEquals(fieldValue, value)
      ).resolves.toBeUndefined();
    });

    it('should return a rejected promise, if value is not less than fieldValue', async () => {
      const fieldValue = 10;
      const value = 15;

      await expect(validateLessThanOrEquals(fieldValue, value)).rejects.toThrow(
        'message.minimum-value-error'
      );
    });
  });

  describe('validateEquals', () => {
    it('should return a resolved promise if fieldValue is equal to value', async () => {
      const fieldValue = 10;
      const value = 10;

      await expect(validateEquals(fieldValue, value)).resolves.toBeUndefined();
    });

    it('should return a rejected promise, if fieldValue is not equal to value', async () => {
      const fieldValue = 10;
      const value = 5;

      await expect(validateEquals(fieldValue, value)).rejects.toThrow(
        'message.value-should-equal-to-value'
      );
    });
  });

  describe('getColumnSet', () => {
    it('should return empty Set when field value is undefined', () => {
      const mockGetFieldValue = jest.fn().mockReturnValue(undefined);
      const result = getColumnSet(mockGetFieldValue, 'keyColumns');

      expect(result).toEqual(new Set());
      expect(mockGetFieldValue).toHaveBeenCalledWith(['params', 'keyColumns']);
    });

    it('should return empty Set when field value is null', () => {
      const mockGetFieldValue = jest.fn().mockReturnValue(null);
      const result = getColumnSet(mockGetFieldValue, 'keyColumns');

      expect(result).toEqual(new Set());
    });

    it('should return empty Set when field value is not an array', () => {
      const mockGetFieldValue = jest.fn().mockReturnValue('not-an-array');
      const result = getColumnSet(mockGetFieldValue, 'keyColumns');

      expect(result).toEqual(new Set());
    });

    it('should return empty Set when field value is an empty array', () => {
      const mockGetFieldValue = jest.fn().mockReturnValue([]);
      const result = getColumnSet(mockGetFieldValue, 'keyColumns');

      expect(result).toEqual(new Set());
    });

    it('should return Set with column values from array of objects', () => {
      const mockGetFieldValue = jest
        .fn()
        .mockReturnValue([
          { value: 'col1' },
          { value: 'col2' },
          { value: 'col3' },
        ]);
      const result = getColumnSet(mockGetFieldValue, 'keyColumns');

      expect(result).toEqual(new Set(['col1', 'col2', 'col3']));
      expect(result.size).toBe(3);
    });

    it('should handle objects with undefined value property', () => {
      const mockGetFieldValue = jest
        .fn()
        .mockReturnValue([
          { value: 'col1' },
          { value: undefined },
          { value: 'col2' },
        ]);
      const result = getColumnSet(mockGetFieldValue, 'keyColumns');

      expect(result).toEqual(new Set(['col1', undefined, 'col2']));
    });

    it('should remove duplicates from column values', () => {
      const mockGetFieldValue = jest
        .fn()
        .mockReturnValue([
          { value: 'col1' },
          { value: 'col2' },
          { value: 'col1' },
        ]);
      const result = getColumnSet(mockGetFieldValue, 'keyColumns');

      expect(result).toEqual(new Set(['col1', 'col2']));
      expect(result.size).toBe(2);
    });
  });

  describe('getSelectedColumnsSet', () => {
    const mockGetFieldValue = jest.fn();

    beforeEach(() => {
      mockGetFieldValue.mockClear();
    });

    it('should return only table2.keyColumns for table2.keyColumns field', () => {
      mockGetFieldValue.mockImplementation((path) => {
        if (path[1] === 'table2.keyColumns') {
          return [{ value: 't2col1' }, { value: 't2col2' }];
        }

        return [];
      });

      const data = { name: 'table2.keyColumns' } as TestCaseParameterDefinition;
      const result = getSelectedColumnsSet(data, mockGetFieldValue);

      expect(result).toEqual(new Set(['t2col1', 't2col2']));
      expect(result.size).toBe(2);
    });

    it('should return merged keyColumns and useColumns for keyColumns field', () => {
      mockGetFieldValue.mockImplementation((path) => {
        if (path[1] === 'keyColumns') {
          return [{ value: 'col1' }, { value: 'col2' }];
        }
        if (path[1] === 'useColumns') {
          return [{ value: 'col3' }, { value: 'col4' }];
        }

        return [];
      });

      const data = { name: 'keyColumns' } as TestCaseParameterDefinition;
      const result = getSelectedColumnsSet(data, mockGetFieldValue);

      expect(result).toEqual(new Set(['col1', 'col2', 'col3', 'col4']));
      expect(result.size).toBe(4);
    });

    it('should return merged keyColumns and useColumns for useColumns field', () => {
      mockGetFieldValue.mockImplementation((path) => {
        if (path[1] === 'keyColumns') {
          return [{ value: 'col1' }];
        }
        if (path[1] === 'useColumns') {
          return [{ value: 'col2' }];
        }

        return [];
      });

      const data = { name: 'useColumns' } as TestCaseParameterDefinition;
      const result = getSelectedColumnsSet(data, mockGetFieldValue);

      expect(result).toEqual(new Set(['col1', 'col2']));
    });

    it('should handle empty arrays for keyColumns field', () => {
      mockGetFieldValue.mockReturnValue([]);

      const data = { name: 'keyColumns' } as TestCaseParameterDefinition;
      const result = getSelectedColumnsSet(data, mockGetFieldValue);

      expect(result).toEqual(new Set());
    });

    it('should handle undefined values for table2.keyColumns field', () => {
      mockGetFieldValue.mockReturnValue(undefined);

      const data = { name: 'table2.keyColumns' } as TestCaseParameterDefinition;
      const result = getSelectedColumnsSet(data, mockGetFieldValue);

      expect(result).toEqual(new Set());
    });

    it('should remove duplicates when merging keyColumns and useColumns', () => {
      mockGetFieldValue.mockImplementation((path) => {
        if (path[1] === 'keyColumns') {
          return [{ value: 'col1' }, { value: 'col2' }];
        }
        if (path[1] === 'useColumns') {
          return [{ value: 'col2' }, { value: 'col3' }];
        }

        return [];
      });

      const data = { name: 'keyColumns' } as TestCaseParameterDefinition;
      const result = getSelectedColumnsSet(data, mockGetFieldValue);

      expect(result).toEqual(new Set(['col1', 'col2', 'col3']));
      expect(result.size).toBe(3);
    });

    it('should handle table2.keyColumns being independent from other columns', () => {
      mockGetFieldValue.mockImplementation((path) => {
        if (path[1] === 'keyColumns') {
          return [{ value: 'col1' }];
        }
        if (path[1] === 'table2.keyColumns') {
          return [{ value: 't2col1' }];
        }
        if (path[1] === 'useColumns') {
          return [{ value: 'col2' }];
        }

        return [];
      });

      const dataTable2 = {
        name: 'table2.keyColumns',
      } as TestCaseParameterDefinition;
      const resultTable2 = getSelectedColumnsSet(dataTable2, mockGetFieldValue);

      expect(resultTable2).toEqual(new Set(['t2col1']));
      expect(resultTable2).not.toContain('col1');
      expect(resultTable2).not.toContain('col2');
    });
  });
});
