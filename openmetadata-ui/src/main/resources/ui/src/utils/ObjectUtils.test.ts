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
import { isHasKey, normalizeToArray } from './ObjectUtils';

const mockIsHasKeyData = {
  name: 'John',
  age: 30,
  address: '123 Main St',
};

describe('ObjectUtils', () => {
  it('isHasKey should return true if all keys are present in the object', () => {
    const keys = ['name', 'age', 'address'];

    const result = isHasKey(mockIsHasKeyData, keys, true);

    expect(result).toBe(true);
  });

  it('isHasKey should return false if all keys are not present in the object', () => {
    const keys = ['name', 'age', 'address', 'gender'];

    const result = isHasKey(mockIsHasKeyData, keys, true);

    expect(result).toBe(false);
  });

  it('isHasKey should return true if at least one key is present in the object', () => {
    const keys = ['name', 'gender'];

    const result = isHasKey(mockIsHasKeyData, keys);

    expect(result).toBe(true);
  });

  it('isHasKey should return false if none of the keys are present in the object', () => {
    const keys = ['gender', 'occupation'];

    const result = isHasKey(mockIsHasKeyData, keys);

    expect(result).toBe(false);
  });

  describe('normalizeToArray', () => {
    it('should return the same array when given an array', () => {
      const input = ['a', 'b', 'c'];

      expect(normalizeToArray(input)).toBe(input);
    });

    it('should wrap a single value in an array', () => {
      expect(normalizeToArray('hello')).toEqual(['hello']);
    });

    it('should wrap an empty string in an array', () => {
      expect(normalizeToArray('')).toEqual(['']);
    });

    it('should wrap 0 in an array', () => {
      expect(normalizeToArray(0)).toEqual([0]);
    });

    it('should wrap false in an array', () => {
      expect(normalizeToArray(false)).toEqual([false]);
    });

    it('should wrap a non-empty number in an array', () => {
      expect(normalizeToArray(42)).toEqual([42]);
    });

    it('should return an empty array for null', () => {
      expect(normalizeToArray(null)).toEqual([]);
    });

    it('should return an empty array for undefined', () => {
      expect(normalizeToArray(undefined)).toEqual([]);
    });

    it('should return an empty array when given an empty array', () => {
      expect(normalizeToArray([])).toEqual([]);
    });

    it('should wrap an object in an array', () => {
      const obj = { id: 1 };

      expect(normalizeToArray(obj)).toEqual([obj]);
    });
  });
});
