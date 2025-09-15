/*
 *  Copyright 2024 Collate.
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

import { useCallback, useState } from 'react';
import { FilterOptions } from '../types';

/**
 * Manages filter options state (data storage only)
 *
 * @description
 * Simple state manager for filter dropdown options. Stores the options
 * object and provides functions to update specific filter fields.
 * Does not fetch data - only manages state.
 *
 * @example
 * ```typescript
 * const { filterOptions, setFilterOptions, updateFilterField } = useFilterOptionsState();
 *
 * // Set all options
 * setFilterOptions({ owners: [...], tags: [...] });
 *
 * // Update specific field
 * updateFilterField('owners', newOwnerOptions);
 * ```
 *
 * @stability Stable - No external dependencies
 * @complexity Very Low - Basic state management only
 */
export const useFilterOptionsState = () => {
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({});

  const updateFilterField = useCallback(
    (fieldKey: string, options: unknown[]) => {
      setFilterOptions((prev) => ({
        ...prev,
        [fieldKey]: options,
      }));
    },
    []
  );

  const clearFilterOptions = useCallback(() => {
    setFilterOptions({});
  }, []);

  return {
    filterOptions,
    setFilterOptions,
    updateFilterField,
    clearFilterOptions,
  };
};
