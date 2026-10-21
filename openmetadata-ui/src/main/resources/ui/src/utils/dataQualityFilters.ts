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

// 30 days, the Data Quality page's own default: the card's footer opens that
// page, and a shorter window here made the two disagree on the same estate.
// ADR:2026-10-16-landing-overview-cards-match-the-pages-they-open
export const DEFAULT_DATA_QUALITY_FILTERS: DataQualityFilters = {
  range: DataQualityRange.LAST_30_DAYS,
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

/** Who "mine" and "followed" resolve to, the way the test search resolves them. */
export interface DataQualityViewer {
  id: string;
  /** Owned by one of the viewer's teams counts as the viewer's own. */
  teamIds: string[];
}

export interface TableStatusCounts {
  passed: number;
  failed: number;
  aborted: number;
}

/** Groups by the table a test runs on, so column tests count toward it. */
export const TABLE_STATUS_AGGREGATION =
  'bucketName=table:aggType=terms:field=originEntityFQN,' +
  'bucketName=status:aggType=terms:field=testCaseResult.testCaseStatus';

/**
 * The search query for the per-table counts, with the same scope as the
 * card's list: results in the selected window, owned or followed as the
 * scope asks, and only on the tables the list shows.
 */
export const toTableCountsQuery = (
  filters: DataQualityFilters,
  tableFqns: string[],
  viewer?: DataQualityViewer
): string => {
  const end = Date.now();
  const must: Record<string, unknown>[] = [
    { term: { deleted: false } },
    { terms: { originEntityFQN: tableFqns } },
    {
      range: {
        'testCaseResult.timestamp': {
          gte: end - Number(filters.range) * DAY_MS,
          lte: end,
        },
      },
    },
  ];

  if (viewer && filters.scope === DataQualityScope.MINE) {
    must.push({
      nested: {
        path: 'owners',
        query: { terms: { 'owners.id': [viewer.id, ...viewer.teamIds] } },
        ignore_unmapped: true,
      },
    });
  }
  if (viewer && filters.scope === DataQualityScope.FOLLOWED) {
    must.push({ term: { 'followers.keyword': viewer.id } });
  }

  return JSON.stringify({ query: { bool: { must } } });
};

const STATUS_FIELD: Record<string, keyof TableStatusCounts> = {
  success: 'passed',
  failed: 'failed',
  aborted: 'aborted',
};

/** The key `toTableStatusCounts` files a table's counts under. */
export const toTableCountsKey = (tableFqn: string): string =>
  tableFqn.toLowerCase();

/**
 * One entry per table, from the report's table × status rows, keyed by the
 * lowercased FQN: `originEntityFQN` has a lowercase normalizer, so the report
 * returns its buckets lowercased. Look an entry up with `toTableCountsKey`.
 */
export const toTableStatusCounts = (
  rows: Record<string, string>[]
): Record<string, TableStatusCounts> =>
  rows.reduce<Record<string, TableStatusCounts>>((acc, row) => {
    const table = row.originEntityFQN && toTableCountsKey(row.originEntityFQN);
    const field = STATUS_FIELD[row['testCaseResult.testCaseStatus']];
    if (table && field) {
      acc[table] = acc[table] ?? { passed: 0, failed: 0, aborted: 0 };
      acc[table][field] += Number(row.document_count) || 0;
    }

    return acc;
  }, {});
