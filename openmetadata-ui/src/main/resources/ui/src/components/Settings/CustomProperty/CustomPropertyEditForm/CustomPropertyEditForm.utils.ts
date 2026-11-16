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
import { FormSelectItem } from '@openmetadata/ui-core-components';
import { isArray, isPlainObject, uniq } from 'lodash';
import {
  ENTITY_REFERENCE_OPTIONS,
  PROPERTY_TYPES_WITH_ENTITY_REFERENCE,
} from '../../../../constants/CustomProperty.constants';
import {
  Config,
  CustomProperty,
} from '../../../../generated/type/customProperty';
import { CustomPropertyChanges } from '../../../../rest/metadataTypeAPI';
import { EditCustomPropertyFormValues } from './CustomPropertyEditForm.interface';

const toSelectItem = (value: string): FormSelectItem => ({
  id: value,
  label: value,
});

// Seeded with the option's label so saved types read like newly picked ones.
const toEntityReferenceItem = (value: string): FormSelectItem => ({
  id: value,
  label:
    ENTITY_REFERENCE_OPTIONS.find((option) => option.value === value)?.label ??
    value,
});

export const isEnumProperty = (property: CustomProperty) =>
  property.propertyType.name === 'enum';

export const isEntityReferenceProperty = (property: CustomProperty) =>
  PROPERTY_TYPES_WITH_ENTITY_REFERENCE.includes(
    property.propertyType.name ?? ''
  );

export const getEnumConfig = (property: CustomProperty): Config | undefined => {
  const config = property.customPropertyConfig?.config;

  return isEnumProperty(property) && isPlainObject(config)
    ? (config as Config)
    : undefined;
};

export const getSavedEntityReferences = (
  property: CustomProperty
): string[] => {
  const config = property.customPropertyConfig?.config;

  return isEntityReferenceProperty(property) && isArray(config) ? config : [];
};

export const getEditFormValues = (
  property: CustomProperty
): EditCustomPropertyFormValues => {
  const enumConfig = getEnumConfig(property);
  const entityReferences = getSavedEntityReferences(property);

  return {
    displayName: property.displayName ?? '',
    description: property.description ?? '',
    enumConfig: (enumConfig?.values ?? []).map(toSelectItem),
    multiSelect: Boolean(enumConfig?.multiSelect),
    entityReferenceConfig: entityReferences.map(toEntityReferenceItem),
  };
};

/**
 * Only the enum and entity-reference configs are edited here; leaving the
 * config unset for other types keeps a concurrent config change intact.
 */
export const getCustomPropertyChanges = (
  property: CustomProperty,
  values: EditCustomPropertyFormValues
): CustomPropertyChanges => {
  let customPropertyConfig: CustomPropertyChanges['customPropertyConfig'];

  if (isEnumProperty(property) && values.enumConfig) {
    customPropertyConfig = {
      config: {
        multiSelect: Boolean(values.multiSelect),
        values: uniq(values.enumConfig.map(({ id }) => id)),
      },
    };
  } else if (
    isEntityReferenceProperty(property) &&
    values.entityReferenceConfig
  ) {
    // Types are additive: a saved type stays even if it was dropped from the
    // selection, since removing it would orphan stored references.
    customPropertyConfig = {
      config: uniq([
        ...getSavedEntityReferences(property),
        ...values.entityReferenceConfig.map(({ id }) => id),
      ]),
    };
  }

  // `getEditFormValues` seeds displayName with `property.displayName ?? ''`,
  // so an unchanged field reads back as '' for properties without a display
  // name. Returning that '' would make `updateCustomPropertyByName` emit an
  // `add /displayName ""` op — silently persisting an empty displayName on an
  // unrelated edit. Treat an unchanged displayName as a no-op (undefined),
  // the same way `updateCustomPropertyByName` treats any undefined change.
  const displayName =
    values.displayName === (property.displayName ?? '')
      ? undefined
      : values.displayName;

  return {
    displayName,
    description: values.description,
    customPropertyConfig,
  };
};
