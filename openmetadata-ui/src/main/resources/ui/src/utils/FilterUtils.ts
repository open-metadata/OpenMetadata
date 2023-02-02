/*
 *  Copyright 2022 Collate.
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

import { FilterObject } from 'components/AdvancedSearch/AdvancedSearch.interface';
import { isArray, isNil, isObject, isString } from 'lodash';

export function isFilterObject(obj: unknown): obj is FilterObject {
  const typedObj = obj as FilterObject;

  return (
    isObject(typedObj) &&
    Object.entries<unknown>(typedObj).every(
      ([key, value]) =>
        isString(key) &&
        isArray(value) &&
        value.every((e: unknown) => isString(e))
    )
  );
}

/**
 * Builds an Elasticsearch JSON query from a {@see FilterObject}
 */
export const filterObjectToElasticsearchQuery: (
  f: FilterObject | undefined
) => Record<string, unknown> | undefined = (f) => {
  if (isNil(f)) {
    return {};
  }
  if (!Object.entries(f).length) {
    return undefined;
  }

  return {
    query: {
      bool: {
        must: Object.entries(f).map(([key, values]) => ({
          bool: {
            should: values.map((value) => ({ term: { [key]: value } })),
          },
        })),
      },
    },
  };
};
