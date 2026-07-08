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
import { compare, Operation } from 'fast-json-patch';
import { CreateTestDefinition } from '../../../generated/api/tests/createTestDefinition';
import {
  DataType,
  EntityType,
  TestDataType,
  TestDefinition,
  TestPlatform,
} from '../../../generated/tests/testDefinition';
import {
  ParameterDefinitionValue,
  TestDefinitionFormValues,
} from './TestDefinitionForm.interface';

/**
 * The `getField` SELECT / MULTI_SELECT / AUTOCOMPLETE renderers store their
 * selected option(s) as `FormSelectItem` objects (`{ id, label }`), not raw
 * strings — see `render-field-element.tsx`. These helpers bridge between that
 * RHF state shape and the raw-string API payload, defensively accepting either
 * an object or an already-raw value so callers (and existing tests) that pass
 * raw strings keep working.
 */
const toSelectItem = (value?: unknown): FormSelectItem | undefined =>
  value == null ? undefined : { id: String(value), label: String(value) };

const toSelectItems = (values?: unknown[]): FormSelectItem[] | undefined =>
  values?.map((value) => ({ id: String(value), label: String(value) }));

const fromSelectItem = (value?: unknown): string | undefined => {
  let result: string | undefined;
  if (value != null && typeof value === 'object') {
    result = (value as FormSelectItem).id;
  } else if (value != null) {
    result = String(value);
  }

  return result;
};

const fromSelectItems = (values?: unknown[]): string[] | undefined =>
  values
    ?.map((value) => fromSelectItem(value))
    .filter((value): value is string => Boolean(value));

const unwrapParameterDefinition = (
  parameters?: ParameterDefinitionValue[]
): TestDefinition['parameterDefinition'] =>
  parameters?.map((parameter) => ({
    ...parameter,
    dataType: fromSelectItem(parameter.dataType) as TestDataType | undefined,
  }));

export const buildFormDefaults = (
  initialValues?: TestDefinition
): TestDefinitionFormValues => ({
  name: initialValues?.name,
  displayName: initialValues?.displayName,
  description: initialValues?.description,
  sqlExpression: initialValues?.sqlExpression,
  entityType: toSelectItem(initialValues?.entityType),
  testPlatforms:
    toSelectItems(initialValues?.testPlatforms) ??
    ([
      { id: TestPlatform.OpenMetadata, label: TestPlatform.OpenMetadata },
    ] as FormSelectItem[]),
  dataQualityDimension: toSelectItem(initialValues?.dataQualityDimension),
  supportedServices: toSelectItems(initialValues?.supportedServices) ?? [],
  supportedDataTypes: toSelectItems(initialValues?.supportedDataTypes),
  parameterDefinition: initialValues?.parameterDefinition?.map((parameter) => ({
    ...parameter,
    dataType: toSelectItem(parameter.dataType),
  })),
  enabled: initialValues?.enabled,
});

const getValidatorClass = (
  entityType: EntityType,
  sqlExpression?: string
): string | undefined => {
  let result: string | undefined;
  if (sqlExpression) {
    result =
      entityType === EntityType.Column
        ? 'ColumnRuleLibrarySqlExpressionValidator'
        : 'TableRuleLibrarySqlExpressionValidator';
  }

  return result;
};

export const buildCreateTestDefinitionPayload = (
  values: TestDefinitionFormValues
): CreateTestDefinition => {
  const entityType =
    (fromSelectItem(values.entityType) as EntityType | undefined) ??
    EntityType.Table;

  return {
    name: values.name ?? '',
    displayName: values.displayName,
    description: values.description,
    sqlExpression: values.sqlExpression,
    entityType,
    testPlatforms:
      (fromSelectItems(values.testPlatforms) as TestPlatform[]) ?? [],
    dataQualityDimension: values.dataQualityDimension
      ? (fromSelectItem(
          values.dataQualityDimension
        ) as CreateTestDefinition['dataQualityDimension'])
      : undefined,
    supportedDataTypes: fromSelectItems(values.supportedDataTypes) as
      | DataType[]
      | undefined,
    supportedServices: fromSelectItems(values.supportedServices),
    parameterDefinition: unwrapParameterDefinition(values.parameterDefinition),
    validatorClass: getValidatorClass(entityType, values.sqlExpression),
  };
};

export const buildEditPatch = (
  initialValues: TestDefinition,
  values: TestDefinitionFormValues
): Operation[] => {
  const normalizedRaw: Record<string, unknown> = {
    name: values.name,
    displayName: values.displayName,
    description: values.description,
    sqlExpression: values.sqlExpression,
    entityType: fromSelectItem(values.entityType),
    testPlatforms: fromSelectItems(values.testPlatforms),
    dataQualityDimension: fromSelectItem(values.dataQualityDimension),
    supportedServices: fromSelectItems(values.supportedServices),
    supportedDataTypes: fromSelectItems(values.supportedDataTypes),
    parameterDefinition: unwrapParameterDefinition(values.parameterDefinition),
    enabled: values.enabled,
  };

  const definedRaw = Object.fromEntries(
    Object.entries(normalizedRaw).filter(([, value]) => value !== undefined)
  );

  return compare(initialValues, { ...initialValues, ...definedRaw });
};
