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
import { ReactNode } from 'react';
import { DEFAULT_TAG_ICON } from '../../components/common/IconPicker';
import { TagFormSelectItem } from './TagsPage.interface';

export const getIconField = (
  selectedColor?: string,
  iconOptions?: TagFormSelectItem[]
): FieldProp => ({
  name: 'style.iconURL',
  id: 'root/style/iconURL',
  label: 'label.icon',
  required: false,
  type: FieldTypes.ICON_PICKER,
  placeholder: 'label.icon-url',
  props: {
    'data-testid': 'icon-picker-btn',
    allowUrl: true,
    backgroundColor: selectedColor,
    defaultIcon: DEFAULT_TAG_ICON,
    options: iconOptions ?? [],
    labels: {
      customIconUrl: 'label.icon-url',
      emptyState: 'message.no-entity-available',
      enterIconUrl: 'label.enter-entity',
      iconsTab: 'label.icon-plural',
      urlTab: 'label.url',
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

export const getNameField = (disabled: boolean): FieldProp => ({
  name: 'name',
  id: 'root/name',
  label: 'label.name',
  required: true,
  placeholder: 'label.name',
  type: FieldTypes.TEXT,
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
  multiple,
  options,
  onFocus,
  onSearchChange,
}: {
  multiple: boolean;
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
    multiple,
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
  initialValue: _initialValue,
  disabled,
}: {
  initialValue: boolean;
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
