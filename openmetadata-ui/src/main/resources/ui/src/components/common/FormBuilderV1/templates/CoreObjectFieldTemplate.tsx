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
import { Fragment, FunctionComponent, ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STATIC_AWS_CREDENTIAL_PROPERTIES } from '../../../../constants/CoreObjectFieldTemplate.constants';
import {
  getAdvancedHeaderLabel,
  getFormSeperationConfig,
  getOrderedNormalProperties,
  getPropertyContent,
  partitionProperties,
  shouldSpanFullWidth,
} from '../../../../utils/CoreObjectFieldTemplateUtils';
import {
  AdvancedPropertiesSectionProps,
  NonRootTitledViewProps,
  PropertiesContentProps,
  PropertyItemProps,
  TFunctionType,
} from './CoreObjectFieldTemplate.interface';
import {
  getBodyClassName,
  getGatedCredentialProperties,
  getIsImpersonationOnlyDisclosure,
  getNonRootPanelClassName,
  getOrderedAdvancedPropertiesList,
  getPropertyItemClassName,
  shouldRenderNullTemplate,
} from './CoreObjectFieldTemplate.utils';

const PropertyItem: FunctionComponent<PropertyItemProps> = ({
  element,
  isIamAuthEnabled,
  isGatedCredentialConfig,
  schema,
  uiSchema,
  flatPropertyLayout,
  isRoot,
}) => {
  const isDisabled =
    isIamAuthEnabled && STATIC_AWS_CREDENTIAL_PROPERTIES.has(element.name);
  const isFullWidth = isGatedCredentialConfig
    ? element.name === 'enabled'
    : shouldSpanFullWidth({
        name: element.name,
        schema,
        uiSchema,
      });
  const isToggleBanner = isGatedCredentialConfig && element.name === 'enabled';

  return (
    <div
      aria-disabled={isDisabled || undefined}
      className={getPropertyItemClassName(
        element.name,
        flatPropertyLayout,
        isRoot,
        isFullWidth,
        isToggleBanner,
        isDisabled
      )}
      data-field-name={element.name}
      key={element.name}>
      {getPropertyContent(element, isIamAuthEnabled)}
    </div>
  );
};

const AdvancedPropertiesSection: FunctionComponent<
  AdvancedPropertiesSectionProps
