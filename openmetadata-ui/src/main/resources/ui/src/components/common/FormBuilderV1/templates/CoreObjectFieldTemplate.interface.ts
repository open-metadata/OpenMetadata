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
import { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type TFunctionType = ReturnType<typeof useTranslation>['t'];

export type DisableableFieldElement = ReactElement<{ disabled?: boolean }>;
export type SchemaPropertyLayout = {
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

export interface PropertyItemProps {
  element: ObjectFieldTemplateProps['properties'][number];
  isIamAuthEnabled: boolean;
  isGatedCredentialConfig: boolean;
  schema: ObjectFieldTemplateProps['schema'];
  uiSchema: ObjectFieldTemplateProps['uiSchema'];
  flatPropertyLayout: boolean;
  isRoot: boolean;
}

export interface AdvancedPropertiesSectionProps {
  orderedAdvancedProperties: ObjectFieldTemplateProps['properties'];
  isCredentialAdvancedDisclosure: boolean;
  isGatedCredentialConfig: boolean;
  isImpersonationOnlyDisclosure: boolean;
  isGenericNestedConfig: boolean;
  title: string | undefined;
  idSchema: ObjectFieldTemplateProps['idSchema'];
  isIamAuthEnabled: boolean;
  schema: ObjectFieldTemplateProps['schema'];
  uiSchema: ObjectFieldTemplateProps['uiSchema'];
  flatPropertyLayout: boolean;
  isRoot: boolean;
}

export interface PropertiesContentProps {
  isRoot: boolean;
  schema: ObjectFieldTemplateProps['schema'];
  bodyClassName: string;
  addButton: ReactNode;
  isGatedCredentialConfig: boolean;
  gatedCredentialToggleProperties: ObjectFieldTemplateProps['properties'];
  gatedCredentialFieldProperties: ObjectFieldTemplateProps['properties'];
  orderedNormalProperties: ObjectFieldTemplateProps['properties'];
  normalProperties: ObjectFieldTemplateProps['properties'];
  flatPropertyLayout: boolean;
  isIamAuthEnabled: boolean;
  uiSchema: ObjectFieldTemplateProps['uiSchema'];
  advancedPropertiesContent: ReactNode;
  t: TFunctionType;
}

export interface NonRootTitledViewProps {
  flatPropertyLayout: boolean;
  isSampleDataSection: boolean;
  isSampleDataConfig: boolean;
  isAwsS3StorageConfig: boolean;
  isGatedCredentialConfig: boolean;
  isGenericNestedConfig: boolean;
  schema: ObjectFieldTemplateProps['schema'];
  idSchema: ObjectFieldTemplateProps['idSchema'];
  title: string | undefined;
  shouldShowDescription: boolean;
  description: string | undefined;
  propertiesContent: ReactNode;
}
