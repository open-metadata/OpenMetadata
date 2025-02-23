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
import {
  formatJsonString,
  getDecodedFqn,
  getEncodedFqn,
  getJSONFromString,
  jsonToCSV,
  replaceCallback,
} from './StringsUtils';

describe('StringsUtils', () => {
  it('getEncodedFqn should return encoded Fqn', () => {
    const fqn = 'sample_data.db_sample.schema_sample.dim/client.';
    const encodedFqn = 'sample_data.db_sample.schema_sample.dim%2Fclient.';

    expect(getEncodedFqn(fqn)).toEqual(encodedFqn);
  });

  it('getEncodedFqn should return encoded Fqn with space as plus', () => {
    const fqn = 'sample_data.db_sample.schema_sample.dim client.';
    const encodedFqn = 'sample_data.db_sample.schema_sample.dim+client.';

    expect(getEncodedFqn(fqn, true)).toEqual(encodedFqn);
  });

  it('getDecodedFqn should return decoded Fqn', () => {
    const fqn = 'sample_data.db_sample.schema_sample.dim%2Fclient.';
    const decodedFqn = 'sample_data.db_sample.schema_sample.dim/client.';

    expect(getDecodedFqn(fqn)).toEqual(decodedFqn);
  });

  it('getDecodedFqn should return decoded Fqn with plus as space', () => {
    const fqn = 'sample_data.db_sample.schema_sample.dim+client.';
    const decodedFqn = 'sample_data.db_sample.schema_sample.dim client.';

    expect(getDecodedFqn(fqn, true)).toEqual(decodedFqn);
  });

  describe('replaceCallback', () => {
    it('should return a hexadecimal string', () => {
      const result = replaceCallback('x');

      expect(typeof result).toBe('string');
      expect(/^[0-9a-f]$/.test(result)).toBeTruthy();
    });

    it('should return a hexadecimal string between 0 and f when character is x', () => {
      const result = replaceCallback('x');

      expect(parseInt(result, 16)).toBeGreaterThanOrEqual(0);
      expect(parseInt(result, 16)).toBeLessThanOrEqual(15);
    });

    it('should return a hexadecimal string between 8 and b when character is not x', () => {
      const result = replaceCallback('y');

      expect(parseInt(result, 16)).toBeGreaterThanOrEqual(8);
      expect(parseInt(result, 16)).toBeLessThanOrEqual(11);
    });
  });

  describe('formatJsonString', () => {
    it('should format a simple JSON string', () => {
      const jsonString = JSON.stringify({ key1: 'value1', key2: 'value2' });
      const expectedOutput = '[key1]: value1\n[key2]: value2\n';

      expect(formatJsonString(jsonString)).toStrictEqual(expectedOutput);
    });

    it('should format a deeply nested JSON string', () => {
      const jsonString = JSON.stringify({
        key1: 'value1',
        key2: {
          subKey1: 'subValue1',
          subKey2: {
            subSubKey1: 'subSubValue1',
            subSubKey2: 'subSubValue2',
          },
        },
      });
      const expectedOutput =
        '[key1]: value1\n[key2]:\n  [subKey1]: subValue1\n  [subKey2]:\n    [subSubKey1]: subSubValue1\n    [subSubKey2]: subSubValue2\n';

      expect(formatJsonString(jsonString)).toStrictEqual(expectedOutput);
    });

    it('should return the original string if it is not valid JSON', () => {
      const jsonString = 'not valid JSON';

      expect(formatJsonString(jsonString)).toStrictEqual(jsonString);
    });
  });

  it('jsonToCSV should return expected csv', () => {
    const jsonData = [
      { name: 'John', age: 30, city: 'New York' },
      { name: 'Jane', age: 25, city: 'San Francisco' },
      { name: 'Bob', age: 35, city: 'Chicago' },
    ];

    const headers = [
      { field: 'name', title: 'Name' },
      { field: 'age', title: 'Age' },
      { field: 'city', title: 'City' },
    ];

    const expectedCSV = `Name,Age,City\n"John","30","New York"\n"Jane","25","San Francisco"\n"Bob","35","Chicago"`;

    expect(jsonToCSV(jsonData, headers)).toEqual(expectedCSV);
    expect(jsonToCSV(jsonData, [])).toEqual('');
    expect(jsonToCSV([], headers)).toEqual('');
  });

  describe('getJSONFromString', () => {
    it('should format a string to JSON', () => {
      const expectedOutput = { key1: 'value1', key2: 'value2' };
      const jsonString = JSON.stringify(expectedOutput);

      expect(getJSONFromString(jsonString)).toStrictEqual(expectedOutput);
    });

    it('should format a deeply nested JSON string', () => {
      const expectedOutput = {
        key1: 'value1',
        key2: {
          subKey1: 'subValue1',
          subKey2: {
            subSubKey1: 'subSubValue1',
            subSubKey2: 'subSubValue2',
          },
        },
      };
      const jsonString = JSON.stringify(expectedOutput);

      expect(getJSONFromString(jsonString)).toStrictEqual(expectedOutput);
    });

    it('should return null if it is not valid JSON string', () => {
      const jsonString = 'not valid JSON';

      expect(getJSONFromString(jsonString)).toBeNull();
    });
  });
});
