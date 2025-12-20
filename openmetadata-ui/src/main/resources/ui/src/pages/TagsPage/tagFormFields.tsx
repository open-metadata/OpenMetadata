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
import { DEFAULT_TAG_ICON } from '../../components/common/IconPicker';
import {
  NAME_LENGTH_REGEX,
  TAG_NAME_REGEX,
} from '../../constants/regex.constants';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
  HelperTextType,
} from '../../interface/FormUtils.interface';
import { iconTooltipDataRender } from '../../utils/DomainUtils';

export const getIconField = (
  t: TFunction,
  selectedColor?: string
): FieldProp => ({
  name: ['style', 'iconURL'],
  id: 'root/style/iconURL',
  label: <>{t('label.icon')}</>,
  muiLabel: <>{t('label.icon')}</>,
  required: false,
  type: FieldTypes.ICON_PICKER_MUI,
  helperText: iconTooltipDataRender(),
  props: {
    'data-testid': 'icon-picker-btn',
    allowUrl: true,
    placeholder: t('label.icon-url'),
    backgroundColor: selectedColor,
    defaultIcon: DEFAULT_TAG_ICON,
    customStyles: {
      searchBoxWidth: 366,
    },
  },
  formItemLayout: FormItemLayout.HORIZONTAL,
  formItemProps: {
    valuePropName: 'value',
    trigger: 'onChange',
  },
});

export const getColorField = (t: TFunction): FieldProp => ({
  name: ['style', 'color'],
  id: 'root/style/color',
  label: <>{t('label.color')}</>,
  muiLabel: <>{t('label.color')}</>,
  required: false,
  type: FieldTypes.COLOR_PICKER_MUI,
  formItemLayout: FormItemLayout.HORIZONTAL,
  formItemProps: {
    valuePropName: 'value',
    trigger: 'onChange',
  },
});

export const getNameField = (t: TFunction, disabled: boolean): FieldProp => ({
  name: 'name',
  id: 'root/name',
  label: <>{t('label.name')}</>,
  required: true,
  placeholder: t('label.name'),
  type: FieldTypes.TEXT_MUI,
  props: {
    inputProps: {
      'data-testid': 'name',
    },
    disabled,
  },
  rules: [
    {
      required: true,
      message: t('label.field-required', {
        field: t('label.name'),
      }),
    },
    {
      pattern: NAME_LENGTH_REGEX,
      message: t('message.entity-size-in-between', {
        entity: t('label.name'),
        min: 2,
        max: 64,
      }),
    },
    {
      pattern: TAG_NAME_REGEX,
      message: t('message.entity-name-validation'),
    },
  ],
  formItemProps: {
    validateTrigger: ['onChange', 'onBlur'],
  },
});

export const getDisplayNameField = (
  t: TFunction,
  disabled: boolean
): FieldProp => ({
  name: 'displayName',
  id: 'root/displayName',
  label: <>{t('label.display-name')}</>,
  required: false,
  placeholder: t('label.display-name'),
  type: FieldTypes.TEXT_MUI,
  props: {
    inputProps: {
      'data-testid': 'displayName',
    },
    disabled,
  },
});

export const getOwnerField = (
  t: TFunction,
  {
    canAddMultipleUserOwners,
    canAddMultipleTeamOwner,
  }: {
    canAddMultipleUserOwners: boolean;
    canAddMultipleTeamOwner: boolean;
  }
): FieldProp => ({
  name: 'owners',
  id: 'root/owner',
  required: false,
  label: <>{t('label.owner-plural')}</>,
  type: FieldTypes.USER_TEAM_SELECT_MUI,
  props: {
    multipleUser: canAddMultipleUserOwners,
    multipleTeam: canAddMultipleTeamOwner,
    label: t('label.owner-plural'),
  },
  formItemProps: {
    valuePropName: 'value',
    trigger: 'onChange',
  },
});

export const getDomainField = (
  t: TFunction,
  {
    canAddMultipleDomains,
  }: {
    canAddMultipleDomains: boolean;
  }
): FieldProp => ({
  name: 'domains',
  id: 'root/domains',
  required: false,
  label: <>{t('label.domain-plural')}</>,
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

export const getDescriptionField = (
  t: TFunction,
  {
    initialValue,
    readonly,
  }: {
    initialValue: string;
    readonly: boolean;
  }
): FieldProp => ({
  name: 'description',
  required: true,
  label: <>{t('label.description')}</>,
  id: 'root/description',
  type: FieldTypes.DESCRIPTION,
  props: {
    'data-testid': 'description',
    initialValue,
    readonly,
  },
});

export const getDisabledField = (
  t: TFunction,
  {
    initialValue,
    disabled,
  }: {
    initialValue: boolean;
    disabled: boolean;
  }
): FieldProp => ({
  name: 'disabled',
  required: false,
  label: <>{t('label.disable-tag')}</>,
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

export const getMutuallyExclusiveField = (
  t: TFunction,
  {
    disabled,
    showHelperText,
  }: {
    disabled: boolean;
    showHelperText: boolean;
  }
): FieldProp => ({
  name: 'mutuallyExclusive',
  label: <>{t('label.mutually-exclusive')}</>,
  type: FieldTypes.SWITCH_MUI,
  required: false,
  props: {
    id: 'tags_mutuallyExclusive',
    'data-testid': 'mutually-exclusive-button',
    disabled,
  },
  helperText: (
    <>
      {t('message.mutually-exclusive-alert', {
        entity: t('label.classification'),
        'child-entity': t('label.tag'),
      })}
    </>
  ),
  helperTextType: HelperTextType.ALERT,
  showHelperText,
  id: 'root/mutuallyExclusive',
});
