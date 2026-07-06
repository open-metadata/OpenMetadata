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

import { TestDefinition } from '../../generated/tests/testDefinition';

const PARAM_NAME_SENTINEL = '___';

export const sanitizeParamName = (name: string): string =>
  name.split('.').join(PARAM_NAME_SENTINEL);

export const restoreParamName = (sanitized: string): string =>
  sanitized.split(PARAM_NAME_SENTINEL).join('.');

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
    if (typeof item === 'object' && item !== null && 'value' in item) {
      const inner = (item as { value: unknown }).value;

      if (isFormSelectItem(inner)) {
        return { value: inner.id };
      }
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
  _definition?: TestDefinition
): Record<string, NormalizedParamValue> | undefined => {
  if (!rawParams) {
    return undefined;
  }

  return Object.entries(rawParams).reduce((result, [key, value]) => {
    const literalKey = restoreParamName(key);
    result[literalKey] = normalizeValue(value) as NormalizedParamValue;

    return result;
  }, {} as Record<string, NormalizedParamValue>);
};
