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
import { compare, Operation } from 'fast-json-patch';
import { CreateTestDefinition } from '../../../generated/api/tests/createTestDefinition';
import {
  EntityType,
  TestDefinition,
  TestPlatform,
} from '../../../generated/tests/testDefinition';
import { TestDefinitionFormValues } from './TestDefinitionForm.interface';

export const buildFormDefaults = (
  initialValues?: TestDefinition
): TestDefinitionFormValues => ({
  ...(initialValues as TestDefinitionFormValues),
  testPlatforms: initialValues?.testPlatforms ?? [TestPlatform.OpenMetadata],
  supportedServices: initialValues?.supportedServices ?? [],
});

const getValidatorClass = (
  values: TestDefinitionFormValues
): string | undefined => {
  if (!values.sqlExpression) {
    return undefined;
  }

  return values.entityType === EntityType.Column
    ? 'ColumnRuleLibrarySqlExpressionValidator'
    : 'TableRuleLibrarySqlExpressionValidator';
};

export const buildCreateTestDefinitionPayload = (
  values: TestDefinitionFormValues
): CreateTestDefinition => ({
  name: values.name ?? '',
  displayName: values.displayName,
  description: values.description,
  sqlExpression: values.sqlExpression,
  entityType: values.entityType ?? EntityType.Table,
  testPlatforms: values.testPlatforms ?? [],
  dataQualityDimension: values.dataQualityDimension,
  supportedDataTypes: values.supportedDataTypes,
  supportedServices: values.supportedServices,
  parameterDefinition: values.parameterDefinition,
  validatorClass: getValidatorClass(values),
});

export const buildEditPatch = (
  initialValues: TestDefinition,
  values: TestDefinitionFormValues
): Operation[] => {
  const definedValues = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  );

  return compare(initialValues, { ...initialValues, ...definedValues });
};
