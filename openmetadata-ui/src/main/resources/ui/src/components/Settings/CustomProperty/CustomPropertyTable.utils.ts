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
import { TFunction } from 'i18next';
import { isArray, isEmpty, isString, startCase } from 'lodash';
import { CustomProperty } from '../../../generated/type/customProperty';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { CUSTOM_PROPERTY_TYPE_META } from '../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.constants';
import { getPropertyTypeMeta } from '../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.utils';
import {
  CustomPropertyConfigSummary,
  CustomPropertyTypeBadge,
} from './CustomPropertyTable.interface';

export const getPropertyTypeBadge = (
  propertyType: CustomProperty['propertyType'],
  t: TFunction
): CustomPropertyTypeBadge => {
  const meta = getPropertyTypeMeta(propertyType.name);

  return {
    color: meta.color,
    // Types without design metadata keep the name the API reports.
    label: CUSTOM_PROPERTY_TYPE_META[propertyType.name ?? '']
      ? t(meta.labelKey)
      : startCase(getEntityName(propertyType).replace(/-cp/g, '')),
  };
};

export const getPropertyConfigSummary = (
  property: CustomProperty,
  t: TFunction
): CustomPropertyConfigSummary | undefined => {
  const config = property.customPropertyConfig?.config;

  if (isString(config)) {
    return isEmpty(config)
      ? undefined
      : {
          label: t('label.format'),
          values: [config],
          testId: `${property.name}-config`,
        };
  }

  if (isArray(config)) {
    return isEmpty(config)
      ? undefined
      : {
          label: t('label.entity-types'),
          values: config.map((entityType) => startCase(entityType)),
          testId: `${property.name}-config`,
        };
  }

  if (config?.columns) {
    return {
      label: t('label.column-plural'),
      values: config.columns,
      testId: 'table-config',
    };
  }

  if (config?.values) {
    return {
      label: `${t('label.value-plural')} · ${
        config.multiSelect ? t('label.multi-select') : t('label.single-select')
      }`,
      values: config.values,
      testId: 'enum-config',
    };
  }

  return undefined;
};
