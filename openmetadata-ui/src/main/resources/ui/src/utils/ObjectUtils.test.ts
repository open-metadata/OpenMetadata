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
import { isHasKey } from './ObjectUtils';

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
});
