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

import { get } from 'lodash';
import {
  ExploreQuickFilterField,
  ExploreSearchIndex,
  SearchHitCounts,
} from '../components/Explore/ExplorePage.interface';
import { SearchDropdownOption } from '../components/SearchDropdown/SearchDropdown.interface';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { Aggregations } from '../interface/search.interface';
import {
  QueryFieldInterface,
  QueryFieldValueInterface,
  QueryFilterInterface,
} from '../pages/ExplorePage/ExplorePage.interface';

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

  if (queryFilter) {
    const filters: Array<QueryFieldValueInterface> = [];

    const mustField: QueryFieldInterface[] = get(
      queryFilter,
      'query.bool.must',
      []
    );

    mustField.forEach((item) => {
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

export const findActiveSearchIndex = (
  obj: SearchHitCounts
): ExploreSearchIndex | null => {
  const keys = Object.keys(obj) as ExploreSearchIndex[];
  const filteredKeys = keys.filter((key) => obj[key] > 0);

  return filteredKeys.length > 0 ? filteredKeys[0] : null;
};

export const getAggregations = (data: Aggregations) => {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key.replace('sterms#', ''),
      value,
    ])
  ) as Aggregations;
};

export const getSearchIndexFromEntityType = (entityType: EntityType) => {
  const commonAssets: Record<string, SearchIndex> = {
    [EntityType.ALL]: SearchIndex.ALL,
    [EntityType.TABLE]: SearchIndex.TABLE,
    [EntityType.PIPELINE]: SearchIndex.PIPELINE,
    [EntityType.DASHBOARD]: SearchIndex.DASHBOARD,
    [EntityType.MLMODEL]: SearchIndex.MLMODEL,
    [EntityType.TOPIC]: SearchIndex.TOPIC,
    [EntityType.CONTAINER]: SearchIndex.CONTAINER,
    [EntityType.TAG]: SearchIndex.TAG,
    [EntityType.GLOSSARY_TERM]: SearchIndex.GLOSSARY,
    [EntityType.STORED_PROCEDURE]: SearchIndex.STORED_PROCEDURE,
    [EntityType.DASHBOARD_DATA_MODEL]: SearchIndex.DASHBOARD_DATA_MODEL,
    [EntityType.SEARCH_INDEX]: SearchIndex.SEARCH_INDEX,
    [EntityType.DATABASE_SERVICE]: SearchIndex.DATABASE_SERVICE,
    [EntityType.MESSAGING_SERVICE]: SearchIndex.MESSAGING_SERVICE,
    [EntityType.DASHBOARD_SERVICE]: SearchIndex.DASHBOARD_SERVICE,
    [EntityType.PIPELINE_SERVICE]: SearchIndex.PIPELINE_SERVICE,
    [EntityType.MLMODEL_SERVICE]: SearchIndex.ML_MODEL_SERVICE,
    [EntityType.STORAGE_SERVICE]: SearchIndex.STORAGE_SERVICE,
    [EntityType.SEARCH_SERVICE]: SearchIndex.SEARCH_SERVICE,
    [EntityType.DOMAIN]: SearchIndex.DOMAIN,
    [EntityType.DATA_PRODUCT]: SearchIndex.DATA_PRODUCT,
  };

  return commonAssets[entityType];
};
