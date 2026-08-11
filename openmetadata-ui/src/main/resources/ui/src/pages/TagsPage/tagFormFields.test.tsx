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

import { FieldTypes, HelperTextType } from '@openmetadata/ui-core-components';
import { TFunction } from 'i18next';
import {
  COLOR_FIELD,
  getDisabledField,
  getDisplayNameField,
  getDomainField,
  getIconField,
  getMutuallyExclusiveField,
  getNameField,
  getOwnerField,
} from './tagFormFields';

const noopFn = jest.fn();
const mockT = jest.fn((key: string) => key) as unknown as TFunction;

describe('tagFormFields', () => {
  describe('getIconField', () => {
    it('should return icon field with ICON_PICKER type', () => {
      const result = getIconField(mockT);

      expect(result.name).toBe('style.iconURL');
      expect(result.type).toBe(FieldTypes.ICON_PICKER);
      expect(result.required).toBe(false);
    });

    it('should pass backgroundColor from selected color', () => {
      const selectedColor = '#FF5733';
      const result = getIconField(mockT, selectedColor);

      expect(result.props?.backgroundColor).toBe(selectedColor);
    });
  });

  describe('COLOR_FIELD', () => {
    it('should have COLOR_PICKER type and correct name', () => {
      expect(COLOR_FIELD.type).toBe(FieldTypes.COLOR_PICKER);
      expect(COLOR_FIELD.name).toBe('style.color');
      expect(COLOR_FIELD.required).toBe(false);
    });
  });

  describe('getNameField', () => {
    it('should return TEXT type with data-testid', () => {
      const result = getNameField(false, mockT);

      expect(result.type).toBe(FieldTypes.TEXT);
      expect(result.name).toBe('name');
      expect(result.required).toBe(true);
      expect(result.props?.['data-testid']).toBe('name');
    });

    it('should forward disabled prop', () => {
      expect(getNameField(true, mockT).props?.disabled).toBe(true);
      expect(getNameField(false, mockT).props?.disabled).toBe(false);
    });
  });

  describe('getDisplayNameField', () => {
    it('should return TEXT type and be optional', () => {
      const result = getDisplayNameField(false);

      expect(result.type).toBe(FieldTypes.TEXT);
      expect(result.name).toBe('displayName');
      expect(result.required).toBe(false);
    });

    it('should forward disabled prop', () => {
      expect(getDisplayNameField(true).props?.disabled).toBe(true);
    });
  });

  describe('getOwnerField', () => {
    it('should return USER_TEAM_SELECT_INPUT with provided options and callbacks', () => {
      const options = [{ id: '1', label: 'Alice', value: 'ref1' }];
      const result = getOwnerField({
        canAddMultipleUserOwners: true,
        options,
        onFocus: noopFn,
        onSearchChange: noopFn,
      });

      expect(result.type).toBe(FieldTypes.USER_TEAM_SELECT_INPUT);
      expect(result.name).toBe('owners');
      expect(result.props?.multiple).toBe(true);
      expect(result.props?.options).toBe(options);
      expect(result.props?.onFocus).toBe(noopFn);
      expect(result.props?.onSearchChange).toBe(noopFn);
    });
  });

  describe('getDomainField', () => {
    it('should return DOMAIN_SELECT with multiple flag from canAddMultipleDomains', () => {
      const result = getDomainField({
        canAddMultipleDomains: true,
        options: [],
        onFocus: noopFn,
        onSearchChange: noopFn,
      });

      expect(result.type).toBe(FieldTypes.DOMAIN_SELECT);
      expect(result.name).toBe('domains');
      expect(result.props?.multiple).toBe(true);
    });

    it('should set multiple to false when canAddMultipleDomains is false', () => {
      const result = getDomainField({
        canAddMultipleDomains: false,
        options: [],
        onFocus: noopFn,
        onSearchChange: noopFn,
      });

      expect(result.props?.multiple).toBe(false);
    });
  });

  describe('getDisabledField', () => {
    it('should return SWITCH type with disabled prop', () => {
      const result = getDisabledField({ disabled: false });

      expect(result.type).toBe(FieldTypes.SWITCH);
      expect(result.name).toBe('disabled');
      expect(result.required).toBe(false);
      expect(result.props?.['data-testid']).toBe('disabled');
    });

    it('should forward disabled prop', () => {
      expect(getDisabledField({ disabled: true }).props?.disabled).toBe(true);
    });
  });

  describe('getMutuallyExclusiveField', () => {
    it('should return SWITCH type with ALERT helper text type', () => {
      const result = getMutuallyExclusiveField({ disabled: false });

      expect(result.type).toBe(FieldTypes.SWITCH);
      expect(result.name).toBe('mutuallyExclusive');
      expect(result.required).toBe(false);
      expect(result.helperTextType).toBe(HelperTextType.ALERT);
      expect(result.props?.['data-testid']).toBe('mutually-exclusive-button');
    });

    it('should set helperText when provided', () => {
      const result = getMutuallyExclusiveField({
        disabled: false,
        helperText: 'Alert message',
      });

      expect(result.helperText).toBe('Alert message');
    });

    it('should forward disabled prop', () => {
      expect(
        getMutuallyExclusiveField({ disabled: true }).props?.disabled
      ).toBe(true);
    });
  });
});
