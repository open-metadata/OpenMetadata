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

import { DefaultOptionType } from 'antd/lib/select';
import { isString, toLower } from 'lodash';

/**
 * @param searchValue search input
 * @param option select options list
 * @returns boolean
 */
export const handleSearchFilterOption = (
  searchValue: string,
  option?: {
    label: string;
    value: string;
  }
) => toLower(option?.label).includes(toLower(searchValue));
// Check label while searching anything and filter that options out if found matching

/**
 * @param serviceType key for quick filter
 * @returns json filter query string
 */

export const getServiceTypeExploreQueryFilter = (serviceType: string) => {
  return JSON.stringify({
    query: {
      bool: {
        must: [
          {
            bool: {
              should: [
                {
                  term: {
                    serviceType,
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });
};

/**
 * @param entityType key for quick filter (e.g., 'dataproduct', 'table', 'dashboard')
 * @returns json filter query string for entity type
 */
export const getEntityTypeExploreQueryFilter = (entityType: string) => {
  return JSON.stringify({
    query: {
      bool: {
        must: [
          {
            bool: {
              should: [
                {
                  term: {
                    'entityType.keyword': entityType,
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });
};

export const filterSelectOptions = (
  input: string,
  option?: DefaultOptionType
) => {
  return (
    toLower(option?.labelValue).includes(toLower(input)) ||
    toLower(isString(option?.value) ? option?.value : '').includes(
      toLower(input)
    )
  );
};
