/*
 *  Copyright 2026 Collate.
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
import { useCallback, useEffect, useState } from 'react';
import { AGGREGATE_PAGE_SIZE_LARGE } from '../constants/constants';
import { DataQualityDimension } from '../generated/tests/dataQualityDimension';
import { getDataQualityDimensions } from '../rest/dataQualityDimensionAPI';

export interface UseDataQualityDimensionsResult {
  dimensions: DataQualityDimension[];
  isLoading: boolean;
  /**
   * The fetch failed, as opposed to there being no dimensions. Callers need the two apart: an
   * empty picker and a picker that could not be loaded warrant different fallbacks.
   */
  hasFailed: boolean;
  refetch: () => Promise<void>;
}

/**
 * The dimension list every picker is built from — the test case form, the test definition form
 * and the test case filters all need exactly this, so the fetch lives here rather than being
 * re-implemented (with a different failure behaviour) at each call site.
 *
 * Dimensions are admin-curated and few, so the whole list is fetched in one page; `paging` is
 * intentionally not followed.
 */
export const useDataQualityDimensions = (): UseDataQualityDimensionsResult => {
  const [dimensions, setDimensions] = useState<DataQualityDimension[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFailed, setHasFailed] = useState(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await getDataQualityDimensions({
        limit: AGGREGATE_PAGE_SIZE_LARGE,
      });
      setDimensions(data);
      setHasFailed(false);
    } catch {
      // Swallowed rather than toasted: the pickers this feeds degrade to the value already set,
      // and a failure here must not block creating a test case or a test definition.
      setDimensions([]);
      setHasFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { dimensions, isLoading, hasFailed, refetch };
};
