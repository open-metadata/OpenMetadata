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
import { NAME_FIELD_RULES } from '../../constants/Form.constants';
import { EntityReference } from '../../generated/tests/testCase';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
  HelperTextType,
} from '../../interface/FormUtils.interface';
import { iconTooltipDataRender } from '../../utils/DomainUtils';
import i18n from '../../utils/i18next/LocalUtil';

export const getIconField = (selectedColor?: string): FieldProp => ({
  name: 'iconURL',
  id: 'root/iconURL',
  label: <>{i18n.t('label.icon')}</>,
  muiLabel: <>{i18n.t('label.icon')}</>,
  required: false,
  type: FieldTypes.ICON_PICKER_MUI,
  helperText: iconTooltipDataRender(),
  props: {
    'data-testid': 'icon-url',
    allowUrl: true,
    placeholder: i18n.t('label.icon-url'),
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

export const colorField: FieldProp = {
  name: 'color',
  id: 'root/color',
  label: <>{i18n.t('label.color')}</>,
  muiLabel: <>{i18n.t('label.color')}</>,
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
  label: <>{i18n.t('label.name')}</>,
  required: true,
  placeholder: i18n.t('label.name'),
  type: FieldTypes.TEXT_MUI,
  props: {
    'data-testid': 'name',
    disabled,
  },
  rules: NAME_FIELD_RULES,
});

export const getDisplayNameField = (disabled: boolean): FieldProp => ({
  name: 'displayName',
  id: 'root/displayName',
  label: <>{i18n.t('label.display-name')}</>,
  required: false,
  placeholder: i18n.t('label.display-name'),
  type: FieldTypes.TEXT_MUI,
  props: {
    'data-testid': 'display-name',
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
  label: <>{i18n.t('label.owner-plural')}</>,
  type: FieldTypes.USER_TEAM_SELECT_MUI,
  props: {
    multipleUser: canAddMultipleUserOwners,
    multipleTeam: canAddMultipleTeamOwner,
    label: i18n.t('label.owner-plural'),
  },
  formItemProps: {
    valuePropName: 'value',
    trigger: 'onChange',
  },
});

export const getDomainField = ({
  canAddMultipleDomains,
  activeDomainEntityRef,
}: {
  canAddMultipleDomains: boolean;
  activeDomainEntityRef?: EntityReference;
}): FieldProp => ({
  name: 'domains',
  id: 'root/domains',
  required: false,
  label: <>{i18n.t('label.domain-plural')}</>,
  type: FieldTypes.DOMAIN_SELECT_MUI,
  props: {
    'data-testid': 'domain-select',
    hasPermission: true,
    multiple: canAddMultipleDomains,
    value: activeDomainEntityRef,
  },
  formItemProps: {
    valuePropName: 'value',
    trigger: 'onChange',
    initialValue: activeDomainEntityRef,
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
  label: <>{i18n.t('label.description')}</>,
  id: 'root/description',
  type: FieldTypes.DESCRIPTION,
  props: {
    'data-testid': 'description',
    initialValue,
    readonly,
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
  label: <>{i18n.t('label.disable-tag')}</>,
  id: 'root/disabled',
  type: FieldTypes.SWITCH_MUI,
  formItemLayout: FormItemLayout.HORIZONTAL,
  props: {
    'data-testid': 'disabled',
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
  label: <>{i18n.t('label.mutually-exclusive')}</>,
  type: FieldTypes.SWITCH_MUI,
  required: false,
  props: {
    'data-testid': 'mutually-exclusive-button',
    disabled,
  },
  helperText: (
    <>
      {i18n.t('message.mutually-exclusive-alert', {
        entity: i18n.t('label.classification'),
        'child-entity': i18n.t('label.tag'),
      })}
    </>
  ),
  helperTextType: HelperTextType.ALERT,
  showHelperText,
  id: 'root/mutuallyExclusive',
});
