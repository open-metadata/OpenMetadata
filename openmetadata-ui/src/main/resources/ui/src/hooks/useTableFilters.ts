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
import { isArray, isEmpty, isNil, isString } from 'lodash';
import qs, { ParsedQs } from 'qs';
import { useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import { useLocationSearch } from './LocationSearch/useLocationSearch';
import useCustomLocation from './useCustomLocation/useCustomLocation';

type FilterState = Record<
  string,
  string | boolean | string[] | null | undefined
>;

export const useTableFilters = <T extends FilterState>(initialFilters: T) => {
  const location = useCustomLocation();
  const history = useHistory();
  const searchQuery = useLocationSearch<ParsedQs>();

  const parseFiltersFromUrl = (): T => {
    const parsedFilters = { ...initialFilters };

    for (const key of Object.keys(initialFilters)) {
      const paramValue = searchQuery[key];
      const initialValue = initialFilters[key as keyof T];

      if (!isNil(paramValue)) {
        if (typeof initialValue === 'boolean') {
          parsedFilters[key as keyof T] = (paramValue === 'true') as T[keyof T];
        } else if (isArray(initialValue)) {
          // Handle both array format (from brackets) and comma-separated string format
          if (isArray(paramValue)) {
            parsedFilters[key as keyof T] = paramValue as T[keyof T];
          } else if (isString(paramValue)) {
            parsedFilters[key as keyof T] = paramValue
              .split(',')
              .map((val) => val.trim()) as T[keyof T];
          }
        } else {
          parsedFilters[key as keyof T] = paramValue as T[keyof T];
        }
      }
    }

    return parsedFilters;
  };

  // Update URL with the filters applied for the table as query parameters.
  const updateUrlWithFilters = (updatedFilters: FilterState) => {
    const currentQueryParams = qs.parse(window.location.search, {
      ignoreQueryPrefix: true,
    });

    // Merge the existing query params with the updated filters
    const mergedQueryParams = {
      ...currentQueryParams,
      ...updatedFilters,
    };

    Object.keys(mergedQueryParams).forEach((key) => {
      const value = mergedQueryParams[key];

      if (isNil(value) || (isArray(value) && isEmpty(value))) {
        delete mergedQueryParams[key];
      }
      // Remove the array to string conversion to preserve array format
      // The qs.stringify function will handle arrays properly
    });
    history.replace({
      search: qs.stringify(mergedQueryParams, {
        addQueryPrefix: true,
        arrayFormat: 'brackets',
      }),
    });
  };

  const filters = useMemo(
    () => parseFiltersFromUrl(),
    [location.search, initialFilters]
  );

  // Update multiple filters at a time
  const setFilters = (newFilters: FilterState) => {
    updateUrlWithFilters(newFilters);
  };

  return { filters, setFilters };
};
