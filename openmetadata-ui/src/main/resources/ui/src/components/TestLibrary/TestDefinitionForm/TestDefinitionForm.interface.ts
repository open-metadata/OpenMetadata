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
import { FormSelectItem } from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { TestDefinition } from '../../../generated/tests/testDefinition';

export interface ParameterDefinitionValue {
  name?: string;
  displayName?: string;
  description?: string;
  dataType?: FormSelectItem;
  required?: boolean;
}

/**
 * Form state as react-hook-form actually holds it: the `getField` SELECT /
 * MULTI_SELECT / AUTOCOMPLETE renderers store the selected option(s) as
 * `FormSelectItem` object(s) (`{ id, label }`), not raw strings/enums — see
 * `render-field-element.tsx`. The values→payload transform
 * (`transformTestDefinitionFormData.ts`) unwraps these back to raw strings for
 * the API; the payload types (`CreateTestDefinition`) stay raw.
 */
export interface TestDefinitionFormValues {
  name?: string;
  displayName?: string;
  description?: string;
  sqlExpression?: string;
  entityType?: FormSelectItem;
  testPlatforms?: FormSelectItem[];
  dataQualityDimension?: FormSelectItem;
  supportedServices?: FormSelectItem[];
  supportedDataTypes?: FormSelectItem[];
  parameterDefinition?: ParameterDefinitionValue[];
  enabled?: boolean;
}

export interface TestDefinitionFormProps {
  open: boolean;
  variant?: 'drawer' | 'modal';
  initialValues?: TestDefinition;
  onSuccess: (data?: TestDefinition) => void;
  onCancel: () => void;
  title?: ReactNode;
}

export interface TestDefinitionFormBodyProps {
  form: UseFormReturn<TestDefinitionFormValues>;
  isEditMode: boolean;
  isReadOnlyField: boolean;
  errorMessage?: string;
  onErrorDismiss?: () => void;
  onActiveFieldChange?: (fieldId: string) => void;
}
