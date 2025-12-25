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

import { DEFAULT_TAG_ICON } from '../../components/common/IconPicker';
import {
  FieldTypes,
  FormItemLayout,
  HelperTextType,
} from '../../interface/FormUtils.interface';
import {
  COLOR_FIELD,
  getDescriptionField,
  getDisabledField,
  getDisplayNameField,
  getDomainField,
  getIconField,
  getMutuallyExclusiveField,
  getNameField,
  getOwnerField,
} from './tagFormFields';

jest.mock('../../utils/DomainUtils', () => ({
  iconTooltipDataRender: jest.fn(() => 'mocked-tooltip'),
}));

describe('tagFormFields', () => {
  describe('getIconField', () => {
    it('should return icon field configuration with default values', () => {
      const result = getIconField();

      expect(result).toEqual({
        name: ['style', 'iconURL'],
        id: 'root/style/iconURL',
        label: 'label.icon',
        muiLabel: 'label.icon',
        required: false,
        type: FieldTypes.ICON_PICKER_MUI,
        helperText: 'mocked-tooltip',
        placeholder: 'label.icon-url',
        formItemLayout: FormItemLayout.HORIZONTAL,
        formItemProps: {
          valuePropName: 'value',
          trigger: 'onChange',
        },
        props: {
          'data-testid': 'icon-picker-btn',
          allowUrl: true,
          backgroundColor: undefined,
          defaultIcon: DEFAULT_TAG_ICON,
          customStyles: {
            searchBoxWidth: 366,
          },
        },
      });
    });

    it('should return icon field configuration with selected color', () => {
      const selectedColor = '#FF5733';
      const result = getIconField(selectedColor);

      expect(result.props?.backgroundColor).toBe(selectedColor);
    });

    it('should have correct formItemProps', () => {
      const result = getIconField();

      expect(result.formItemProps).toEqual({
        valuePropName: 'value',
        trigger: 'onChange',
      });
    });

    it('should have correct custom styles', () => {
      const result = getIconField();

      expect(result.props?.customStyles).toEqual({
        searchBoxWidth: 366,
      });
    });
  });

  describe('COLOR_FIELD', () => {
    it('should have correct color field configuration', () => {
      expect(COLOR_FIELD).toEqual({
        name: ['style', 'color'],
        id: 'root/style/color',
        label: 'label.color',
        muiLabel: 'label.color',
        required: false,
        type: FieldTypes.COLOR_PICKER_MUI,
        formItemLayout: FormItemLayout.HORIZONTAL,
        formItemProps: {
          valuePropName: 'value',
          trigger: 'onChange',
        },
      });
    });

    it('should be a constant field', () => {
      expect(COLOR_FIELD.type).toBe(FieldTypes.COLOR_PICKER_MUI);
      expect(COLOR_FIELD.required).toBe(false);
    });
  });

  describe('getNameField', () => {
    it('should return name field configuration when disabled is false', () => {
      const result = getNameField(false);

      expect(result).toEqual({
        name: 'name',
        id: 'root/name',
        label: 'label.name',
        required: true,
        placeholder: 'label.name',
        type: FieldTypes.TEXT_MUI,
        props: {
          inputProps: {
            'data-testid': 'name',
          },
          disabled: false,
        },
        formItemProps: {
          validateTrigger: ['onChange', 'onBlur'],
        },
      });
    });

    it('should return name field configuration when disabled is true', () => {
      const result = getNameField(true);

      expect(result.props?.disabled).toBe(true);
    });

    it('should be a required field', () => {
      const result = getNameField(false);

      expect(result.required).toBe(true);
    });

    it('should have correct validation triggers', () => {
      const result = getNameField(false);

      expect(result.formItemProps?.validateTrigger).toEqual([
        'onChange',
        'onBlur',
      ]);
    });
  });

  describe('getDisplayNameField', () => {
    it('should return display name field configuration when disabled is false', () => {
      const result = getDisplayNameField(false);

      expect(result).toEqual({
        name: 'displayName',
        id: 'root/displayName',
        label: 'label.display-name',
        required: false,
        placeholder: 'label.display-name',
        type: FieldTypes.TEXT_MUI,
        props: {
          inputProps: {
            'data-testid': 'displayName',
          },
          disabled: false,
        },
      });
    });

    it('should return display name field configuration when disabled is true', () => {
      const result = getDisplayNameField(true);

      expect(result.props?.disabled).toBe(true);
    });

    it('should be an optional field', () => {
      const result = getDisplayNameField(false);

      expect(result.required).toBe(false);
    });
  });

  describe('getOwnerField', () => {
    it('should return owner field configuration with multiple users and teams disabled', () => {
      const result = getOwnerField({
        canAddMultipleUserOwners: false,
        canAddMultipleTeamOwner: false,
      });

      expect(result).toEqual({
        name: 'owners',
        id: 'root/owner',
        required: false,
        label: 'label.owner-plural',
        type: FieldTypes.USER_TEAM_SELECT_MUI,
        props: {
          multipleUser: false,
          multipleTeam: false,
        },
        formItemProps: {
          valuePropName: 'value',
          trigger: 'onChange',
        },
      });
    });

    it('should return owner field configuration with multiple users enabled', () => {
      const result = getOwnerField({
        canAddMultipleUserOwners: true,
        canAddMultipleTeamOwner: false,
      });

      expect(result.props?.multipleUser).toBe(true);
      expect(result.props?.multipleTeam).toBe(false);
    });

    it('should return owner field configuration with multiple teams enabled', () => {
      const result = getOwnerField({
        canAddMultipleUserOwners: false,
        canAddMultipleTeamOwner: true,
      });

      expect(result.props?.multipleUser).toBe(false);
      expect(result.props?.multipleTeam).toBe(true);
    });

    it('should return owner field configuration with both multiple options enabled', () => {
      const result = getOwnerField({
        canAddMultipleUserOwners: true,
        canAddMultipleTeamOwner: true,
      });

      expect(result.props?.multipleUser).toBe(true);
      expect(result.props?.multipleTeam).toBe(true);
    });
  });

  describe('getDomainField', () => {
    it('should return domain field configuration with multiple domains disabled', () => {
      const result = getDomainField({
        canAddMultipleDomains: false,
      });

      expect(result).toEqual({
        name: 'domains',
        id: 'root/domains',
        required: false,
        label: 'label.domain-plural',
        type: FieldTypes.DOMAIN_SELECT_MUI,
        props: {
          'data-testid': 'domain-select',
          hasPermission: true,
          multiple: false,
        },
        formItemProps: {
          valuePropName: 'value',
          trigger: 'onChange',
        },
      });
    });

    it('should return domain field configuration with multiple domains enabled', () => {
      const result = getDomainField({
        canAddMultipleDomains: true,
      });

      expect(result.props?.multiple).toBe(true);
    });

    it('should always have hasPermission set to true', () => {
      const result = getDomainField({
        canAddMultipleDomains: false,
      });

      expect(result.props?.hasPermission).toBe(true);
    });
  });

  describe('getDescriptionField', () => {
    it('should return description field configuration with default values', () => {
      const initialValue = 'Test description';
      const result = getDescriptionField({
        initialValue,
        readonly: false,
      });

      expect(result).toEqual({
        name: 'description',
        required: true,
        label: 'label.description',
        id: 'root/description',
        type: FieldTypes.DESCRIPTION,
        props: {
          'data-testid': 'description',
          initialValue,
          readonly: false,
          className: 'description-text-area',
        },
        formItemProps: {
          className: 'description-form-item',
        },
      });
    });

    it('should return description field configuration with readonly true', () => {
      const result = getDescriptionField({
        initialValue: '',
        readonly: true,
      });

      expect(result.props?.readonly).toBe(true);
    });

    it('should be a required field', () => {
      const result = getDescriptionField({
        initialValue: '',
        readonly: false,
      });

      expect(result.required).toBe(true);
    });

    it('should preserve initialValue', () => {
      const initialValue = 'Custom initial value';
      const result = getDescriptionField({
        initialValue,
        readonly: false,
      });

      expect(result.props?.initialValue).toBe(initialValue);
    });
  });

  describe('getDisabledField', () => {
    it('should return disabled field configuration with default values', () => {
      const result = getDisabledField({
        initialValue: false,
        disabled: false,
      });

      expect(result).toEqual({
        name: 'disabled',
        required: false,
        label: 'label.disable-tag',
        id: 'root/disabled',
        type: FieldTypes.SWITCH_MUI,
        formItemLayout: FormItemLayout.HORIZONTAL,
        props: {
          inputProps: {
            'data-testid': 'disabled',
          },
          initialValue: false,
          disabled: false,
        },
      });
    });

    it('should return disabled field with initialValue true', () => {
      const result = getDisabledField({
        initialValue: true,
        disabled: false,
      });

      expect(result.props?.initialValue).toBe(true);
    });

    it('should return disabled field with disabled true', () => {
      const result = getDisabledField({
        initialValue: false,
        disabled: true,
      });

      expect(result.props?.disabled).toBe(true);
    });

    it('should have horizontal form item layout', () => {
      const result = getDisabledField({
        initialValue: false,
        disabled: false,
      });

      expect(result.formItemLayout).toBe(FormItemLayout.HORIZONTAL);
    });
  });

  describe('getMutuallyExclusiveField', () => {
    it('should return mutually exclusive field configuration with helper text hidden', () => {
      const result = getMutuallyExclusiveField({
        disabled: false,
        showHelperText: false,
      });

      expect(result).toEqual({
        name: 'mutuallyExclusive',
        label: 'label.mutually-exclusive',
        type: FieldTypes.SWITCH_MUI,
        required: false,
        props: {
          id: 'tags_mutuallyExclusive',
          'data-testid': 'mutually-exclusive-button',
          disabled: false,
          className: 'mutually-exclusive-switch',
        },
        helperTextType: HelperTextType.ALERT,
        showHelperText: false,
        id: 'root/mutuallyExclusive',
      });
    });

    it('should return mutually exclusive field with helper text shown', () => {
      const result = getMutuallyExclusiveField({
        disabled: false,
        showHelperText: true,
      });

      expect(result.showHelperText).toBe(true);
    });

    it('should return mutually exclusive field with disabled true', () => {
      const result = getMutuallyExclusiveField({
        disabled: true,
        showHelperText: false,
      });

      expect(result.props?.disabled).toBe(true);
    });

    it('should have ALERT helper text type', () => {
      const result = getMutuallyExclusiveField({
        disabled: false,
        showHelperText: false,
      });

      expect(result.helperTextType).toBe(HelperTextType.ALERT);
    });

    it('should be an optional field', () => {
      const result = getMutuallyExclusiveField({
        disabled: false,
        showHelperText: false,
      });

      expect(result.required).toBe(false);
    });
  });
});
