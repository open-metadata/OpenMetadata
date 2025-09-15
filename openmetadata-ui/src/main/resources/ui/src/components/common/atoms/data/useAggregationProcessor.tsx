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

import { useCallback } from 'react';

/**
 * Processes raw aggregation API response into SearchDropdownOption format
 *
 * @description
 * This hook converts the raw response from Elasticsearch aggregation APIs
 * into a standardized format that can be used by SearchDropdown components.
 * Handles both custom processors and default bucket processing.
 *
 * @example
 * ```typescript
 * const processResult = useAggregationProcessor();
 * const options = processResult(apiResponse, customProcessor);
 * ```
 *
 * @stability Stable - Uses empty dependency array for maximum stability
 * @complexity Low - Single transformation responsibility
 */
export const useAggregationProcessor = () => {
  const processAggregationResult = useCallback(
    (
      result: unknown,
      processor?: (result: unknown) => unknown[]
    ): unknown[] => {
      if ((result as any)?.status !== 'fulfilled') {
        return [];
      }

      if (processor) {
        return processor(result);
      }

      // Default processing for simple aggregations
      const buckets = Object.values(
        (result as any).value?.data?.aggregations || {}
      )[0] as unknown;

      if (!(buckets as any)?.buckets) {
        return [];
      }

      return (
        (buckets as any)?.buckets?.map((bucket: any) => ({
          key: bucket.key,
          label: bucket.key,
          count: bucket.doc_count,
        })) || []
      );
    },
    [] // Empty dependency array ensures maximum stability
  );

  return processAggregationResult;
};
