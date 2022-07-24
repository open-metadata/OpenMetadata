/*
 *  Copyright 2021 Collate
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

import { isEqual } from 'lodash';
import {
  initialFilterQS,
  searchFilterQS,
} from '../constants/explore.constants';

const prepareModifiedKey = (key, restrictKeyModification = false) => {
  if (!restrictKeyModification) {
    if (key === 'service') {
      return 'serviceType';
    } else if (key === 'databaseschema') {
      return 'databaseSchema.name';
    } else if (key === 'database') {
      return 'database.name';
    } else if (key === 'servicename') {
      return 'service.name';
    } else if (key === 'tier' || key === 'tags') {
      return `${key}.tagFQN`;
    } else {
      return key;
    }
  }
};

export const getFilterString = (
  filters,
  excludeFilters = [],
  restrictKeyModification = false
) => {
  const modifiedFilters = {};
  for (const key in filters) {
    if (excludeFilters.includes(key)) {
      continue;
    }
    const modifiedFilter = [];
    const filter = filters[key];
    filter.forEach((value) => {
      const modifiedKey = prepareModifiedKey(key, restrictKeyModification);
      const modifiedValue = key === 'tags' ? `"${value}"` : value;
      modifiedFilter.push(
        `${modifiedKey.split(' ').join('_')}:${modifiedValue}`
      );
    });
    modifiedFilters[key] = modifiedFilter;
  }
  const filterString = Object.values(modifiedFilters)
    .filter((value) => value.length)
    .map((filters) => `(${filters.join(' OR ')})`);

  return filterString.join(' AND ');
};

export const getFilterCount = (filterData) => {
  return Object.values(filterData).reduce((count, currentValue) => {
    return count + currentValue.length;
  }, 0);
};

export const getFilterKey = (key) => {
  return key === 'service_type' ? 'service' : key;
};

/**
 * Check for filters and return the filters in query param format
 * @param filters - filter object
 * @returns query param format
 */
export const prepareQueryParams = (filters, initFilters = {}) => {
  const urlSearchParams = new URLSearchParams();
  const filterSearchParams = new URLSearchParams();
  const initFilterSearchParams = new URLSearchParams();
  const filterEntries = Object.entries(filters);
  const initFilterKeys = Object.keys(initFilters);

  for (const [key, value] of filterEntries) {
    if (value?.length) {
      if (initFilterKeys.includes(key) && isEqual(initFilters[key], value)) {
        initFilterSearchParams.set(key, value.join(','));
      } else {
        filterSearchParams.set(key, value.join(','));
      }
    }
  }

  if (initFilterSearchParams.toString()) {
    urlSearchParams.set(initialFilterQS, initFilterSearchParams);
  }
  if (filterSearchParams.toString()) {
    urlSearchParams.set(searchFilterQS, filterSearchParams);
  }

  return urlSearchParams.toString();
};
