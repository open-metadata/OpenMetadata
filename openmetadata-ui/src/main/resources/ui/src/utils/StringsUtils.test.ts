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
import { formatJsonString, getDecodedFqn, getEncodedFqn } from './StringsUtils';

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
});
