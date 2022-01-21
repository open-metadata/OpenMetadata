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
      const modifiedKey =
        !restrictKeyModification && key === 'service' ? 'service type' : key;
      modifiedFilter.push(`${modifiedKey.split(' ').join('_')}:${value}`);
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
