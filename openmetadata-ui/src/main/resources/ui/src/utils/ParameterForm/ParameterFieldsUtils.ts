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
  TestCaseParameterDefinition,
  TestDataType,
  TestDefinition,
} from '../../generated/tests/testDefinition';

const PARAM_NAME_SENTINEL = '___';

export const sanitizeParamName = (name: string): string =>
  name.split('.').join(PARAM_NAME_SENTINEL);

export const restoreParamName = (sanitized: string): string =>
  sanitized.split(PARAM_NAME_SENTINEL).join('.');

const COLUMN_PARAM_NAME = 'column';
const PARTITION_COLUMN_PARAM_NAME = 'columnName';
const PARTITION_TEST_DEFINITION_NAME = 'tableRowInsertedCountToBeBetween';

/**
 * True when `data` renders as a single `FieldTypes.SELECT` field in
 * `ParameterFields.getFieldProp`/`getStringFieldProp` (tableDiff's own
 * fields are handled separately by `TableDiffFields` and are out of scope
 * here). A SELECT field's RHF value is a `FormSelectItem` (`{ id, label }`),
 * not a raw string — the two call sites below MUST stay in sync with
 * `ParameterFields.tsx` or edit-mode prefill silently breaks.
 *
 * Mirrors, in order:
 * 1. `getFieldProp`: `data.optionValues?.length` — enum select.
 * 2. `getStringFieldProp`: `data.name === 'column'` — generic column select.
 * 3. `getStringFieldProp`: `definition.name === 'tableRowInsertedCountToBeBetween'
 *    && data.name === 'columnName'` — partition column select.
 */
export const isSelectParam = (
  definition: Pick<TestDefinition, 'name'> | undefined,
  param: TestCaseParameterDefinition
): boolean => {
  const isEnumSelect = Boolean(param.optionValues?.length);
  const isColumnSelect = param.name === COLUMN_PARAM_NAME;
  const isPartitionColumnSelect =
    definition?.name === PARTITION_TEST_DEFINITION_NAME &&
    param.name === PARTITION_COLUMN_PARAM_NAME;

  return isEnumSelect || isColumnSelect || isPartitionColumnSelect;
};

/**
 * Classifies the RHF prefill shape for a single param, based on the same
 * signals `ParameterFields`/`TableDiffFields` use to choose a field type.
 * `buildEditParams` (edit-mode prefill) and the render layer must agree on
 * this classification or a param prefills as the wrong shape and the field
 * appears empty on edit.
 *
 * tableDiff's own column-array/select fields (`table2`, `keyColumns`,
 * `table2.keyColumns`, `useColumns`) are classified by the caller before
 * falling back to this general classifier — see `buildEditParamEntry` in
 * `transformTestCaseFormData.ts`.
 */
export type ParamPrefillKind = 'select' | 'array' | 'boolean' | 'scalar';

export const getParamPrefillKind = (
  definition: Pick<TestDefinition, 'name'> | undefined,
  param: TestCaseParameterDefinition | undefined
): ParamPrefillKind => {
  let result: ParamPrefillKind = 'scalar';

  if (!param) {
    result = 'scalar';
  } else if (isSelectParam(definition, param)) {
    result = 'select';
  } else if (
    param.dataType === TestDataType.Array ||
    param.dataType === TestDataType.Set
  ) {
    result = 'array';
  } else if (param.dataType === TestDataType.Boolean) {
    result = 'boolean';
  }

  return result;
};

type FormSelectItemLike = { id: string; label?: string };

type NormalizedParamValue = string | number | boolean | { value: string }[];

const isFormSelectItem = (value: unknown): value is FormSelectItemLike =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { id?: unknown }).id === 'string';

/**
 * Unwraps a single select value to its underlying string. A `FormSelectItem`
 * (`{ id, label }`) collapses to its `id`; a plain string passes through; any
 * other value (including `undefined`) returns `undefined`.
 */
export const unwrapSelectValue = (value: unknown): string | undefined => {
  let result: string | undefined;
  if (isFormSelectItem(value)) {
    result = value.id;
  } else if (typeof value === 'string') {
    result = value;
  }

  return result;
};

/**
 * Unwraps a multi-select value to a `string[]`. Each element is unwrapped via
 * `unwrapSelectValue`; elements that cannot be unwrapped are dropped. Returns
 * `undefined` when the input is not an array.
 */
export const unwrapSelectValues = (value: unknown): string[] | undefined => {
  let result: string[] | undefined;
  if (Array.isArray(value)) {
    result = value
      .map((item) => unwrapSelectValue(item))
      .filter((item): item is string => item !== undefined);
  }

  return result;
};

const normalizeArrayValue = (
  value: unknown[]
): { value: string }[] | unknown[] =>
  value.map((item) => {
    // useFieldArray rows: { value: string | FormSelectItem }.
    if (typeof item === 'object' && item !== null && 'value' in item) {
      const inner = (item as { value: unknown }).value;

      return isFormSelectItem(inner) ? { value: inner.id } : item;
    }

    // Bare FormSelectItem (e.g. a multi-select that stores { id, label }[]).
    if (isFormSelectItem(item)) {
      return { value: item.id };
    }

    // Bare string element — normalize to the { value } row shape the payload
    // builder expects so array params are never dropped.
    if (typeof item === 'string') {
      return { value: item };
    }

    return item;
  });

const normalizeValue = (value: unknown): unknown => {
  if (isFormSelectItem(value)) {
    return value.id;
  }

  if (Array.isArray(value)) {
    return normalizeArrayValue(value);
  }

  return value;
};

export const normalizeParamsForPayload = (
  rawParams: Record<string, unknown> | undefined,
  definition?: TestDefinition
): Record<string, NormalizedParamValue> | undefined => {
  if (!rawParams) {
    return undefined;
  }

  // Keep only params that belong to the selected definition. RHF (unlike the
  // legacy antd `preserve={false}` form) retains values from previously
  // selected test types, so without this filter stale params leak into the
  // payload and the API rejects them ("parameter is not defined").
  const allowedNames = definition?.parameterDefinition
    ? new Set(definition.parameterDefinition.map((param) => param.name))
    : undefined;

  return Object.entries(rawParams).reduce((result, [key, value]) => {
    const literalKey = restoreParamName(key);
    if (allowedNames && !allowedNames.has(literalKey)) {
      return result;
    }
    result[literalKey] = normalizeValue(value) as NormalizedParamValue;

    return result;
  }, {} as Record<string, NormalizedParamValue>);
};
