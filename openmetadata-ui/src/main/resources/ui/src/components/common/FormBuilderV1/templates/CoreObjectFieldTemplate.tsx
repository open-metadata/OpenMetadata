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
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
import { ObjectFieldTemplateProps } from '@rjsf/utils';
import { Hexagon01, Plus } from '@untitledui/icons';
import classNames from 'classnames';
import {
  cloneElement,
  Fragment,
  FunctionComponent,
  isValidElement,
  ReactElement,
} from 'react';
import { useTranslation } from 'react-i18next';

const ADVANCED_PROPERTIES = new Set([
  'connectionArguments',
  'connectionOptions',
  'sampleDataStorageConfig',
  'scheme',
  'sslConfig',
  'sslMode',
]);

const SAMPLE_DATA_SECTION_ID_SUFFIX = '/sampleDataStorageConfig';
const SAMPLE_DATA_CONFIG_ID_SUFFIX = '/sampleDataStorageConfig/config';
const STORAGE_CONFIG_ID_SUFFIX =
  '/sampleDataStorageConfig/config/storageConfig';
const AWS_S3_STORAGE_CONFIG_TITLE = 'AWS S3 Storage Config';
const SAMPLE_DATA_PROPERTY_ORDER = [
  'bucketName',
  'prefix',
  'filePathPattern',
  'overwriteData',
  'storageConfig',
];
const STORAGE_CONFIG_PROPERTY_ORDER = [
  'enabled',
  'awsAccessKeyId',
  'awsSecretAccessKey',
  'awsRegion',
  'awsSessionToken',
  'endPointURL',
  'profileName',
  'assumeRoleArn',
  'assumeRoleSessionName',
  'assumeRoleSourceIdentity',
];
const STATIC_AWS_CREDENTIAL_PROPERTIES = new Set([
  'awsAccessKeyId',
  'awsSecretAccessKey',
  'awsSessionToken',
]);

type DisableableFieldElement = ReactElement<{ disabled?: boolean }>;

