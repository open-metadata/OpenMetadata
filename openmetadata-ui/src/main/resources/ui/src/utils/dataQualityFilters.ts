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

import { TestCaseType } from '../enums/TestSuite.enum';

/** Whose tests to count: the whole estate, the user's, or the ones they follow. */
export enum DataQualityScope {
  ALL = 'all',
  MINE = 'mine',
  FOLLOWED = 'followed',
}

/** How far back test results are counted, in days. */
export enum DataQualityRange {
  LAST_7_DAYS = '7',
  LAST_30_DAYS = '30',
  LAST_90_DAYS = '90',
}

export interface DataQualityFilters {
  scope: DataQualityScope;
  range: DataQualityRange;
  testCaseType: TestCaseType;
}

export const DEFAULT_DATA_QUALITY_FILTERS: DataQualityFilters = {
  range: DataQualityRange.LAST_7_DAYS,
  scope: DataQualityScope.ALL,
  testCaseType: TestCaseType.all,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Translates the card's filters into search params.
 *
 * `all` is the absence of a filter rather than a value to send: passing
 * `testCaseType=all` or an empty owner would narrow the query to nothing.
 */
export const toSearchParams = (
  filters: DataQualityFilters,
  userName?: string
) => {
  const end = Date.now();

  return {
    endTimestamp: end,
    followedBy:
      filters.scope === DataQualityScope.FOLLOWED ? userName : undefined,
    owner: filters.scope === DataQualityScope.MINE ? userName : undefined,
    startTimestamp: end - Number(filters.range) * DAY_MS,
    testCaseType:
      filters.testCaseType === TestCaseType.all
        ? undefined
        : filters.testCaseType,
  };
};
