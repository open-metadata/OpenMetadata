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
import { ReactElement } from 'react';

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
