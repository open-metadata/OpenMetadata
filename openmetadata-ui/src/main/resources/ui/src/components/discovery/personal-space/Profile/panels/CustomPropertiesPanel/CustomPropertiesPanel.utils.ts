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
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { SettingMenuItem } from '../../../../../../utils/GlobalSettingsUtils';
import { CRUMB } from './CustomPropertiesPanel.constants';
import {
  AddCustomPropertyFormValues,
  CustomPropertiesSubView,
  FormSelectItem,
} from './CustomPropertiesPanel.types';

/** Extract the id string from a FormSelectItem (or return as-is if already a string). */
export const toId = (v: FormSelectItem | string | undefined): string => {
  if (!v) {
    return '';
  }

  return typeof v === 'string' ? v : v.id;
};

export function buildCustomPropertyConfig(
  data: AddCustomPropertyFormValues,
  hasEnumConfig: boolean,
  hasFormatConfig: boolean,
  hasEntityReferenceConfig: boolean,
  hasTableTypeConfig: boolean
) {
  if (hasEnumConfig) {
    return {
      config: {
        multiSelect: Boolean(data.multiSelect),
        values: (data.enumConfig ?? []).map(toId),
      },
    };
  }
  if (hasFormatConfig && data.formatConfig) {
    return { config: toId(data.formatConfig) };
  }
  if (hasEntityReferenceConfig && data.entityReferenceConfig) {
    return { config: data.entityReferenceConfig.map(toId) };
  }
  if (hasTableTypeConfig && data.columns) {
    return { config: { columns: data.columns.map(toId) } };
  }

  return undefined;
}

export function getBreadcrumbItems(
  subView: CustomPropertiesSubView,
  t: TFunction,
  matchingSettingsItem: SettingMenuItem | undefined
): { id: string; label: string }[] {
  const base = [
    { id: CRUMB.WORKSPACE, label: t('label.workspace') },
    { id: CRUMB.LANDING, label: t('label.custom-property-plural') },
  ];

  if (subView.type === 'detail') {
    const entityLabel =
      matchingSettingsItem?.label ?? getEntityName(subView.entityType);

    return [...base, { id: CRUMB.DETAIL, label: entityLabel }];
  }

  if (subView.type === 'add') {
    const entityLabel =
      matchingSettingsItem?.label ?? getEntityName(subView.entityType);

    return [
      ...base,
      { id: CRUMB.DETAIL, label: entityLabel },
      {
        id: CRUMB.ACTION,
        label: t('label.add-entity', { entity: t('label.custom-property') }),
      },
    ];
  }

  if (subView.type === 'edit') {
    const entityLabel =
      matchingSettingsItem?.label ?? getEntityName(subView.entityType);

    return [
      ...base,
      { id: CRUMB.DETAIL, label: entityLabel },
      { id: CRUMB.ACTION, label: getEntityName(subView.property) },
    ];
  }

  return base;
}

export function getPageTitle(
  subView: CustomPropertiesSubView,
  t: TFunction,
  matchingSettingsItem: SettingMenuItem | undefined
): string {
  if (subView.type === 'detail') {
    return matchingSettingsItem?.label ?? getEntityName(subView.entityType);
  }
  if (subView.type === 'add') {
    return t('label.add-entity', { entity: t('label.custom-property') });
  }
  if (subView.type === 'edit') {
    return getEntityName(subView.property);
  }

  return t('label.custom-property-plural');
}