> = ({
  orderedAdvancedProperties,
  isCredentialAdvancedDisclosure,
  isGatedCredentialConfig,
  isImpersonationOnlyDisclosure,
  isGenericNestedConfig,
  title,
  idSchema,
  isIamAuthEnabled,
  schema,
  uiSchema,
  flatPropertyLayout,
  isRoot,
}) => {
  const { t } = useTranslation();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  if (orderedAdvancedProperties.length === 0) {
    return null;
  }

  const label = getAdvancedHeaderLabel(
    advancedOpen,
    isGatedCredentialConfig,
    isImpersonationOnlyDisclosure,
    isGenericNestedConfig,
    orderedAdvancedProperties.length,
    title,
    t
  );

  const closedLabel = getAdvancedHeaderLabel(
    false,
    isGatedCredentialConfig,
    isImpersonationOnlyDisclosure,
    isGenericNestedConfig,
    orderedAdvancedProperties.length,
    title,
    t
  );

  return (
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
            {label}
          </Button>
          {advancedOpen && (
            <div
              className={classNames(
                'core-object-field-template-advanced-grid tw:mt-4 tw:grid tw:grid-flow-row-dense',
                'tw:[grid-template-columns:repeat(3,minmax(0,1fr))] tw:[gap:16px] tw:items-start tw:w-full tw:min-w-0'
              )}>
              {orderedAdvancedProperties.map((element) => (
                <PropertyItem
                  element={element}
                  flatPropertyLayout={flatPropertyLayout}
                  isGatedCredentialConfig={isGatedCredentialConfig}
                  isIamAuthEnabled={isIamAuthEnabled}
                  isRoot={isRoot}
                  key={element.name}
                  schema={schema}
                  uiSchema={uiSchema}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="tw:my-3">
          <Accordion className="tw:outline-0 tw:divide-y-0 tw:rounded-lg">
            <AccordionItem id={`${idSchema.$id}-advanced`}>
              <AccordionHeader className="tw:py-3 tw:px-3 tw:text-md tw:font-medium tw:text-secondary tw:bg-utility-gray-blue-50">
                {closedLabel}
              </AccordionHeader>
              <AccordionPanel className="tw:bg-utility-gray-blue-50 tw:border-t-0 tw:flex tw:flex-col tw:gap-4">
                {orderedAdvancedProperties.map((element) => (
                  <PropertyItem
                    element={element}
                    flatPropertyLayout={flatPropertyLayout}
                    isGatedCredentialConfig={isGatedCredentialConfig}
                    isIamAuthEnabled={isIamAuthEnabled}
                    isRoot={isRoot}
                    key={element.name}
                    schema={schema}
                    uiSchema={uiSchema}
                  />
                ))}
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </>
  );
};

const getAddButton = (
  schema: ObjectFieldTemplateProps['schema'],
  addEntityLabel: string,
  idSchema: ObjectFieldTemplateProps['idSchema'],
  onAddClick: ObjectFieldTemplateProps['onAddClick'],
  t: TFunctionType
): ReactNode => {
  if (!schema.additionalProperties) {
    return null;
  }

  return (
    <Button
      aria-label={t('label.add-entity', { entity: addEntityLabel })}
      className="core-object-field-template-add-button tw:inline-flex tw:size-7 tw:items-center tw:justify-center tw:rounded-md tw:p-0 tw:leading-none"
      color="primary"
      data-testid={`add-item-${addEntityLabel}`}
      id={`${idSchema.$id}`}
      size="sm"
      onClick={() => onAddClick(schema)()}>
      <Plus data-icon size={14} />
    </Button>
  );
};

const PropertiesContent: FunctionComponent<PropertiesContentProps> = ({
  isRoot,
  schema,
  bodyClassName,
  addButton,
  isGatedCredentialConfig,
  gatedCredentialToggleProperties,
  gatedCredentialFieldProperties,
  orderedNormalProperties,
  normalProperties,
  flatPropertyLayout,
  isIamAuthEnabled,
  uiSchema,
  advancedPropertiesContent,
  t,
}) => (
  <>
    <div
      className={classNames('core-object-field-template-body', bodyClassName)}>
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
          {gatedCredentialToggleProperties.map((element) => (
            <PropertyItem
              element={element}
              flatPropertyLayout={flatPropertyLayout}
              isGatedCredentialConfig={isGatedCredentialConfig}
              isIamAuthEnabled={isIamAuthEnabled}
              isRoot={isRoot}
              key={element.name}
              schema={schema}
              uiSchema={uiSchema}
            />
          ))}
          {gatedCredentialFieldProperties.length > 0 && (
            <div
              className={classNames(
                'core-object-field-template-credential-field-grid tw:grid tw:grid-flow-row-dense tw:mt-4',
                'tw:[grid-template-columns:repeat(3,minmax(0,1fr))] tw:[gap:16px] tw:items-start tw:w-full tw:min-w-0'
              )}>
              {gatedCredentialFieldProperties.map((element) => (
                <PropertyItem
                  element={element}
                  flatPropertyLayout={flatPropertyLayout}
                  isGatedCredentialConfig={isGatedCredentialConfig}
                  isIamAuthEnabled={isIamAuthEnabled}
                  isRoot={isRoot}
                  key={element.name}
                  schema={schema}
                  uiSchema={uiSchema}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        orderedNormalProperties.map((element) => (
          <PropertyItem
            element={element}
            flatPropertyLayout={flatPropertyLayout}
            isGatedCredentialConfig={isGatedCredentialConfig}
            isIamAuthEnabled={isIamAuthEnabled}
            isRoot={isRoot}
            key={element.name}
            schema={schema}
            uiSchema={uiSchema}
          />
        ))
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

const NonRootTitledView: FunctionComponent<NonRootTitledViewProps> = ({
  flatPropertyLayout,
  isSampleDataSection,
  isSampleDataConfig,
  isAwsS3StorageConfig,
  isGatedCredentialConfig,
  isGenericNestedConfig,
  schema,
  idSchema,
  title,
  shouldShowDescription,
  description,
  propertiesContent,
}) => (
  <div
    className={getNonRootPanelClassName(
      flatPropertyLayout,
      isSampleDataSection,
      isSampleDataConfig,
      isAwsS3StorageConfig,
      isGatedCredentialConfig,
      isGenericNestedConfig
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
            size={16}
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
  const {
    flatPropertyLayout,
    isRoot,
    isSampleDataSection,
    isSampleDataConfig,
    isAwsS3StorageConfig,
    isGatedCredentialConfig,
    isGenericNestedConfig,
    isNestedConfigGrid,
    isCredentialAdvancedDisclosure,
    isIamAuthEnabled,
    addEntityLabel,
    shouldShowDescription,
  } = getFormSeperationConfig({
    formContext,
    idSchema,
    properties,
    title,
    schema,
    description,
    formData,
  });

  const addButton = getAddButton(
    schema,
    addEntityLabel,
    idSchema,
    onAddClick,
    t
  );

  const { normalProperties, advancedProperties } = partitionProperties(
    properties,
    schema,
    isRoot,
    isGatedCredentialConfig
  );

  const orderedNormalProperties = getOrderedNormalProperties(
    normalProperties,
    isSampleDataConfig,
    isAwsS3StorageConfig,
    isGatedCredentialConfig,
    isGenericNestedConfig
  );

  const orderedAdvancedProperties = getOrderedAdvancedPropertiesList(
    advancedProperties,
    isGatedCredentialConfig
  );

  const {
    toggleProperties: gatedCredentialToggleProperties,
    fieldProperties: gatedCredentialFieldProperties,
  } = getGatedCredentialProperties(
    orderedNormalProperties,
    isGatedCredentialConfig
  );

  const isImpersonationOnlyDisclosure = getIsImpersonationOnlyDisclosure(
    isGenericNestedConfig,
    orderedAdvancedProperties
  );

  const bodyClassName = getBodyClassName(
    isGatedCredentialConfig,
    isNestedConfigGrid
  );

  const advancedPropertiesContent = (
    <AdvancedPropertiesSection
      flatPropertyLayout={flatPropertyLayout}
      idSchema={idSchema}
      isCredentialAdvancedDisclosure={isCredentialAdvancedDisclosure}
      isGatedCredentialConfig={isGatedCredentialConfig}
      isGenericNestedConfig={isGenericNestedConfig}
      isIamAuthEnabled={isIamAuthEnabled}
      isImpersonationOnlyDisclosure={isImpersonationOnlyDisclosure}
      isRoot={isRoot}
      orderedAdvancedProperties={orderedAdvancedProperties}
      schema={schema}
      title={title}
      uiSchema={uiSchema}
    />
  );

  const propertiesContent = (
    <PropertiesContent
      addButton={addButton}
      advancedPropertiesContent={advancedPropertiesContent}
      bodyClassName={bodyClassName}
      flatPropertyLayout={flatPropertyLayout}
      gatedCredentialFieldProperties={gatedCredentialFieldProperties}
      gatedCredentialToggleProperties={gatedCredentialToggleProperties}
      isGatedCredentialConfig={isGatedCredentialConfig}
      isIamAuthEnabled={isIamAuthEnabled}
      isRoot={isRoot}
      normalProperties={normalProperties}
      orderedNormalProperties={orderedNormalProperties}
      schema={schema}
      t={t}
      uiSchema={uiSchema}
    />
  );

  if (
    shouldRenderNullTemplate(
      isRoot,
      Boolean(schema.additionalProperties),
      normalProperties.length,
      advancedProperties.length
    )
  ) {
    return null;
  }

  if (!isRoot && title) {
    return (
      <NonRootTitledView
        description={description}
        flatPropertyLayout={flatPropertyLayout}
        idSchema={idSchema}
        isAwsS3StorageConfig={isAwsS3StorageConfig}
        isGatedCredentialConfig={isGatedCredentialConfig}
        isGenericNestedConfig={isGenericNestedConfig}
        isSampleDataConfig={isSampleDataConfig}
        isSampleDataSection={isSampleDataSection}
        propertiesContent={propertiesContent}
        schema={schema}
        shouldShowDescription={shouldShowDescription}
        title={title}
      />
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
            weight="semibold">
            {title}
          </Typography>
          {addButton}
        </div>
      )}
      {propertiesContent}
    </Fragment>
  );
};
