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
import {
  FieldProp,
  FieldTypes,
  HelperTextType,
} from '@openmetadata/ui-core-components';
import { TFunction } from 'i18next';
import { ReactNode } from 'react';
import { DEFAULT_TAG_ICON } from '../../components/common/IconPicker';
import {
  NAME_LENGTH_REGEX,
  TAG_NAME_REGEX,
} from '../../constants/regex.constants';
import { TagFormSelectItem } from './TagsPage.interface';

export const getIconField = (
  t: TFunction,
  selectedColor?: string,
  iconOptions?: TagFormSelectItem[],
): FieldProp => ({
  name: 'style.iconURL',
  id: 'root/style/iconURL',
  label: t('label.icon'),
  required: false,
  type: FieldTypes.ICON_PICKER,
  placeholder: t('label.icon-url'),
  props: {
    'data-testid': 'icon-picker-btn',
    allowUrl: true,
    backgroundColor: selectedColor,
    defaultIcon: DEFAULT_TAG_ICON,
    options: iconOptions ?? [],
    labels: {
      customIconUrl: t('label.icon-url'),
      emptyState: t('message.no-entity-available'),
      enterIconUrl: t('label.enter-entity'),
      iconsTab: t('label.icon-plural'),
      urlTab: t('label.url'),
    },
  },
});

export const COLOR_FIELD: FieldProp = {
  name: 'style.color',
  id: 'root/style/color',
  label: 'label.color',
  required: false,
  type: FieldTypes.COLOR_PICKER,
};

export const getNameField = (disabled: boolean, t: TFunction): FieldProp => ({
  name: 'name',
  id: 'root/name',
  label: 'label.name',
  required: true,
  placeholder: 'label.name',
  type: FieldTypes.TEXT,
  rules: {
    required: t('label.field-required', {
      field: t('label.name'),
    }) as string,
    validate: {
      length: (value: string) =>
        NAME_LENGTH_REGEX.test(value) ||
        (t('message.entity-size-in-between', {
          entity: t('label.name'),
          max: 64,
          min: 2,
        }) as string),
      pattern: (value: string) =>
        TAG_NAME_REGEX.test(value) ||
        (t('message.entity-name-validation') as string),
    },
  },
  props: {
    'data-testid': 'name',
    disabled,
  },
});

export const getDisplayNameField = (disabled: boolean): FieldProp => ({
  name: 'displayName',
  id: 'root/displayName',
  label: 'label.display-name',
  required: false,
  placeholder: 'label.display-name',
  type: FieldTypes.TEXT,
  props: {
    'data-testid': 'displayName',
    disabled,
  },
});

export const getOwnerField = ({
  canAddMultipleUserOwners,
  options,
  onFocus,
  onSearchChange,
}: {
  canAddMultipleUserOwners: boolean;
  options: TagFormSelectItem[];
  onFocus: () => void;
  onSearchChange: (searchText: string) => void;
}): FieldProp => ({
  name: 'owners',
  id: 'root/owners',
  required: false,
  label: 'label.owner-plural',
  type: FieldTypes.USER_TEAM_SELECT_INPUT,
  props: {
    filterOption: () => true,
    multiple: canAddMultipleUserOwners,
    onFocus,
    onSearchChange,
    options,
  },
});

export const getDomainField = ({
  canAddMultipleDomains,
  options,
  onFocus,
  onSearchChange,
}: {
  canAddMultipleDomains: boolean;
  options: TagFormSelectItem[];
  onFocus: () => void;
  onSearchChange: (searchText: string) => void;
}): FieldProp => ({
  name: 'domains',
  id: 'root/domains',
  required: false,
  label: 'label.domain-plural',
  type: FieldTypes.DOMAIN_SELECT,
  props: {
    'data-testid': 'domain-select',
    filterOption: () => true,
    multiple: canAddMultipleDomains,
    onFocus,
    onSearchChange,
    options,
  },
});

export const getDisabledField = ({
  disabled,
}: {
  disabled: boolean;
}): FieldProp => ({
  name: 'disabled',
  required: false,
  label: 'label.disable-tag',
  id: 'root/disabled',
  type: FieldTypes.SWITCH,
  props: {
    'data-testid': 'disabled',
    disabled,
  },
});

export const getMutuallyExclusiveField = ({
  disabled,
  helperText,
}: {
  disabled: boolean;
  helperText?: ReactNode;
}): FieldProp => ({
  name: 'mutuallyExclusive',
  label: 'label.mutually-exclusive',
  type: FieldTypes.SWITCH,
  required: false,
  helperTextType: HelperTextType.ALERT,
  helperText,
  id: 'root/mutuallyExclusive',
  props: {
    'data-testid': 'mutually-exclusive-button',
    disabled,
  },
});
