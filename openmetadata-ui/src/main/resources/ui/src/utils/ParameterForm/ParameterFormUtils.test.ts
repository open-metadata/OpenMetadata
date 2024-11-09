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
});
