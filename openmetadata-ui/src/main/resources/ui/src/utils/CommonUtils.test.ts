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

import { cleanAndSort, filterSelectOptions } from './CommonUtils';

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

  describe('cleanAndSort', () => {
    it('should return the same value for primitive types', () => {
      expect(cleanAndSort('test')).toBe('test');
      expect(cleanAndSort(123)).toBe(123);
      expect(cleanAndSort(true)).toBe(true);
      expect(cleanAndSort(false)).toBe(false);
      expect(cleanAndSort(null)).toBeNull();
      expect(cleanAndSort(undefined)).toBeUndefined();
    });

    it('should clean arrays by removing null and undefined values', () => {
      const input = [1, null, 2, undefined, 3, '', 0, false];
      const expected = [1, 2, 3, '', 0, false];

      expect(cleanAndSort(input)).toEqual(expected);
    });

    it('should clean objects by removing null and undefined values', () => {
      const input = {
        a: 1,
        b: null,
        c: 2,
        d: undefined,
        e: '',
        f: 0,
        g: false,
      };
      const expected = {
        a: 1,
        c: 2,
        e: '',
        f: 0,
        g: false,
      };

      expect(cleanAndSort(input)).toEqual(expected);
    });

    it('should sort object keys alphabetically', () => {
      const input = {
        z: 3,
        a: 1,
        m: 2,
      };
      const expected = {
        a: 1,
        m: 2,
        z: 3,
      };

      expect(cleanAndSort(input)).toEqual(expected);
    });

    it('should sort arrays by specified sortKey when all elements have that key', () => {
      const input = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 },
      ];
      const expected = [
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 },
        { name: 'Charlie', age: 30 },
      ];

      expect(cleanAndSort(input, { sortKey: 'name' })).toEqual(expected);
    });

    it('should sort arrays by specified sortKey numerically', () => {
      const input = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 },
      ];
      const expected = [
        { name: 'Alice', age: 25 },
        { name: 'Charlie', age: 30 },
        { name: 'Bob', age: 35 },
      ];

      expect(cleanAndSort(input, { sortKey: 'age' })).toEqual(expected);
    });

    it('should not sort arrays when sortKey is not provided', () => {
      const input = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 },
      ];

      expect(cleanAndSort(input)).toEqual(input);
    });

    it('should not sort arrays when not all elements have the sortKey', () => {
      const input = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice' }, // missing age
        { name: 'Bob', age: 35 },
      ];

      expect(cleanAndSort(input, { sortKey: 'age' })).toEqual(input);
    });

    it('should handle mixed arrays with objects and primitives', () => {
      const input = [
        { name: 'Charlie', age: 30 },
        'string',
        123,
        { age: 25, name: 'Alice' },
        null,
        { name: 'Bob', age: 35 },
      ];
      const expected = [
        { name: 'Charlie', age: 30 },
        'string',
        123,
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 },
      ];

      expect(cleanAndSort(input, { sortKey: 'age' })).toEqual(expected);
    });

    it('should handle complex nested structures', () => {
      const input = {
        users: [
          { name: 'Charlie', details: { age: 30, city: 'NYC' } },
          { name: 'Alice', details: { age: 25, city: 'LA' } },
          { name: 'Bob', details: { age: 35, city: 'CHI' } },
        ],
        settings: {
          theme: 'dark',
          language: 'en',
          notifications: null,
        },
        metadata: {
          version: '1.0.0',
          author: undefined,
          tags: ['tag1', null, 'tag2'],
        },
      };
      const expected = {
        metadata: {
          tags: ['tag1', 'tag2'],
          version: '1.0.0',
        },
        settings: {
          language: 'en',
          theme: 'dark',
        },
        users: [
          { name: 'Alice', details: { age: 25, city: 'LA' } },
          { name: 'Bob', details: { age: 35, city: 'CHI' } },
          { name: 'Charlie', details: { age: 30, city: 'NYC' } },
        ],
      };

      expect(cleanAndSort(input, { sortKey: 'name' })).toEqual(expected);
    });

    it('should handle empty arrays and objects', () => {
      expect(cleanAndSort([])).toEqual([]);
      expect(cleanAndSort({})).toEqual({});
    });

    it('should handle arrays with only null and undefined values', () => {
      const input = [null, undefined, null];
      const expected: unknown[] = [];

      expect(cleanAndSort(input)).toEqual(expected);
    });

    it('should handle objects with only null and undefined values', () => {
      const input = { a: null, b: undefined, c: null };
      const expected = {};

      expect(cleanAndSort(input)).toEqual(expected);
    });

    it('should handle deeply nested null and undefined values', () => {
      const input = {
        a: [1, [null, 2, [undefined, 3]]],
        b: { c: null, d: { e: undefined, f: 4 } },
        g: null,
      };
      const expected = {
        a: [1, [2, [3]]],
        b: { d: { f: 4 } },
      };

      expect(cleanAndSort(input)).toEqual(expected);
    });

    it('should preserve boolean values including false', () => {
      const input = {
        a: true,
        b: false,
        c: null,
        d: undefined,
      };
      const expected = {
        a: true,
        b: false,
      };

      expect(cleanAndSort(input)).toEqual(expected);
    });

    it('should preserve zero values', () => {
      const input = {
        a: 0,
        b: null,
        c: undefined,
        d: 1,
      };
      const expected = {
        a: 0,
        d: 1,
      };

      expect(cleanAndSort(input)).toEqual(expected);
    });

    it('should preserve empty strings', () => {
      const input = {
        a: '',
        b: null,
        c: undefined,
        d: 'test',
      };
      const expected = {
        a: '',
        d: 'test',
      };

      expect(cleanAndSort(input)).toEqual(expected);
    });

    it('should handle arrays with nested objects and sorting', () => {
      const input = [
        { id: 3, data: { name: 'Charlie' } },
        { id: 1, data: { name: 'Alice' } },
        { id: 2, data: { name: 'Bob' } },
      ];
      const expected = [
        { id: 1, data: { name: 'Alice' } },
        { id: 2, data: { name: 'Bob' } },
        { id: 3, data: { name: 'Charlie' } },
      ];

      expect(cleanAndSort(input, { sortKey: 'id' })).toEqual(expected);
    });

    it('should handle case-sensitive string sorting', () => {
      const input = [{ name: 'charlie' }, { name: 'Alice' }, { name: 'Bob' }];
      const expected = [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'charlie' },
      ];

      expect(cleanAndSort(input, { sortKey: 'name' })).toEqual(expected);
    });

    it('should handle mixed data types in arrays', () => {
      const input = [
        'string',
        123,
        { name: 'Alice' },
        true,
        false,
        0,
        '',
        null,
        undefined,
      ];
      const expected = ['string', 123, { name: 'Alice' }, true, false, 0, ''];

      expect(cleanAndSort(input)).toEqual(expected);
    });

    it('should handle functions and symbols (preserve them)', () => {
      const testFunction = () => 'test';
      const testSymbol = Symbol('test');

      const input = {
        a: testFunction,
        b: testSymbol,
        c: null,
        d: 'string',
      };
      const expected = {
        a: testFunction,
        b: testSymbol,
        d: 'string',
      };

      expect(cleanAndSort(input)).toEqual(expected);
    });
  });
});
