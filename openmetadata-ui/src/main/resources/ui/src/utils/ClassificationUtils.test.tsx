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

import React from 'react';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import { EntityField } from '../constants/Feeds.constants';
import { ProviderType } from '../generated/entity/bot';
import { Classification } from '../generated/entity/classification/classification';
import { Tag } from '../generated/entity/classification/tag';
import { ChangeDescription } from '../generated/entity/type';
import { getClassificationInfo, getCommonColumns } from './ClassificationUtils';
import { getEntityVersionByField } from './EntityVersionUtils';

jest.mock('./EntityVersionUtils', () => ({
  getEntityVersionByField: jest.fn(),
}));

jest.mock('./i18next/LocalUtil', () => ({
  t: (key: string) => key,
}));

jest.mock('./TableColumn.util', () => ({
  descriptionTableObject: jest.fn(() => [
    { key: 'description', dataIndex: 'description' },
  ]),
}));

jest.mock('./IconUtils', () => ({
  renderIcon: jest.fn(() => null),
}));

jest.mock('./RouterUtils', () => ({
  getClassificationTagPath: jest.fn((fqn: string) => `/tags/${fqn}`),
  getExplorePath: jest.fn(() => '/explore'),
}));

jest.mock('./TagsUtils', () => ({
  getDeleteIcon: jest.fn(() => null),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Toggle: jest.fn(() => null),
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

const mockGetEntityVersionByField =
  getEntityVersionByField as jest.MockedFunction<
    typeof getEntityVersionByField
  >;

describe('ClassificationUtils', () => {
  describe('getClassificationInfo', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return default values when no classification is provided', () => {
      const result = getClassificationInfo();

      expect(result).toEqual({
        currentVersion: '0.1',
        isClassificationDisabled: false,
        isClassificationDeleted: false,
        isTier: false,
        isSystemClassification: false,
        name: undefined,
        displayName: undefined,
        description: undefined,
      });
    });

    it('should return correct values for a regular classification', () => {
      const mockClassification: Classification = {
        id: 'test-id',
        name: 'TestClassification',
        displayName: 'Test Classification',
        description: 'Test classification description',
        version: 1.2,
        disabled: false,
        provider: ProviderType.User,
        fullyQualifiedName: 'test.classification',
        deleted: false,
        href: 'http://test.com',
        updatedAt: 1234567890,
        updatedBy: 'test-user',
      };

      const result = getClassificationInfo(mockClassification);

      expect(result).toEqual({
        currentVersion: 1.2,
        isClassificationDisabled: false,
        isClassificationDeleted: false,
        isTier: false,
        isSystemClassification: false,
        name: 'TestClassification',
        displayName: 'Test Classification',
        description: 'Test classification description',
      });
    });

    it('should identify Tier classification correctly', () => {
      const mockTierClassification: Classification = {
        id: 'tier-id',
        name: 'Tier',
        displayName: 'Tier Classification',
        description: 'Tier classification description',
        version: 1.0,
        disabled: false,
        provider: ProviderType.System,
        fullyQualifiedName: 'tier.classification',
        deleted: false,
        href: 'http://test.com',
        updatedAt: 1234567890,
        updatedBy: 'system',
      };

      const result = getClassificationInfo(mockTierClassification);

      expect(result).toEqual({
        currentVersion: 1,
        isClassificationDisabled: false,
        isClassificationDeleted: false,
        isTier: true,
        isSystemClassification: true,
        name: 'Tier',
        displayName: 'Tier Classification',
        description: 'Tier classification description',
      });
    });

    it('should identify system classification correctly', () => {
      const mockSystemClassification: Classification = {
        id: 'system-id',
        name: 'SystemClassification',
        displayName: 'System Classification',
        description: 'System classification description',
        version: 2,
        disabled: true,
        provider: ProviderType.System,
        fullyQualifiedName: 'system.classification',
        deleted: false,
        href: 'http://test.com',
        updatedAt: 1234567890,
        updatedBy: 'system',
      };

      const result = getClassificationInfo(mockSystemClassification);

      expect(result).toEqual({
        currentVersion: 2,
        isClassificationDisabled: true,
        isClassificationDeleted: false,
        isTier: false,
        isSystemClassification: true,
        name: 'SystemClassification',
        displayName: 'System Classification',
        description: 'System classification description',
      });
    });

    it('should handle disabled classification', () => {
      const mockDisabledClassification: Classification = {
        id: 'disabled-id',
        name: 'DisabledClassification',
        displayName: 'Disabled Classification',
        description: 'Disabled classification description',
        version: 1.5,
        disabled: true,
        provider: ProviderType.User,
        fullyQualifiedName: 'disabled.classification',
        deleted: false,
        href: 'http://test.com',
        updatedAt: 1234567890,
        updatedBy: 'test-user',
      };

      const result = getClassificationInfo(mockDisabledClassification);

      expect(result).toEqual({
        currentVersion: 1.5,
        isClassificationDisabled: true,
        isClassificationDeleted: false,
        isTier: false,
        isSystemClassification: false,
        name: 'DisabledClassification',
        displayName: 'Disabled Classification',
        description: 'Disabled classification description',
      });
    });

    it('should handle missing optional fields gracefully', () => {
      const mockMinimalClassification: Classification = {
        id: 'minimal-id',
        name: 'MinimalClassification',
        description: 'Minimal description',
        fullyQualifiedName: 'minimal.classification',
        deleted: false,
        href: 'http://test.com',
        updatedAt: 1234567890,
        updatedBy: 'test-user',
      };

      const result = getClassificationInfo(mockMinimalClassification);

      expect(result).toEqual({
        currentVersion: '0.1',
        isClassificationDisabled: false,
        isClassificationDeleted: false,
        isTier: false,
        isSystemClassification: false,
        name: 'MinimalClassification',
        displayName: undefined,
        description: 'Minimal description',
      });
    });

    describe('Version view functionality', () => {
      const mockChangeDescription: ChangeDescription = {
        fieldsAdded: [],
        fieldsUpdated: [],
        fieldsDeleted: [],
        previousVersion: 1.0,
      };

      const mockClassificationWithChangeDescription: Classification = {
        id: 'versioned-id',
        name: 'VersionedClassification',
        displayName: 'Versioned Classification',
        description: 'Versioned classification description',
        version: 2,
        disabled: false,
        provider: ProviderType.User,
        fullyQualifiedName: 'versioned.classification',
        deleted: false,
        href: 'http://test.com',
        updatedAt: 1234567890,
        updatedBy: 'test-user',
        changeDescription: mockChangeDescription,
      };

      beforeEach(() => {
        mockGetEntityVersionByField.mockImplementation((_, field, fallback) => {
          switch (field) {
            case EntityField.NAME:
              return 'VersionedName';
            case EntityField.DISPLAYNAME:
              return 'Versioned Display Name';
            case EntityField.DESCRIPTION:
              return 'Versioned description';
            default:
              return fallback || '';
          }
        });
      });

      it('should use EntityVersionUtils when isVersionView is true', () => {
        const result = getClassificationInfo(
          mockClassificationWithChangeDescription,
          true
        );

        expect(result).toEqual({
          currentVersion: 2,
          isClassificationDisabled: false,
          isClassificationDeleted: false,
          isTier: false,
          isSystemClassification: false,
          name: 'VersionedName',
          displayName: 'Versioned Display Name',
          description: 'Versioned description',
        });

        expect(mockGetEntityVersionByField).toHaveBeenCalledTimes(3);
        expect(mockGetEntityVersionByField).toHaveBeenCalledWith(
          mockChangeDescription,
          EntityField.NAME,
          'VersionedClassification'
        );
        expect(mockGetEntityVersionByField).toHaveBeenCalledWith(
          mockChangeDescription,
          EntityField.DISPLAYNAME,
          'Versioned Classification'
        );
        expect(mockGetEntityVersionByField).toHaveBeenCalledWith(
          mockChangeDescription,
          EntityField.DESCRIPTION,
          'Versioned classification description'
        );
      });

      it('should handle classification with no changeDescription in version view', () => {
        const classificationWithoutChangeDescription: Classification = {
          ...mockClassificationWithChangeDescription,
          changeDescription: undefined,
        };

        const result = getClassificationInfo(
          classificationWithoutChangeDescription,
          true
        );

        expect(result).toEqual({
          currentVersion: 2,
          isClassificationDisabled: false,
          isClassificationDeleted: false,
          isTier: false,
          isSystemClassification: false,
          name: 'VersionedName',
          displayName: 'Versioned Display Name',
          description: 'Versioned description',
        });

        // Should pass empty object as changeDescription
        expect(mockGetEntityVersionByField).toHaveBeenCalledWith(
          {},
          EntityField.NAME,
          'VersionedClassification'
        );
      });

      it('should not use EntityVersionUtils when isVersionView is false', () => {
        const result = getClassificationInfo(
          mockClassificationWithChangeDescription,
          false
        );

        expect(result).toEqual({
          currentVersion: 2,
          isClassificationDisabled: false,
          isClassificationDeleted: false,
          isTier: false,
          isSystemClassification: false,
          name: 'VersionedClassification',
          displayName: 'Versioned Classification',
          description: 'Versioned classification description',
        });

        expect(mockGetEntityVersionByField).not.toHaveBeenCalled();
      });
    });

    describe('Edge cases', () => {
      it('should handle undefined values correctly', () => {
        const result = getClassificationInfo(undefined);

        expect(result).toEqual({
          currentVersion: '0.1',
          isClassificationDisabled: false,
          isClassificationDeleted: false,
          isTier: false,
          isSystemClassification: false,
          name: undefined,
          displayName: undefined,
          description: undefined,
        });
      });

      it('should handle null values correctly', () => {
        // TypeScript would normally prevent this, but testing runtime behavior
        const result = getClassificationInfo(null as any);

        expect(result).toEqual({
          currentVersion: '0.1',
          isClassificationDisabled: false,
          isClassificationDeleted: false,
          isTier: false,
          isSystemClassification: false,
          name: undefined,
          displayName: undefined,
          description: undefined,
        });
      });

      it('should default isVersionView to false when not provided', () => {
        const mockClassification: Classification = {
          id: 'test-id',
          name: 'TestClassification',
          description: 'Test description',
          fullyQualifiedName: 'test.classification',
          deleted: false,
          href: 'http://test.com',
          updatedAt: 1234567890,
          updatedBy: 'test-user',
        };

        const result = getClassificationInfo(mockClassification);

        expect(mockGetEntityVersionByField).not.toHaveBeenCalled();
        expect(result.name).toBe('TestClassification');
      });
    });
  });

  describe('getCommonColumns', () => {
    const mockTag: Tag = {
      id: 'tag-1',
      name: 'TestTag',
      description: 'Test tag description',
      fullyQualifiedName: 'TestClassification.TestTag',
      provider: ProviderType.User,
    };

    it('should include usageCount column', () => {
      const columns = getCommonColumns();
      const keys = columns.map((col) => (col as { key?: string }).key);

      expect(keys).toContain('usageCount');
    });

    it('usageCount column should have correct configuration', () => {
      const columns = getCommonColumns();
      const usageCountCol = columns.find(
        (col) => (col as { key?: string }).key === 'usageCount'
      );

      expect(usageCountCol).toMatchObject({
        dataIndex: 'usageCount',
        key: 'usageCount',
        width: 100,
        align: 'center',
      });
    });

    it('usageCount render should display the count when provided', () => {
      const columns = getCommonColumns();
      const usageCountCol = columns.find(
        (col) => (col as { key?: string }).key === 'usageCount'
      ) as {
        render?: (
          val: number,
          record: Tag,
          index: number
        ) => React.ReactElement;
      };

      const element = usageCountCol.render?.(42, mockTag, 0);

      expect(element?.props.children).toBe(42);
    });

    it('usageCount render should display 0 when usageCount is 0', () => {
      const columns = getCommonColumns();
      const usageCountCol = columns.find(
        (col) => (col as { key?: string }).key === 'usageCount'
      ) as {
        render?: (
          val: number,
          record: Tag,
          index: number
        ) => React.ReactElement;
      };

      const element = usageCountCol.render?.(0, mockTag, 0);

      expect(element?.props.children).toBe(0);
    });

    it('usageCount render should display placeholder when usageCount is undefined', () => {
      const columns = getCommonColumns();
      const usageCountCol = columns.find(
        (col) => (col as { key?: string }).key === 'usageCount'
      ) as {
        render?: (
          val: number,
          record: Tag,
          index: number
        ) => React.ReactElement;
      };

      const element = usageCountCol.render?.(
        undefined as unknown as number,
        mockTag,
        0
      );

      expect(element?.props.children).toBe(NO_DATA_PLACEHOLDER);
    });
  });
});
