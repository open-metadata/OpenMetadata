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

import { DataAssetFilter } from '../interface/workflow-builder-components.interface';

export const serializeDataAssetFilters = (filters: DataAssetFilter[]) => {
  return filters.length > 0
    ? filters.map((df) => ({
        dataAsset: df.dataAsset,
        filters: df.filters,
      }))
    : [];
};

export const serializeEventBasedFilters = (
  triggerFilter: string,
  dataAssets: string[]
) => {
  if (!triggerFilter || triggerFilter.trim() === '') {
    return {};
  }

  const filterObj: Record<string, string> = {};

  dataAssets.forEach((asset) => {
    filterObj[asset] = triggerFilter;
  });

  return filterObj;
};

export const serializePeriodicBatchFilters = (
  dataAssetFilters: DataAssetFilter[]
) => {
  const filterObj: Record<string, string> = {};

  dataAssetFilters.forEach((df) => {
    const entityType = df.dataAsset;

    const jsonLogicFilter = df.filters;

    if (jsonLogicFilter && jsonLogicFilter.trim() !== '') {
      filterObj[entityType] = jsonLogicFilter;
    }
  });

  return filterObj;
};

export const deserializePeriodicBatchFilters = (
  filters: Record<string, string>,
  entityTypes: string[]
): DataAssetFilter[] => {
  const dataAssetFilters: DataAssetFilter[] = [];

  entityTypes.forEach((entityType, index) => {
    const filterValue = filters[entityType];

    if (filterValue) {
      dataAssetFilters.push({
        id: index,
        dataAsset: entityType,
        filters: filterValue,
      });
    }
  });

  return dataAssetFilters;
};

export const deserializeEventBasedFilters = (
  filterObj: Record<string, string> | undefined,
  entityTypes: string[]
): string => {
  if (!filterObj || typeof filterObj !== 'object') {
    return '';
  }

  if (entityTypes.length === 1) {
    return filterObj[entityTypes[0]] || '';
  }

  for (const entityType of entityTypes) {
    const filterValue = filterObj[entityType];
    if (filterValue && filterValue.trim() !== '') {
      return filterValue;
    }
  }

  const firstKey = Object.keys(filterObj)[0];

  return firstKey ? filterObj[firstKey] || '' : '';
};
