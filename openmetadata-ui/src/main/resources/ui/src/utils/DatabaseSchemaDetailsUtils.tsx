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

import { TabSpecificField } from '../enums/entity.enum';
import { getTermQuery } from './SearchPureUtils';

export const defaultFields = `${TabSpecificField.TAGS},${TabSpecificField.OWNERS},${TabSpecificField.USAGE_SUMMARY},${TabSpecificField.DOMAINS},${TabSpecificField.DATA_PRODUCTS}`;

export function buildSchemaQueryFilter(
  field: string,
  fieldValue: string,
  searchValue?: string
) {
  return getTermQuery(
    { [field]: fieldValue },
    'must',
    undefined,
    searchValue
      ? {
          wildcardShouldQueries: {
            'displayName.keyword': `*${searchValue}*`,
            'name.keyword': `*${searchValue}*`,
          },
        }
      : undefined
  );
}
