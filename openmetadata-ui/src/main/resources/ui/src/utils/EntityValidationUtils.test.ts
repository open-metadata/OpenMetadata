/*
 *  Copyright 2025 Collate.
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
import { TFunction } from 'i18next';
import { validateEntityId } from './EntityValidationUtils';
import * as ToastUtils from './ToastUtils';

jest.mock('./ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('EntityValidationUtils', () => {
  const mockT = ((key: string) => key) as TFunction;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateEntityId', () => {
    it('should return false and show error when entityId is undefined', () => {
      const result = validateEntityId(undefined, mockT);

      expect(result).toBe(false);
      expect(ToastUtils.showErrorToast).toHaveBeenCalledWith(
        'message.entity-id-required'
      );
    });

    it('should return false and show error when entityId is empty string', () => {
      const result = validateEntityId('', mockT);

      expect(result).toBe(false);
      expect(ToastUtils.showErrorToast).toHaveBeenCalledWith(
        'message.entity-id-required'
      );
    });

    it('should return true for valid UUID', () => {
      const validId = '123e4567-e89b-12d3-a456-426614174000';
      const result = validateEntityId(validId, mockT);

      expect(result).toBe(true);
      expect(ToastUtils.showErrorToast).not.toHaveBeenCalled();
    });

    it('should work with uppercase UUIDs', () => {
      const validId = '123E4567-E89B-12D3-A456-426614174000';
      const result = validateEntityId(validId, mockT);

      expect(result).toBe(true);
      expect(ToastUtils.showErrorToast).not.toHaveBeenCalled();
    });
  });
});
