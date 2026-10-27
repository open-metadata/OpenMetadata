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
import { isUndefined, omit, omitBy } from 'lodash';
import {
  PROPERTY_TYPES_WITH_ENTITY_REFERENCE,
  PROPERTY_TYPES_WITH_FORMAT,
  SUPPORTED_FORMAT_MAP,
  TABLE_TYPE_CUSTOM_PROPERTY,
} from '../../../../../../constants/CustomProperty.constants';
import { Type } from '../../../../../../generated/entity/type';
import { CustomProperty } from '../../../../../../generated/type/customProperty';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { SettingMenuItem } from '../../../../../../utils/GlobalSettingsUtils';
import { safeDecodeURIComponent } from '../../../../../../utils/SettingsHashUtils';
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

/** Which config fields the selected property type needs. */
export const getCustomPropertyTypeFlags = (
  propertyTypes: Type[],
  propertyType?: FormSelectItem | string | null
) => {
  const selectedId = toId(propertyType ?? undefined);
  const typeName =
    propertyTypes.find((type) => type.id === selectedId)?.name ?? '';

  return {
    hasEnumConfig: typeName === 'enum',
    hasFormatConfig: PROPERTY_TYPES_WITH_FORMAT.includes(typeName),
    hasEntityReferenceConfig:
      PROPERTY_TYPES_WITH_ENTITY_REFERENCE.includes(typeName),
    hasTableTypeConfig: typeName === TABLE_TYPE_CUSTOM_PROPERTY,
    supportedFormats:
      SUPPORTED_FORMAT_MAP[typeName as keyof typeof SUPPORTED_FORMAT_MAP] ?? [],
  };
};

/** Add-form values → the custom property the types API expects. */
export const toCustomPropertyPayload = (
  data: AddCustomPropertyFormValues,
  propertyTypes: Type[]
): CustomProperty => {
  const flags = getCustomPropertyTypeFlags(propertyTypes, data.propertyType);
  const customPropertyConfig = buildCustomPropertyConfig(
    data,
    flags.hasEnumConfig,
    flags.hasFormatConfig,
    flags.hasEntityReferenceConfig,
    flags.hasTableTypeConfig
  );

  return omitBy(
    {
      ...omit(data, [
        'multiSelect',
        'formatConfig',
        'entityReferenceConfig',
        'enumConfig',
        'columns',
      ]),
      displayName: data.displayName || undefined,
      propertyType: {
        id: toId(data.propertyType ?? undefined),
        type: 'type',
      },
      ...(isUndefined(customPropertyConfig) ? {} : { customPropertyConfig }),
    },
    isUndefined
  ) as unknown as CustomProperty;
};

export interface ParsedCustomPropertiesHash {
  entityFqn: string | null;
  action: 'detail' | 'add' | 'edit';
  propertyName?: string;
}

export function parseCustomPropertiesHash(
  subPath: string
): ParsedCustomPropertiesHash {
  if (!subPath) {
    return { entityFqn: null, action: 'detail' };
  }

  // Names travel URL-encoded in the hash; decode them once here.
  const parts = subPath.split('/');
  const entityFqn = parts[0] ? safeDecodeURIComponent(parts[0]) : null;

  if (parts[1] === 'add-property') {
    return { entityFqn, action: 'add' };
  }

  if (parts[1] === 'edit-property' && parts[2]) {
    return {
      entityFqn,
      action: 'edit',
      propertyName: safeDecodeURIComponent(parts.slice(2).join('/')),
    };
  }

  return { entityFqn, action: 'detail' };
}

/** Sub-path of an entity type's custom-property list, from its fqn alone. */
// Names travel URL-encoded in the hash; parseCustomPropertiesHash decodes them.
export const entityTypeDetailSubPath = (entityTypeFqn: string): string =>
  encodeURIComponent(entityTypeFqn);

export function viewToSubPath(
  view: CustomPropertiesSubView
): string | undefined {
  switch (view.type) {
    case 'landing':
      return undefined;
    case 'detail':
      return view.entityType.fullyQualifiedName
        ? entityTypeDetailSubPath(view.entityType.fullyQualifiedName)
        : undefined;
    case 'add':
      return `${encodeURIComponent(
        view.entityType.fullyQualifiedName ?? ''
      )}/add-property`;
    case 'edit':
      return `${encodeURIComponent(
        view.entityType.fullyQualifiedName ?? ''
      )}/edit-property/${encodeURIComponent(view.property.name)}`;
    default:
      return undefined;
  }
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
