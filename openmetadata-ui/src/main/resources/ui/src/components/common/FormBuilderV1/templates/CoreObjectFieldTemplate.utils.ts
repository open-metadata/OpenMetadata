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
import classNames from 'classnames';
import { GATED_CREDENTIAL_ADVANCED_PROPERTY_ORDER } from '../../../../constants/CoreObjectFieldTemplate.constants';
import { orderProperties } from '../../../../utils/CoreObjectFieldTemplateUtils';

export const getPropertyItemClassName = (
  elementName: string,
  flatPropertyLayout: boolean,
  isRoot: boolean,
  isFullWidth: boolean,
  isToggleBanner: boolean,
  isDisabled: boolean
): string =>
  classNames(
    'core-object-field-template-property tw:min-w-0',
    `core-object-field-template-property-${elementName}`,
    !flatPropertyLayout && 'tw:rounded-xl tw:bg-utility-gray-blue-50',
    !flatPropertyLayout && isRoot && 'tw:p-4',
    isFullWidth &&
      'core-object-field-template-property-full-width tw:[grid-column:1/-1] tw:justify-self-stretch tw:w-full',
    isToggleBanner && 'core-object-field-template-property-toggle-banner',
    isDisabled &&
      'core-object-field-template-property-disabled tw:opacity-[0.58]'
  );

export const getOrderedAdvancedPropertiesList = (
  advancedProperties: ObjectFieldTemplateProps['properties'],
  isGatedCredentialConfig: boolean
): ObjectFieldTemplateProps['properties'] =>
  isGatedCredentialConfig
    ? orderProperties(
        advancedProperties,
        GATED_CREDENTIAL_ADVANCED_PROPERTY_ORDER
      )
    : advancedProperties;

export const getGatedCredentialProperties = (
  orderedNormalProperties: ObjectFieldTemplateProps['properties'],
  isGatedCredentialConfig: boolean
): {
  toggleProperties: ObjectFieldTemplateProps['properties'];
  fieldProperties: ObjectFieldTemplateProps['properties'];
} => ({
  toggleProperties: isGatedCredentialConfig
    ? orderedNormalProperties.filter((property) => property.name === 'enabled')
    : [],
  fieldProperties: isGatedCredentialConfig
    ? orderedNormalProperties.filter((property) => property.name !== 'enabled')
    : [],
});

export const getIsImpersonationOnlyDisclosure = (
  isGenericNestedConfig: boolean,
  orderedAdvancedProperties: ObjectFieldTemplateProps['properties']
): boolean =>
  isGenericNestedConfig &&
  orderedAdvancedProperties.length === 1 &&
  orderedAdvancedProperties[0].name.toLowerCase().includes('impersonate');

export const getBodyClassName = (
  isGatedCredentialConfig: boolean,
  isNestedConfigGrid: boolean
): string => {
  if (isGatedCredentialConfig) {
    return 'core-object-field-template-body-gated';
  }
  if (isNestedConfigGrid) {
    return 'core-object-field-template-body-grid tw:grid tw:grid-flow-row-dense tw:[grid-template-columns:repeat(3,minmax(0,1fr))] tw:[gap:16px] tw:items-start tw:w-full tw:min-w-0';
  }

  return 'tw:flex tw:flex-col tw:gap-4';
};

export const shouldRenderNullTemplate = (
  isRoot: boolean,
  hasAdditionalProperties: boolean,
  normalPropertiesLength: number,
  advancedPropertiesLength: number
): boolean =>
  !isRoot &&
  !hasAdditionalProperties &&
  normalPropertiesLength === 0 &&
  advancedPropertiesLength === 0;

export const getNonRootPanelClassName = (
  flatPropertyLayout: boolean,
  isSampleDataSection: boolean,
  isSampleDataConfig: boolean,
  isAwsS3StorageConfig: boolean,
  isGatedCredentialConfig: boolean,
  isGenericNestedConfig: boolean
): string =>
  classNames(
    'core-object-field-template core-object-field-template-non-root tw:flex tw:flex-col tw:w-full tw:min-w-0',
    'tw:gap-4',
    !flatPropertyLayout && 'tw:rounded-xl tw:bg-utility-gray-blue-50',
    isSampleDataSection && 'core-object-field-template-sample-data-section',
    isSampleDataConfig &&
      'core-object-field-template-sample-data-config tw:mt-4 tw:box-border tw:w-full tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-4',
    isAwsS3StorageConfig &&
      'core-object-field-template-storage-config tw:mt-4 tw:gap-4 tw:box-border tw:w-full tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-4',
    isGatedCredentialConfig &&
      'core-object-field-template-gated-credential-block',
    isGenericNestedConfig && 'core-object-field-template-credential-block'
  );
