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
import { ReactNode } from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  DataQualityDimensions,
  DataType,
  EntityType,
  TestDataType,
  TestDefinition,
  TestPlatform,
} from '../../../generated/tests/testDefinition';

export interface ParameterDefinitionValue {
  name?: string;
  displayName?: string;
  description?: string;
  dataType?: TestDataType;
  required?: boolean;
}

export interface TestDefinitionFormValues {
  name?: string;
  displayName?: string;
  description?: string;
  sqlExpression?: string;
  entityType?: EntityType;
  testPlatforms?: TestPlatform[];
  dataQualityDimension?: DataQualityDimensions;
  supportedServices?: string[];
  supportedDataTypes?: DataType[];
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
