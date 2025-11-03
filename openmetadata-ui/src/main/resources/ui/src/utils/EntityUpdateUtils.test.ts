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
import { AxiosError } from 'axios';
import { TFunction } from 'i18next';
import { EntityType } from '../enums/entity.enum';
import { updateEntityField } from './EntityUpdateUtils';
import entityUtilClassBase from './EntityUtilClassBase';
import * as EntityValidationUtils from './EntityValidationUtils';
import * as ToastUtils from './ToastUtils';

const mockedEntityValidationUtils = EntityValidationUtils as jest.Mocked<
  typeof EntityValidationUtils
>;

jest.mock('./EntityUtilClassBase');
jest.mock('./EntityValidationUtils');
jest.mock('./ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

describe('EntityUpdateUtils', () => {
  const mockT = ((key: string) => key) as TFunction;
  const mockPatchAPI = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (entityUtilClassBase.getEntityPatchAPI as jest.Mock).mockReturnValue(
      mockPatchAPI
    );
  });

  describe('updateEntityField', () => {
    const validEntityId = '123e4567-e89b-12d3-a456-426614174000';
    const entityType = EntityType.TABLE;
    const fieldName = 'tags';
    const currentValue = [{ name: 'tag1' }];
    const newValue = [{ name: 'tag1' }, { name: 'tag2' }];
    const entityLabel = 'Tags';

    it('should return failure when entity ID validation fails', async () => {
      mockedEntityValidationUtils.validateEntityId.mockReturnValue(false);

      const result = await updateEntityField({
        entityId: 'invalid-id',
        entityType,
        fieldName,
        currentValue,
        newValue,
        entityLabel,
        t: mockT,
      });

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(mockPatchAPI).not.toHaveBeenCalled();
    });

    it('should return failure when entity type is undefined', async () => {
      mockedEntityValidationUtils.validateEntityId.mockReturnValue(true);

      const result = await updateEntityField({
        entityId: validEntityId,
        entityType: undefined,
        fieldName,
        currentValue,
        newValue,
        entityLabel,
        t: mockT,
      });

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(ToastUtils.showErrorToast).toHaveBeenCalledWith(
        'message.entity-type-required'
      );
      expect(mockPatchAPI).not.toHaveBeenCalled();
    });

    it('should return success with current value when no changes detected', async () => {
      mockedEntityValidationUtils.validateEntityId.mockReturnValue(true);

      const sameValue = [{ name: 'tag1' }];

      const result = await updateEntityField({
        entityId: validEntityId,
        entityType,
        fieldName,
        currentValue: sameValue,
        newValue: sameValue,
        entityLabel,
        t: mockT,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(sameValue);
      expect(mockPatchAPI).not.toHaveBeenCalled();
      expect(ToastUtils.showSuccessToast).not.toHaveBeenCalled();
    });

    it('should successfully update entity field and call onSuccess callback', async () => {
      mockedEntityValidationUtils.validateEntityId.mockReturnValue(true);
      mockPatchAPI.mockResolvedValue({ data: 'success' });

      const onSuccess = jest.fn();

      const result = await updateEntityField({
        entityId: validEntityId,
        entityType,
        fieldName,
        currentValue,
        newValue,
        entityLabel,
        onSuccess,
        t: mockT,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(newValue);
      expect(entityUtilClassBase.getEntityPatchAPI).toHaveBeenCalledWith(
        entityType
      );
      expect(mockPatchAPI).toHaveBeenCalledWith(
        validEntityId,
        expect.arrayContaining([
          expect.objectContaining({
            op: expect.any(String),
            path: expect.stringContaining(fieldName),
          }),
        ])
      );
      expect(ToastUtils.showSuccessToast).toHaveBeenCalledWith(
        'server.update-entity-success'
      );
      expect(onSuccess).toHaveBeenCalledWith(newValue);
    });

    it('should handle API errors and show error toast', async () => {
      mockedEntityValidationUtils.validateEntityId.mockReturnValue(true);

      const mockError = new Error('API Error') as AxiosError;
      mockPatchAPI.mockRejectedValue(mockError);

      const result = await updateEntityField({
        entityId: validEntityId,
        entityType,
        fieldName,
        currentValue,
        newValue,
        entityLabel,
        t: mockT,
      });

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(ToastUtils.showErrorToast).toHaveBeenCalledWith(
        mockError,
        'server.entity-updating-error'
      );
    });

    it('should not call onSuccess callback when update fails', async () => {
      mockedEntityValidationUtils.validateEntityId.mockReturnValue(true);
      mockPatchAPI.mockRejectedValue(new Error('API Error'));

      const onSuccess = jest.fn();

      await updateEntityField({
        entityId: validEntityId,
        entityType,
        fieldName,
        currentValue,
        newValue,
        entityLabel,
        onSuccess,
        t: mockT,
      });

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('should work with different field types', async () => {
      mockedEntityValidationUtils.validateEntityId.mockReturnValue(true);
      mockPatchAPI.mockResolvedValue({ data: 'success' });

      const owners = [{ id: '1', name: 'Owner1' }];
      const newOwners = [
        { id: '1', name: 'Owner1' },
        { id: '2', name: 'Owner2' },
      ];

      const result = await updateEntityField({
        entityId: validEntityId,
        entityType,
        fieldName: 'owners',
        currentValue: owners,
        newValue: newOwners,
        entityLabel: 'Owners',
        t: mockT,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(newOwners);
    });

    it('should handle empty arrays correctly', async () => {
      mockedEntityValidationUtils.validateEntityId.mockReturnValue(true);
      mockPatchAPI.mockResolvedValue({ data: 'success' });

      const result = await updateEntityField({
        entityId: validEntityId,
        entityType,
        fieldName,
        currentValue: [{ name: 'tag1' }],
        newValue: [],
        entityLabel,
        t: mockT,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(mockPatchAPI).toHaveBeenCalled();
    });

    it('should generate correct JSON patch for field update', async () => {
      mockedEntityValidationUtils.validateEntityId.mockReturnValue(true);
      mockPatchAPI.mockResolvedValue({ data: 'success' });

      await updateEntityField({
        entityId: validEntityId,
        entityType,
        fieldName: 'description',
        currentValue: 'Old description',
        newValue: 'New description',
        entityLabel: 'Description',
        t: mockT,
      });

      expect(mockPatchAPI).toHaveBeenCalledWith(
        validEntityId,
        expect.arrayContaining([
          expect.objectContaining({
            path: '/description',
            value: 'New description',
          }),
        ])
      );
    });
  });
});
