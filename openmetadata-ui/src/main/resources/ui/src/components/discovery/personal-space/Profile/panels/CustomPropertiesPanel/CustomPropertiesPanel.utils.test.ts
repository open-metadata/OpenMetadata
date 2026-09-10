/*
 *  Copyright 2026 Collate.
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

import type { TFunction } from 'i18next';
import type { Type } from '../../../../../../generated/entity/type';
import type { CustomProperty } from '../../../../../../generated/type/customProperty';
import type { SettingMenuItem } from '../../../../../../utils/GlobalSettingsUtils';
import { CRUMB } from './CustomPropertiesPanel.constants';
import {
  AddCustomPropertyFormValues,
  FormSelectItem,
} from './CustomPropertiesPanel.types';
import {
  buildCustomPropertyConfig,
  getBreadcrumbItems,
  getPageTitle,
  toId,
} from './CustomPropertiesPanel.utils';

jest.mock('../../../../../../utils/EntityNameUtils', () => ({
  getEntityName: (entity: { displayName?: string; name?: string }) =>
    entity?.displayName ?? entity?.name ?? '',
}));

jest.mock('../../../../../../utils/GlobalSettingsUtils', () => ({}));

const t = ((key: string): string => key) as unknown as TFunction;

const mockEntityType = {
  id: 'type-1',
  name: 'table',
  displayName: 'Table',
  fullyQualifiedName: 'table',
} as unknown as Type;

const mockProperty = {
  name: 'myProp',
  displayName: 'My Property',
  propertyType: { id: 'string-type', name: 'string' },
} as unknown as CustomProperty;

describe('CustomPropertiesPanel utils', () => {
  describe('toId', () => {
    it('returns empty string for undefined', () => {
      expect(toId(undefined)).toBe('');
    });

    it('returns the string as-is when passed a string', () => {
      expect(toId('my-id')).toBe('my-id');
    });

    it('returns empty string for empty string', () => {
      expect(toId('')).toBe('');
    });

    it('extracts .id from a FormSelectItem', () => {
      const item: FormSelectItem = { id: 'item-id', label: 'Item Label' };

      expect(toId(item)).toBe('item-id');
    });

    it('extracts .id from a FormSelectItem without label', () => {
      const item: FormSelectItem = { id: 'bare-id' };

      expect(toId(item)).toBe('bare-id');
    });
  });

  describe('buildCustomPropertyConfig', () => {
    const baseData: AddCustomPropertyFormValues = {
      name: 'testProp',
      displayName: '',
      propertyType: null,
      description: 'desc',
    };

    it('returns enum config when hasEnumConfig is true', () => {
      const data = {
        ...baseData,
        enumConfig: [{ id: 'val1' }, { id: 'val2' }] as FormSelectItem[],
        multiSelect: true,
      };
      const result = buildCustomPropertyConfig(data, true, false, false, false);

      expect(result).toEqual({
        config: {
          multiSelect: true,
          values: ['val1', 'val2'],
        },
      });
    });

    it('sets multiSelect=false when not provided', () => {
      const data = {
        ...baseData,
        enumConfig: [{ id: 'val1' }] as FormSelectItem[],
      };
      const result = buildCustomPropertyConfig(data, true, false, false, false);

      expect(result?.config).toMatchObject({ multiSelect: false });
    });

    it('returns format config when hasFormatConfig is true', () => {
      const data = {
        ...baseData,
        formatConfig: { id: 'date-format' } as FormSelectItem,
      };
      const result = buildCustomPropertyConfig(data, false, true, false, false);

      expect(result).toEqual({ config: 'date-format' });
    });

    it('returns undefined for format config when formatConfig is not set', () => {
      const result = buildCustomPropertyConfig(
        baseData,
        false,
        true,
        false,
        false
      );

      expect(result).toBeUndefined();
    });

    it('returns entity reference config when hasEntityReferenceConfig is true', () => {
      const data = {
        ...baseData,
        entityReferenceConfig: [
          { id: 'table' },
          { id: 'pipeline' },
        ] as FormSelectItem[],
      };
      const result = buildCustomPropertyConfig(data, false, false, true, false);

      expect(result).toEqual({ config: ['table', 'pipeline'] });
    });

    it('returns table columns config when hasTableTypeConfig is true', () => {
      const data = {
        ...baseData,
        columns: [{ id: 'col1' }, { id: 'col2' }] as FormSelectItem[],
      };
      const result = buildCustomPropertyConfig(data, false, false, false, true);

      expect(result).toEqual({ config: { columns: ['col1', 'col2'] } });
    });

    it('returns undefined when no config flags are set', () => {
      const result = buildCustomPropertyConfig(
        baseData,
        false,
        false,
        false,
        false
      );

      expect(result).toBeUndefined();
    });

    it('enum config takes priority over format config', () => {
      const data = {
        ...baseData,
        enumConfig: [{ id: 'val1' }] as FormSelectItem[],
        formatConfig: { id: 'date-format' } as FormSelectItem,
      };
      const result = buildCustomPropertyConfig(data, true, true, false, false);

      expect(result?.config).toMatchObject({ values: ['val1'] });
    });
  });

  describe('getBreadcrumbItems', () => {
    it('returns 2 items for landing subview', () => {
      const result = getBreadcrumbItems({ type: 'landing' }, t, undefined);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(CRUMB.WORKSPACE);
      expect(result[1].id).toBe(CRUMB.LANDING);
    });

    it('returns 3 items for detail subview', () => {
      const result = getBreadcrumbItems(
        { type: 'detail', entityType: mockEntityType },
        t,
        undefined
      );

      expect(result).toHaveLength(3);
      expect(result[2].id).toBe(CRUMB.DETAIL);
      expect(result[2].label).toBe('Table');
    });

    it('uses matchingSettingsItem.label for entity label when provided', () => {
      const matchingItem = {
        label: 'Custom Label',
      } as unknown as SettingMenuItem;
      const result = getBreadcrumbItems(
        { type: 'detail', entityType: mockEntityType },
        t,
        matchingItem
      );

      expect(result[2].label).toBe('Custom Label');
    });

    it('falls back to getEntityName when matchingSettingsItem is undefined', () => {
      const result = getBreadcrumbItems(
        { type: 'detail', entityType: mockEntityType },
        t,
        undefined
      );

      expect(result[2].label).toBe('Table');
    });

    it('returns 4 items for add subview', () => {
      const result = getBreadcrumbItems(
        { type: 'add', entityType: mockEntityType },
        t,
        undefined
      );

      expect(result).toHaveLength(4);
      expect(result[2].id).toBe(CRUMB.DETAIL);
      expect(result[3].id).toBe(CRUMB.ACTION);
    });

    it('returns 4 items for edit subview with property name', () => {
      const result = getBreadcrumbItems(
        { type: 'edit', entityType: mockEntityType, property: mockProperty },
        t,
        undefined
      );

      expect(result).toHaveLength(4);
      expect(result[3].id).toBe(CRUMB.ACTION);
      expect(result[3].label).toBe('My Property');
    });
  });

  describe('getPageTitle', () => {
    it('returns custom-property-plural key for landing', () => {
      const result = getPageTitle({ type: 'landing' }, t, undefined);

      expect(result).toBe('label.custom-property-plural');
    });

    it('returns entity displayName for detail', () => {
      const result = getPageTitle(
        { type: 'detail', entityType: mockEntityType },
        t,
        undefined
      );

      expect(result).toBe('Table');
    });

    it('uses matchingSettingsItem.label for detail when provided', () => {
      const matchingItem = {
        label: 'Custom Settings Label',
      } as unknown as SettingMenuItem;
      const result = getPageTitle(
        { type: 'detail', entityType: mockEntityType },
        t,
        matchingItem
      );

      expect(result).toBe('Custom Settings Label');
    });

    it('returns add-entity key for add subview', () => {
      const result = getPageTitle(
        { type: 'add', entityType: mockEntityType },
        t,
        undefined
      );

      expect(result).toBe('label.add-entity');
    });

    it('returns property displayName for edit subview', () => {
      const result = getPageTitle(
        { type: 'edit', entityType: mockEntityType, property: mockProperty },
        t,
        undefined
      );

      expect(result).toBe('My Property');
    });
  });
});
