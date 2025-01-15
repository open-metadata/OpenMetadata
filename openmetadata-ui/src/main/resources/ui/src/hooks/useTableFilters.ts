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
import { useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import useCustomLocation from './useCustomLocation/useCustomLocation';

type FilterState = Record<string, string | boolean>;

export const useTableFilters = <T extends FilterState>(initialFilters: T) => {
  const location = useCustomLocation();
  const history = useHistory();

  const parseFiltersFromUrl = (): T => {
    const searchParams = new URLSearchParams(location.search);
    const parsedFilters = { ...initialFilters };

    for (const key of Object.keys(initialFilters)) {
      const paramValue = searchParams.get(key);
      const initialValue = initialFilters[key as keyof T];

      if (paramValue !== null) {
        parsedFilters[key as keyof T] =
          typeof initialValue === 'boolean'
            ? ((paramValue === 'true') as T[keyof T])
            : (paramValue as T[keyof T]);
      }
    }

    return parsedFilters;
  };

  const updateUrlWithFilters = (updatedFilters: Partial<T>) => {
    const searchParams = new URLSearchParams(location.search);

    Object.entries(updatedFilters).forEach(([key, value]) => {
      if (value == null) {
        searchParams.delete(key);
      } else {
        searchParams.set(key, value.toString());
      }
    });

    history.replace({ search: searchParams.toString() });
  };

  const filters = useMemo(
    () => parseFiltersFromUrl(),
    [location.search, initialFilters]
  );

  // Update a single filter
  const setFilter = <K extends keyof T>(key: K, value: T[K]) => {
    updateUrlWithFilters({ [key]: value } as unknown as Partial<T>);
  };

  // Update multiple filters at a time
  const setFilters = (newFilters: Partial<T>) => {
    updateUrlWithFilters(newFilters);
  };

  return { filters, setFilter, setFilters };
};
