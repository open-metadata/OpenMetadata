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
  FieldProp,
  FieldTypes,
  FormItemLayout,
  HelperTextType,
} from '../../interface/FormUtils.interface';
import { iconTooltipDataRender } from '../../utils/DomainUtils';

export const getIconField = (selectedColor?: string): FieldProp => ({
  name: ['style', 'iconURL'],
  id: 'root/style/iconURL',
  label: 'label.icon',
  muiLabel: 'label.icon',
  required: false,
  type: FieldTypes.ICON_PICKER_MUI,
  helperText: iconTooltipDataRender(),
  placeholder: 'label.icon-url',
  formItemLayout: FormItemLayout.HORIZONTAL,
  formItemProps: {
    valuePropName: 'value',
    trigger: 'onChange',
  },
  props: {
    'data-testid': 'icon-picker-btn',
    allowUrl: true,
    backgroundColor: selectedColor,
    defaultIcon: DEFAULT_TAG_ICON,
    customStyles: {
      searchBoxWidth: 366,
    },
  },
});

export const COLOR_FIELD: FieldProp = {
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
};

export const getNameField = (disabled: boolean): FieldProp => ({
  name: 'name',
  id: 'root/name',
  muiLabel: 'label.name',
  label: 'label.name',
  required: true,
  placeholder: 'label.name',
  type: FieldTypes.TEXT_MUI,
  props: {
    inputProps: {
      'data-testid': 'name',
    },
    disabled,
  },
  formItemProps: {
    validateTrigger: ['onChange', 'onBlur'],
  },
});

export const getDisplayNameField = (disabled: boolean): FieldProp => ({
  name: 'displayName',
  id: 'root/displayName',
  muiLabel: 'label.display-name',
  label: 'label.display-name',
  required: false,
  placeholder: 'label.display-name',
  type: FieldTypes.TEXT_MUI,
  props: {
    inputProps: {
      'data-testid': 'displayName',
    },
    disabled,
  },
});

export const getOwnerField = ({
  canAddMultipleUserOwners,
  canAddMultipleTeamOwner,
}: {
  canAddMultipleUserOwners: boolean;
  canAddMultipleTeamOwner: boolean;
}): FieldProp => ({
  name: 'owners',
  id: 'root/owner',
  required: false,
  label: 'label.owner-plural',
  muiLabel: 'label.owner-plural',
  type: FieldTypes.USER_TEAM_SELECT_MUI,
  props: {
    multipleUser: canAddMultipleUserOwners,
    multipleTeam: canAddMultipleTeamOwner,
  },
  formItemProps: {
    valuePropName: 'value',
    trigger: 'onChange',
  },
});

export const getDomainField = ({
  canAddMultipleDomains,
}: {
  canAddMultipleDomains: boolean;
}): FieldProp => ({
  name: 'domains',
  id: 'root/domains',
  required: false,
  label: 'label.domain-plural',
  muiLabel: 'label.domain-plural',
  type: FieldTypes.DOMAIN_SELECT_MUI,
  props: {
    'data-testid': 'domain-select',
    hasPermission: true,
    multiple: canAddMultipleDomains,
  },
  formItemProps: {
    valuePropName: 'value',
    trigger: 'onChange',
  },
});

export const getDescriptionField = ({
  initialValue,
  readonly,
}: {
  initialValue: string;
  readonly: boolean;
}): FieldProp => ({
  name: 'description',
  required: true,
  label: 'label.description',
  id: 'root/description',
  type: FieldTypes.DESCRIPTION,
  props: {
    'data-testid': 'description',
    initialValue,
    readonly,
    className: 'description-text-area',
  },
  formItemProps: {
    className: 'description-form-item',
  },
});

export const getDisabledField = ({
  initialValue,
  disabled,
}: {
  initialValue: boolean;
  disabled: boolean;
}): FieldProp => ({
  name: 'disabled',
  required: false,
  label: 'label.disable-tag',
  muiLabel: 'label.disable-tag',
  id: 'root/disabled',
  type: FieldTypes.SWITCH_MUI,
  formItemLayout: FormItemLayout.HORIZONTAL,
  props: {
    inputProps: {
      'data-testid': 'disabled',
    },
    initialValue,
    disabled,
  },
});

export const getMutuallyExclusiveField = ({
  disabled,
  showHelperText,
}: {
  disabled: boolean;
  showHelperText: boolean;
}): FieldProp => ({
  name: 'mutuallyExclusive',
  muiLabel: 'label.mutually-exclusive',
  label: 'label.mutually-exclusive',
  type: FieldTypes.SWITCH_MUI,
  required: false,
  props: {
    id: 'tags_mutuallyExclusive',
    'data-testid': 'mutually-exclusive-button',
    disabled,
    className: 'mutually-exclusive-switch',
  },
  helperTextType: HelperTextType.ALERT,
  showHelperText,
  id: 'root/mutuallyExclusive',
});
