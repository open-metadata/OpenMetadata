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

/**
 * Manages loading state for filter operations
 *
 * @description
 * Simple loading state manager specifically for filter-related operations.
 * Provides start/stop loading functions and current loading state.
 *
 * @example
 * ```typescript
 * const { loading, startLoading, stopLoading } = useFilterLoadingState();
 *
 * // In async operation:
 * startLoading();
 * await fetchData();
 * stopLoading();
 * ```
 *
 * @stability Stable - No external dependencies
 * @complexity Very Low - Simple state management only
 */
export const useFilterLoadingState = () => {
  const [loading, setLoading] = useState(false);

  const startLoading = useCallback(() => {
    setLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    setLoading(false);
  }, []);

  return {
    loading,
    startLoading,
    stopLoading,
  };
};
