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

import { ObjectFieldTemplateProps } from '@rjsf/utils';
import { cloneElement, isValidElement } from 'react';
import {
  DisableableFieldElement,
  SchemaPropertyLayout,
} from 'src/components/common/FormBuilderV1/templates/CoreObjectFieldTemplate.interface';
import {
  ADVANCED_PROPERTIES,
  AWS_S3_STORAGE_CONFIG_TITLE,
  CREDENTIAL_VALUE_PROPERTY_ORDER,
  DEFAULT_ADVANCED_PROPERTY_NAMES,
  FULL_WIDTH_FIELD_PATTERN,
  GATED_CREDENTIAL_PROPERTY_ORDER,
  GATED_CREDENTIAL_VISIBLE_PROPERTIES,
  SAMPLE_DATA_CONFIG_ID_SUFFIX,
  SAMPLE_DATA_PROPERTY_ORDER,
  SAMPLE_DATA_SECTION_ID_SUFFIX,
  STATIC_AWS_CREDENTIAL_PROPERTIES,
  STORAGE_CONFIG_ID_SUFFIX,
  STORAGE_CONFIG_PROPERTY_ORDER,
} from 'src/constants/CoreObjectFieldTemplate.constants';
import { t } from './i18next/LocalUtil';

export const isPlainObject = (
  value: unknown
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const getSchemaProperty = (
  schema: ObjectFieldTemplateProps['schema'],
  name: string
): SchemaPropertyLayout | undefined => {
  if (!isPlainObject(schema.properties)) {
    return undefined;
  }

  const property = schema.properties[name];

  if (!isPlainObject(property)) {
    return undefined;
  }

  return property as SchemaPropertyLayout;
};

export const getUiSchemaProperty = (
  uiSchema: ObjectFieldTemplateProps['uiSchema'],
  name: string
): Record<string, unknown> | undefined => {
  if (!isPlainObject(uiSchema)) {
    return undefined;
  }

  const property = uiSchema[name];

  return isPlainObject(property) ? property : undefined;
};

export const hasSchemaType = (
  schemaProperty: SchemaPropertyLayout | undefined,
  type: string
) => {
  if (Array.isArray(schemaProperty?.type)) {
    return schemaProperty.type.includes(type);
  }

  return schemaProperty?.type === type;
};

export const isRequiredSchemaProperty = (
  schema: ObjectFieldTemplateProps['schema'],
  name: string
) => schema.required?.includes(name) ?? false;

export const hasLongValueSignal = (
  name: string,
  schemaProperty: SchemaPropertyLayout | undefined
) => {
  const layoutText = [
    name,
    schemaProperty?.title,
    schemaProperty?.description,
    schemaProperty?.format,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/[\s_-]+/g, '');
  const normalizedName = name.replace(/[\s_-]+/g, '').toLowerCase();

  return (
    FULL_WIDTH_FIELD_PATTERN.test(layoutText) || normalizedName === 'privatekey'
  );
};

export const shouldSpanFullWidth = ({
  name,
  schema,
  uiSchema,
}: {
  name: string;
  schema: ObjectFieldTemplateProps['schema'];
  uiSchema: ObjectFieldTemplateProps['uiSchema'];
}) => {
  const schemaProperty = getSchemaProperty(schema, name);
  const uiSchemaProperty = getUiSchemaProperty(uiSchema, name);
  const uiOptions = uiSchemaProperty?.['ui:options'];

  if (
    isPlainObject(uiOptions) &&
    typeof uiOptions.fullWidth === 'boolean' &&
    uiOptions.fullWidth
  ) {
    return true;
  }

  if (uiSchemaProperty?.['ui:widget'] === 'textarea') {
    return true;
  }

  return (
    hasSchemaType(schemaProperty, 'object') ||
    hasSchemaType(schemaProperty, 'array') ||
    Boolean(schemaProperty?.oneOf?.length) ||
    Boolean(schemaProperty?.anyOf?.length) ||
    hasLongValueSignal(name, schemaProperty)
  );
};

export const orderProperties = (
  properties: ObjectFieldTemplateProps['properties'],
  order: string[]
) => {
  const orderMap = new Map(order.map((property, index) => [property, index]));

  return [...properties].sort((first, second) => {
    const firstIndex = orderMap.get(first.name) ?? Number.MAX_SAFE_INTEGER;
    const secondIndex = orderMap.get(second.name) ?? Number.MAX_SAFE_INTEGER;

    if (firstIndex === secondIndex) {
      return 0;
    }

    return firstIndex - secondIndex;
  });
};

export const getFormSeperationConfig = ({
  formContext,
  idSchema,
  properties,
  title,
  schema,
  description,
  formData,
}: {
  formContext: ObjectFieldTemplateProps['formContext'];
  idSchema: ObjectFieldTemplateProps['idSchema'];
  properties: ObjectFieldTemplateProps['properties'];
  title: ObjectFieldTemplateProps['title'];
  schema: ObjectFieldTemplateProps['schema'];
  description: ObjectFieldTemplateProps['description'];
  formData: ObjectFieldTemplateProps['formData'];
}) => {
  const flatPropertyLayout =
    (formContext as { flatPropertyLayout?: boolean } | undefined)
      ?.flatPropertyLayout ?? false;

  const isRoot = idSchema.$id === 'root';
  const isSampleDataSection = idSchema.$id.endsWith(
    SAMPLE_DATA_SECTION_ID_SUFFIX
  );
  const isSampleDataConfig = idSchema.$id.endsWith(
    SAMPLE_DATA_CONFIG_ID_SUFFIX
  );
  const hasIamAuthToggle =
    properties.some(
      (property) => !property.hidden && property.name === 'enabled'
    ) &&
    properties.some(
      (property) =>
        !property.hidden && STATIC_AWS_CREDENTIAL_PROPERTIES.has(property.name)
    );
  const isAwsS3StorageConfig =
    idSchema.$id.endsWith(STORAGE_CONFIG_ID_SUFFIX) ||
    (title === AWS_S3_STORAGE_CONFIG_TITLE && hasIamAuthToggle);
  const isGatedCredentialConfig =
    !isRoot && !schema.additionalProperties && hasIamAuthToggle;
  const isGenericNestedConfig =
    !isRoot &&
    !schema.additionalProperties &&
    !isSampleDataSection &&
    !isSampleDataConfig &&
    !isAwsS3StorageConfig;
  const isNestedConfigGrid =
    isSampleDataConfig || isAwsS3StorageConfig || isGenericNestedConfig;
  const isCredentialAdvancedDisclosure =
    isGatedCredentialConfig || isGenericNestedConfig;
  const isIamAuthEnabled =
    hasIamAuthToggle &&
    typeof formData === 'object' &&
    formData !== null &&
    (formData as { enabled?: boolean }).enabled === true;
  const addEntityLabel = title || t('label.property');
  const shouldShowDescription = Boolean(description && description !== title);

  return {
    flatPropertyLayout,
    isRoot,
    isSampleDataSection,
    isSampleDataConfig,
    hasIamAuthToggle,
    isAwsS3StorageConfig,
    isGatedCredentialConfig,
    isGenericNestedConfig,
    isNestedConfigGrid,
    isCredentialAdvancedDisclosure,
    isIamAuthEnabled,
    addEntityLabel,
    shouldShowDescription,
  };
};

export const getPropertyContent = (
  element: ObjectFieldTemplateProps['properties'][number],
  isIamAuthEnabled: boolean
) => {
  if (
    !(isIamAuthEnabled && STATIC_AWS_CREDENTIAL_PROPERTIES.has(element.name)) ||
    !isValidElement(element.content)
  ) {
    return element.content;
  }

  return cloneElement(element.content as DisableableFieldElement, {
    disabled: true,
  });
};

export const getAdvancedHeaderLabel = (
  isOpen: boolean,
  isGatedCredentialConfig: boolean,
  isImpersonationOnlyDisclosure: boolean,
  isGenericNestedConfig: boolean,
  orderedAdvancedPropertiesLength: number,
  title: string | undefined,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  if (isGatedCredentialConfig) {
    return `${t(isOpen ? 'label.hide' : 'label.show')} ${t(
      'label.advanced-config'
    )} (${orderedAdvancedPropertiesLength})`;
  }

  if (isImpersonationOnlyDisclosure) {
    return t(
      isOpen
        ? 'label.hide-impersonation-settings'
        : 'label.show-impersonation-settings',
      {
        count: orderedAdvancedPropertiesLength,
      }
    );
  }

  if (isGenericNestedConfig) {
    return t(
      isOpen
        ? 'label.hide-advanced-credential-settings'
        : 'label.show-advanced-credential-settings',
      {
        count: orderedAdvancedPropertiesLength,
      }
    );
  }

  return title
    ? `${title} ${t('label.advanced-config')}`
    : t('label.advanced-config');
};

export const partitionProperties = (
  properties: ObjectFieldTemplateProps['properties'],
  schema: ObjectFieldTemplateProps['schema'],
  isRoot: boolean,
  isGatedCredentialConfig: boolean
) => {
  return properties.reduce(
    (acc, prop) => {
      if (prop.hidden) {
        return acc;
      }
      const schemaProperty = getSchemaProperty(schema, prop.name);
      const isGatedAdvanced =
        isGatedCredentialConfig &&
        !GATED_CREDENTIAL_VISIBLE_PROPERTIES.has(prop.name) &&
        !isRequiredSchemaProperty(schema, prop.name);
      const isDefaultAdvanced =
        !isRoot &&
        !isRequiredSchemaProperty(schema, prop.name) &&
        (DEFAULT_ADVANCED_PROPERTY_NAMES.has(prop.name) ||
          (prop.name.toLowerCase().includes('impersonate') &&
            hasSchemaType(schemaProperty, 'object')) ||
          (prop.name === 'type' &&
            (schemaProperty?.const !== undefined ||
              schemaProperty?.default !== undefined)));

      if (
        ADVANCED_PROPERTIES.has(prop.name) ||
        isGatedAdvanced ||
        isDefaultAdvanced
      ) {
        acc.advancedProperties.push(prop);
      } else {
        acc.normalProperties.push(prop);
      }

      return acc;
    },
    {
      normalProperties: [] as typeof properties,
      advancedProperties: [] as typeof properties,
    }
  );
};

export const getOrderedNormalProperties = (
  normalProperties: ObjectFieldTemplateProps['properties'],
  isSampleDataConfig: boolean,
  isAwsS3StorageConfig: boolean,
  isGatedCredentialConfig: boolean,
  isGenericNestedConfig: boolean
) => {
  if (isSampleDataConfig) {
    return orderProperties(normalProperties, SAMPLE_DATA_PROPERTY_ORDER);
  }

  if (isAwsS3StorageConfig) {
    return orderProperties(normalProperties, STORAGE_CONFIG_PROPERTY_ORDER);
  }

  if (isGatedCredentialConfig) {
    return orderProperties(normalProperties, GATED_CREDENTIAL_PROPERTY_ORDER);
  }

  if (isGenericNestedConfig) {
    return orderProperties(normalProperties, CREDENTIAL_VALUE_PROPERTY_ORDER);
  }

  return normalProperties;
};
