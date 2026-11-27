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

import { AGGREGATE_PAGE_SIZE_LARGE } from '../../../../../../constants/constants';
import { DataQualityDimension } from '../../../../../../generated/tests/dataQualityDimension';
import {
  getDataQualityDimensions,
  getDataQualityDimensionTestCaseCounts,
  getDataQualityDimensionTestDefinitionCounts,
} from '../../../../../../rest/dataQualityDimensionAPI';

/**
 * A count map is `undefined` when its request failed: unknown, not zero. Test
 * definitions reference a dimension by name, so they are counted separately
 * from test cases.
 */
export interface DimensionListState {
  dimensions: DataQualityDimension[];
  testCaseCounts?: Record<string, number>;
  testDefinitionCounts?: Record<string, number>;
}

export const fetchDimensionList = async (): Promise<DimensionListState> => {
  const [{ data }, testCaseCounts, testDefinitionCounts] = await Promise.all([
    getDataQualityDimensions({ limit: AGGREGATE_PAGE_SIZE_LARGE }),
    // A missing count must not hide the dimension list itself.
    getDataQualityDimensionTestCaseCounts().catch(() => undefined),
    getDataQualityDimensionTestDefinitionCounts().catch(() => undefined),
  ]);

  return { dimensions: data, testCaseCounts, testDefinitionCounts };
};

export const countFor = (
  counts: Record<string, number> | undefined,
  dimension: DataQualityDimension | undefined
): number | undefined => counts?.[dimension?.id ?? ''];

export const filterDimensions = (
  dimensions: DataQualityDimension[],
  searchTerm: string
) => {
  const term = searchTerm.trim().toLowerCase();

  if (!term) {
    return dimensions;
  }

  return dimensions.filter((dimension) =>
    [dimension.name, dimension.displayName, dimension.description].some(
      (value) => value?.toLowerCase().includes(term)
    )
  );
};
