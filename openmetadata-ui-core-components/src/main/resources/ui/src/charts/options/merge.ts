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

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

/**
 * Deep-merges `override` into `base` without mutating either. Plain objects
 * merge key by key; arrays, functions and other values replace; `undefined`
 * in the override keeps the base value.
 */
export const mergeOption = <T>(base: T, override?: unknown): T => {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? base : (override as T);
  }
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = mergeOption(result[key], value);
  }

  return result as T;
};

/**
 * `setOption` `replaceMerge` keys for re-renders: these components are
 * replaced from the new option (so removed series, axes, zoom and colour
 * scales go away), while the legend is merged so series a user hid stay
 * hidden.
 */
export const REPLACE_MERGE_KEYS = [
  'series',
  'xAxis',
  'yAxis',
  'grid',
  'dataZoom',
  'visualMap',
];