const orderProperties = (
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

export const CoreObjectFieldTemplate: FunctionComponent<
  ObjectFieldTemplateProps
> = ({
  title,
  description,
  formData,
  onAddClick,
  schema,
  properties,
  idSchema,
}) => {
  const { t } = useTranslation();

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
  const isNestedConfigGrid = isSampleDataConfig || isAwsS3StorageConfig;
  const isIamAuthEnabled =
    hasIamAuthToggle &&
    typeof formData === 'object' &&
    formData !== null &&
    (formData as { enabled?: boolean }).enabled === true;
  const addEntityLabel = title || t('label.property');
  const isStaticCredentialDisabled = (name: string) =>
    isIamAuthEnabled && STATIC_AWS_CREDENTIAL_PROPERTIES.has(name);
  const getPropertyClassName = (name: string, disabled?: boolean) =>
    classNames(
      'core-object-field-template-property tw:rounded-xl tw:bg-utility-gray-blue-50',
      `core-object-field-template-property-${name}`,
      isRoot && 'tw:p-4',
      disabled && 'core-object-field-template-property-disabled'
    );
  const getPropertyContent = (element: (typeof properties)[number]) => {
    if (
      !isStaticCredentialDisabled(element.name) ||
      !isValidElement(element.content)
    ) {
      return element.content;
    }

    return cloneElement(element.content as DisableableFieldElement, {
      disabled: true,
    });
  };
  const addButton = schema.additionalProperties ? (
    <Button
      aria-label={t('label.add-entity', { entity: addEntityLabel })}
      className="core-object-field-template-add-button"
      color="primary"
      data-testid={`add-item-${addEntityLabel}`}
      id={`${idSchema.$id}`}
      size="sm"
      onClick={() => onAddClick(schema)()}>
      <Plus data-icon size={14} />
    </Button>
  ) : null;

  const { normalProperties, advancedProperties } = properties.reduce(
    (acc, prop) => {
      if (prop.hidden) {
        return acc;
      }
      if (ADVANCED_PROPERTIES.has(prop.name)) {
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
  const orderedNormalProperties = (() => {
    if (isSampleDataConfig) {
      return orderProperties(normalProperties, SAMPLE_DATA_PROPERTY_ORDER);
    }

    if (isAwsS3StorageConfig) {
      return orderProperties(normalProperties, STORAGE_CONFIG_PROPERTY_ORDER);
    }

    return normalProperties;
  })();

  const propertiesContent = (
    <>
      <div
        className={classNames(
          'core-object-field-template-body',
          isNestedConfigGrid
            ? 'core-object-field-template-body-grid'
            : 'tw:flex tw:flex-col tw:gap-4'
        )}>
        {!isRoot && schema.additionalProperties && (
          <div className="core-object-field-template-additional-header tw:flex tw:items-center tw:justify-between tw:gap-3">
            <Typography
              as="label"
              className="core-object-field-template-additional-label tw:text-secondary"
              size="text-xs"
              weight="semibold">
              {t('label.additional-property-plural')}
            </Typography>
            {addButton}
          </div>
        )}
        {orderedNormalProperties.map((element) => {
          const isDisabled = isStaticCredentialDisabled(element.name);

          return (
            <div
              aria-disabled={isDisabled || undefined}
              className={getPropertyClassName(element.name, isDisabled)}
              data-field-name={element.name}
              key={element.name}>
              {getPropertyContent(element)}
            </div>
          );
        })}
        {!isRoot &&
          schema.additionalProperties &&
          normalProperties.length === 0 && (
            <Typography
              as="span"
              className="core-object-field-template-empty tw:text-tertiary"
              size="text-xs">
              {t('message.no-properties-added')}
            </Typography>
          )}
      </div>

      {advancedProperties.length > 0 && (
        <div className="tw:my-3">
          <Accordion className="tw:ring-0 tw:divide-y-0 tw:rounded-lg">
            <AccordionItem id={`${idSchema.$id}-advanced`}>
              <AccordionHeader className="tw:py-3 tw:px-3 tw:text-md tw:font-medium tw:text-secondary tw:bg-utility-gray-blue-50">
                {title
                  ? `${title} ${t('label.advanced-config')}`
                  : t('label.advanced-config')}
              </AccordionHeader>
              <AccordionPanel className="tw:flex tw:flex-col tw:bg-utility-gray-blue-50 tw:gap-4 tw:border-t-0">
                {advancedProperties.map((element) => (
                  <div
                    className={getPropertyClassName(element.name)}
                    data-field-name={element.name}
                    key={element.name}>
                    {element.content}
                  </div>
                ))}
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </>
  );

  if (
    !isRoot &&
    !schema.additionalProperties &&
    normalProperties.length === 0 &&
    advancedProperties.length === 0
  ) {
    return null;
  }

  if (!isRoot && title) {
    return (
      <div
        className={classNames(
          'core-object-field-template core-object-field-template-non-root tw:flex tw:flex-col tw:gap-4 tw:rounded-xl tw:bg-utility-gray-blue-50',
          isSampleDataSection &&
            'core-object-field-template-sample-data-section',
          isSampleDataConfig && 'core-object-field-template-sample-data-config',
          isAwsS3StorageConfig && 'core-object-field-template-storage-config'
        )}
        data-additional-properties={
          schema.additionalProperties ? 'true' : undefined
        }
        data-field-id={idSchema.$id}>
        <div className="core-object-field-template-header tw:flex tw:items-start tw:justify-between tw:gap-3">
          <div
            className={classNames(
              'tw:flex tw:min-w-0',
              isAwsS3StorageConfig
                ? 'tw:flex-row tw:items-center tw:gap-2.5'
                : 'tw:flex-col tw:gap-0.5'
            )}>
            {isAwsS3StorageConfig && (
              <Hexagon01
                className="core-object-field-template-title-icon"
                data-testid="storage-config-title-icon"
                size={18}
              />
            )}
            <Typography
              as="label"
              className="core-object-field-template-title tw:text-primary"
              id={`${idSchema.$id}__title`}
              size="text-sm"
              weight="semibold">
              {title}
            </Typography>
            {description && (
              <Typography
                as="span"
                className="core-object-field-template-header-description tw:text-secondary"
                size="text-xs">
                {description}
              </Typography>
            )}
          </div>
        </div>
        {propertiesContent}
      </div>
    );
  }

  return (
    <Fragment>
      {title && isRoot && (
        <div className="tw:flex tw:items-center tw:justify-between tw:mt-2">
          <Typography
            as="label"
            className="core-object-field-template-title tw:text-primary"
            id={`${idSchema.$id}__title`}
            size="text-sm"
            weight="medium">
            {title}
          </Typography>
          {addButton}
        </div>
      )}
      {propertiesContent}
    </Fragment>
  );
};
