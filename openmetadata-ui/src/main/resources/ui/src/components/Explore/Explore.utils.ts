/*
 *  Copyright 2023 Collate.
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

import { SearchDropdownOption } from 'components/SearchDropdown/SearchDropdown.interface';
import { has } from 'lodash';
import {
  QueryFieldValueInterface,
  QueryFilterInterface,
} from 'pages/explore/ExplorePage.interface';
import { ExploreQuickFilterField } from './explore.interface';

/**
 * It takes an array of filters and a data lookup and returns a new object with the filters grouped by
 * their label
 * @param filters - Array<QueryFieldValueInterface>
 * @param {SearchDropdownOption[]} dataLookUp - This is an array of objects that contains the
 * key and label for each filter.
 */
export const getParseValueFromLocation = (
  filters: Array<QueryFieldValueInterface>,
  dataLookUp: SearchDropdownOption[]
) =>
  filters.reduce((acc, filter) => {
    const key = Object.keys(filter.term)[0];
    const value = filter.term[key];
    const dataCategory = dataLookUp.find(
      (data) => data.key === key
    ) as SearchDropdownOption;

    if (!dataCategory) {
      return acc;
    }

    if (!acc[dataCategory.label]) {
      acc[dataCategory.label] = [];
    }
    acc[dataCategory?.label].push({
      key: value,
      label: value,
    });

    return acc;
  }, {} as Record<string, SearchDropdownOption[]>);

/**
 * It takes queryFilter object as input and returns a parsed array of search dropdown options with selected values
 * @param item - SearchDropdownOption
 * @param dropdownItems - SearchDropdownOption[]
 * @param queryFilter - QueryFilterInterface
 */
export const getSelectedValuesFromQuickFilter = (
  item: SearchDropdownOption,
  dropdownItems: SearchDropdownOption[],
  queryFilter?: QueryFilterInterface
) => {
  const EMPTY_DATA: ExploreQuickFilterField['value'] = [];

  if (
    queryFilter &&
    has(queryFilter, 'query.bool.must') &&
    queryFilter.query.bool.must
  ) {
    const filters: Array<QueryFieldValueInterface> = [];

    queryFilter.query.bool.must.forEach((item) => {
      const filterValues = item?.bool?.should;

      if (filterValues) {
        filters.push(...filterValues);
      }
    });

    const data = getParseValueFromLocation(filters, dropdownItems);

    return data[item.label] ? data[item.label] : [];
  }

  return EMPTY_DATA;
};
