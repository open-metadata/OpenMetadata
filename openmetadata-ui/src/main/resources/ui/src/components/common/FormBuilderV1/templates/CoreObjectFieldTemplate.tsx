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
import { ChevronDown, Hexagon01, Plus } from '@untitledui/icons';
import classNames from 'classnames';
import {
  cloneElement,
  Fragment,
  FunctionComponent,
  isValidElement,
  ReactElement,
  useState,
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
const GATED_CREDENTIAL_PROPERTY_ORDER = [
  'enabled',
  'awsAccessKeyId',
  'awsSecretAccessKey',
  'awsRegion',
];
const GATED_CREDENTIAL_ADVANCED_PROPERTY_ORDER = [
  'awsSessionToken',
  'endPointURL',
  'profileName',
  'assumeRoleArn',
  'assumeRoleSessionName',
  'assumeRoleSourceIdentity',
];
const CREDENTIAL_VALUE_PROPERTY_ORDER = [
  'projectId',
  'privateKeyId',
  'clientEmail',
  'privateKey',
  'clientId',
];
const GATED_CREDENTIAL_VISIBLE_PROPERTIES = new Set(
  GATED_CREDENTIAL_PROPERTY_ORDER
);
const STATIC_AWS_CREDENTIAL_PROPERTIES = new Set([
  'awsAccessKeyId',
  'awsSecretAccessKey',
  'awsSessionToken',
]);
const DEFAULT_ADVANCED_PROPERTY_NAMES = new Set([
  'authProviderX509CertUrl',
  'authUri',
  'clientX509CertUrl',
  'lifetime',
  'tokenUri',
]);

type DisableableFieldElement = ReactElement<{ disabled?: boolean }>;
type SchemaPropertyLayout = {
  anyOf?: unknown[];
  const?: unknown;
  default?: unknown;
  description?: string;
  format?: string;
  oneOf?: unknown[];
  properties?: Record<string, unknown>;
  title?: string;
  type?: string | string[];
};

const FULL_WIDTH_FIELD_PATTERN =
  /(url|uri|arn|path|pattern|connectionstring|jdbc|dsn|bundle|certificate|cert|pem)/i;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getSchemaProperty = (
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

const getUiSchemaProperty = (
  uiSchema: ObjectFieldTemplateProps['uiSchema'],
  name: string
): Record<string, unknown> | undefined => {
  if (!isPlainObject(uiSchema)) {
    return undefined;
  }

  const property = uiSchema[name];

  return isPlainObject(property) ? property : undefined;
};

const hasSchemaType = (
  schemaProperty: SchemaPropertyLayout | undefined,
  type: string
) => {
  if (Array.isArray(schemaProperty?.type)) {
    return schemaProperty.type.includes(type);
  }

  return schemaProperty?.type === type;
};

const isRequiredSchemaProperty = (
  schema: ObjectFieldTemplateProps['schema'],
  name: string
) => (schema.required as string[] | undefined)?.includes(name) ?? false;

const hasLongValueSignal = (
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

const shouldSpanFullWidth = ({
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
  formContext,
  onAddClick,
  schema,
  properties,
  idSchema,
  uiSchema,
}) => {
  const { t } = useTranslation();
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
  const isStaticCredentialDisabled = (name: string) =>
    isIamAuthEnabled && STATIC_AWS_CREDENTIAL_PROPERTIES.has(name);
  const getPropertyClassName = (
    name: string,
    disabled?: boolean,
    fullWidth?: boolean,
    toggleBanner?: boolean
  ) =>
    classNames(
      'core-object-field-template-property tw:min-w-0',
      `core-object-field-template-property-${name}`,
      !flatPropertyLayout && 'tw:rounded-xl tw:bg-utility-gray-blue-50',
      !flatPropertyLayout && isRoot && 'tw:p-4',
      fullWidth &&
        'core-object-field-template-property-full-width tw:[grid-column:1/-1] tw:justify-self-stretch tw:w-full',
      toggleBanner && 'core-object-field-template-property-toggle-banner',
      disabled &&
        'core-object-field-template-property-disabled tw:opacity-[0.58]'
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
      className="core-object-field-template-add-button tw:inline-flex tw:size-7 tw:items-center tw:justify-center tw:rounded-[6px] tw:p-0 tw:leading-none"
      color="primary"
      data-testid={`add-item-${addEntityLabel}`}
      id={`${idSchema.$id}`}
      size="sm"
      onClick={() => onAddClick(schema)()}>
      <Plus data-icon size={14} />
    </Button>
  ) : null;

  const isGatedCredentialAdvancedProperty = (name: string) =>
    isGatedCredentialConfig &&
    !GATED_CREDENTIAL_VISIBLE_PROPERTIES.has(name) &&
    !isRequiredSchemaProperty(schema, name);
  const isDefaultAdvancedProperty = (name: string) => {
    const schemaProperty = getSchemaProperty(schema, name);

    return (
      !isRoot &&
      !isRequiredSchemaProperty(schema, name) &&
      (DEFAULT_ADVANCED_PROPERTY_NAMES.has(name) ||
        (name.toLowerCase().includes('impersonate') &&
          hasSchemaType(schemaProperty, 'object')) ||
        (name === 'type' &&
          (schemaProperty?.const !== undefined ||
            schemaProperty?.default !== undefined)))
    );
  };
  const { normalProperties, advancedProperties } = properties.reduce(
    (acc, prop) => {
      if (prop.hidden) {
        return acc;
      }
      if (
        ADVANCED_PROPERTIES.has(prop.name) ||
        isGatedCredentialAdvancedProperty(prop.name) ||
        isDefaultAdvancedProperty(prop.name)
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
  const orderedNormalProperties = (() => {
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
  })();
  const orderedAdvancedProperties = isGatedCredentialConfig
    ? orderProperties(
        advancedProperties,
        GATED_CREDENTIAL_ADVANCED_PROPERTY_ORDER
      )
    : advancedProperties;
  const gatedCredentialToggleProperties = isGatedCredentialConfig
    ? orderedNormalProperties.filter((property) => property.name === 'enabled')
    : [];
  const gatedCredentialFieldProperties = isGatedCredentialConfig
    ? orderedNormalProperties.filter((property) => property.name !== 'enabled')
    : [];
  const getIsFullWidthProperty = (name: string) =>
    isGatedCredentialConfig
      ? name === 'enabled'
      : shouldSpanFullWidth({
          name,
          schema,
          uiSchema,
        });
  const getIsToggleBannerProperty = (name: string) =>
    isGatedCredentialConfig && name === 'enabled';
  const isImpersonationOnlyDisclosure =
    isGenericNestedConfig &&
    orderedAdvancedProperties.length === 1 &&
    orderedAdvancedProperties[0].name.toLowerCase().includes('impersonate');
  const getAdvancedHeaderLabel = (isOpen: boolean) => {
    if (isGatedCredentialConfig) {
      return `${t(isOpen ? 'label.hide' : 'label.show')} ${t(
        'label.advanced-config'
      )} (${orderedAdvancedProperties.length})`;
    }

    if (isImpersonationOnlyDisclosure) {
      return t(
        isOpen
          ? 'label.hide-impersonation-settings'
          : 'label.show-impersonation-settings',
        {
          count: orderedAdvancedProperties.length,
        }
      );
    }

    if (isGenericNestedConfig) {
      return t(
        isOpen
          ? 'label.hide-advanced-credential-settings'
          : 'label.show-advanced-credential-settings',
        {
          count: orderedAdvancedProperties.length,
        }
      );
    }

    return title
      ? `${title} ${t('label.advanced-config')}`
      : t('label.advanced-config');
  };
  const renderProperty = (element: (typeof properties)[number]) => {
    const isDisabled = isStaticCredentialDisabled(element.name);
    const isFullWidth = getIsFullWidthProperty(element.name);
    const isToggleBanner = getIsToggleBannerProperty(element.name);

    return (
      <div
        aria-disabled={isDisabled || undefined}
        className={getPropertyClassName(
          element.name,
          isDisabled,
          isFullWidth,
          isToggleBanner
        )}
        data-field-name={element.name}
        key={element.name}>
        {getPropertyContent(element)}
      </div>
    );
  };
  const advancedPropertiesContent = orderedAdvancedProperties.length > 0 && (
    <>
      {isCredentialAdvancedDisclosure ? (
        <div className="tw:mt-0">
          <Button
            aria-expanded={advancedOpen}
            className="tw:flex tw:items-center tw:gap-1"
            color="link-color"
            iconLeading={
              <ChevronDown
                className={classNames(
                  'tw:transition-transform',
                  !advancedOpen && 'tw:-rotate-90'
                )}
                size={16}
              />
            }
            onClick={() => setAdvancedOpen((value) => !value)}>
            {getAdvancedHeaderLabel(advancedOpen)}
          </Button>
          {advancedOpen && (
            <div
              className={classNames(
                'core-object-field-template-advanced-grid tw:mt-4 tw:grid tw:grid-flow-row-dense',
                'tw:[grid-template-columns:repeat(2,minmax(0,1fr))] tw:[gap:16px] tw:items-start tw:w-full tw:min-w-0'
              )}>
              {orderedAdvancedProperties.map(renderProperty)}
            </div>
          )}
        </div>
      ) : (
        <div className="tw:my-3">
          <Accordion className="tw:ring-0 tw:divide-y-0 tw:rounded-lg">
            <AccordionItem id={`${idSchema.$id}-advanced`}>
              <AccordionHeader className="tw:py-3 tw:px-3 tw:text-md tw:font-medium tw:text-secondary tw:bg-utility-gray-blue-50">
                {getAdvancedHeaderLabel(false)}
              </AccordionHeader>
              <AccordionPanel className="tw:bg-utility-gray-blue-50 tw:border-t-0 tw:flex tw:flex-col tw:gap-4">
                {orderedAdvancedProperties.map(renderProperty)}
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </>
  );

  const propertiesContent = (
    <>
      <div
        className={classNames(
          'core-object-field-template-body',
          isGatedCredentialConfig
            ? 'core-object-field-template-body-gated'
            : isNestedConfigGrid
            ? 'core-object-field-template-body-grid tw:grid tw:grid-flow-row-dense tw:[grid-template-columns:repeat(2,minmax(0,1fr))] tw:[gap:16px] tw:items-start tw:w-full tw:min-w-0'
            : 'tw:flex tw:flex-col tw:gap-4'
        )}>
        {!isRoot && schema.additionalProperties && (
          <div className="core-object-field-template-additional-header tw:flex tw:min-h-6 tw:items-center tw:justify-between tw:gap-4">
            <Typography
              as="label"
              className="core-object-field-template-additional-label tw:text-sm tw:font-medium tw:text-secondary"
              size="text-xs"
              weight="medium">
              {t('label.additional-property-plural')}
            </Typography>
            {addButton}
          </div>
        )}
        {isGatedCredentialConfig ? (
          <>
            {gatedCredentialToggleProperties.map(renderProperty)}
            {gatedCredentialFieldProperties.length > 0 && (
              <div
                className={classNames(
                  'core-object-field-template-credential-field-grid tw:grid tw:grid-flow-row-dense tw:mt-4',
                  'tw:[grid-template-columns:repeat(2,minmax(0,1fr))] tw:[gap:16px] tw:items-start tw:w-full tw:min-w-0'
                )}>
                {gatedCredentialFieldProperties.map(renderProperty)}
              </div>
            )}
          </>
        ) : (
          orderedNormalProperties.map(renderProperty)
        )}
        {!isRoot &&
          schema.additionalProperties &&
          normalProperties.length === 0 && (
            <Typography
              as="span"
              className="core-object-field-template-empty tw:leading-5 tw:text-tertiary"
              size="text-xs">
              {t('message.no-properties-added')}
            </Typography>
          )}
      </div>

      {advancedPropertiesContent}
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
          'core-object-field-template core-object-field-template-non-root tw:flex tw:flex-col tw:w-full tw:min-w-0',
          'tw:gap-4',
          !flatPropertyLayout && 'tw:rounded-xl tw:bg-utility-gray-blue-50',
          isSampleDataSection &&
            'core-object-field-template-sample-data-section',
          isSampleDataConfig &&
            'core-object-field-template-sample-data-config tw:mt-[18px] tw:box-border tw:w-full tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-[18px]',
          isAwsS3StorageConfig &&
            'core-object-field-template-storage-config tw:mt-4 tw:gap-4 tw:box-border tw:w-full tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-[18px]',
          isGatedCredentialConfig &&
            'core-object-field-template-gated-credential-block',
          isGenericNestedConfig && 'core-object-field-template-credential-block'
        )}
        data-additional-properties={
          schema.additionalProperties ? 'true' : undefined
        }
        data-field-id={idSchema.$id}>
        <div
          className={classNames(
            'core-object-field-template-header tw:flex tw:items-start tw:justify-between tw:gap-4',
            isSampleDataConfig && 'tw:hidden'
          )}>
          <div
            className={classNames(
              'tw:flex tw:min-w-0',
              isAwsS3StorageConfig
                ? 'tw:flex-row tw:items-center tw:gap-2.5'
                : 'tw:flex-col tw:gap-0.5'
            )}>
            {isAwsS3StorageConfig && (
              <Hexagon01
                className="core-object-field-template-title-icon tw:shrink-0 tw:text-brand-secondary tw:[stroke-width:2]"
                data-testid="storage-config-title-icon"
                size={18}
              />
            )}
            <Typography
              as="label"
              className="core-object-field-template-title tw:text-primary"
              id={`${idSchema.$id}__title`}
              size="text-sm"
              weight="medium">
              {title}
            </Typography>
            {shouldShowDescription && (
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
