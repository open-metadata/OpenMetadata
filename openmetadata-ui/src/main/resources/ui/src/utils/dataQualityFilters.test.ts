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
import {
  DataQualityRange,
  DataQualityScope,
  DEFAULT_DATA_QUALITY_FILTERS,
  toSearchParams,
  toTableCountsKey,
  toTableCountsQuery,
  toTableStatusCounts,
} from './dataQualityFilters';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('toSearchParams', () => {
  it('sends no owner, follower or type filter in the default "everything" state', () => {
    const params = toSearchParams(DEFAULT_DATA_QUALITY_FILTERS, 'alice');

    // `all` is the absence of a filter — sending it would narrow to nothing.
    expect(params.owner).toBeUndefined();
    expect(params.followedBy).toBeUndefined();
    expect(params.testCaseType).toBeUndefined();
  });

  it('scopes to the user by owner or follower, never both', () => {
    const mine = toSearchParams(
      { ...DEFAULT_DATA_QUALITY_FILTERS, scope: DataQualityScope.MINE },
      'alice'
    );

    expect(mine.owner).toBe('alice');
    expect(mine.followedBy).toBeUndefined();

    const followed = toSearchParams(
      { ...DEFAULT_DATA_QUALITY_FILTERS, scope: DataQualityScope.FOLLOWED },
      'alice'
    );

    expect(followed.followedBy).toBe('alice');
    expect(followed.owner).toBeUndefined();
  });

  it('turns the range into a window ending now', () => {
    const params = toSearchParams(
      { ...DEFAULT_DATA_QUALITY_FILTERS, range: DataQualityRange.LAST_30_DAYS },
      'alice'
    );

    expect(params.endTimestamp - params.startTimestamp).toBe(30 * DAY_MS);
  });

  it('passes a concrete test type through', () => {
    const params = toSearchParams(
      { ...DEFAULT_DATA_QUALITY_FILTERS, testCaseType: TestCaseType.table },
      'alice'
    );

    expect(params.testCaseType).toBe(TestCaseType.table);
  });
});

describe('toTableCountsQuery', () => {
  const VIEWER = { id: 'user-1', teamIds: ['team-1'] };
  const mustOf = (q: string) => JSON.parse(q).query.bool.must;

  it('counts only the listed tables, in the window, without a scope clause by default', () => {
    const must = mustOf(
      toTableCountsQuery(DEFAULT_DATA_QUALITY_FILTERS, ['a.b.c.t1'], VIEWER)
    );

    expect(must).toContainEqual({ terms: { originEntityFQN: ['a.b.c.t1'] } });
    expect(must).toContainEqual({ term: { deleted: false } });
    expect(JSON.stringify(must)).toContain('testCaseResult.timestamp');
    expect(JSON.stringify(must)).not.toContain('owners');
    expect(JSON.stringify(must)).not.toContain('followers');
  });

  it('counts the viewer and their teams as owners for "mine"', () => {
    const must = mustOf(
      toTableCountsQuery(
        { ...DEFAULT_DATA_QUALITY_FILTERS, scope: DataQualityScope.MINE },
        ['t'],
        VIEWER
      )
    );

    expect(JSON.stringify(must)).toContain('["user-1","team-1"]');
  });

  it('matches the viewer as a follower for "followed"', () => {
    const must = mustOf(
      toTableCountsQuery(
        { ...DEFAULT_DATA_QUALITY_FILTERS, scope: DataQualityScope.FOLLOWED },
        ['t'],
        VIEWER
      )
    );

    expect(must).toContainEqual({ term: { 'followers.keyword': 'user-1' } });
  });
});

describe('toTableStatusCounts', () => {
  it('folds the table × status rows into one entry per table', () => {
    expect(
      toTableStatusCounts([
        {
          originEntityFQN: 't1',
          'testCaseResult.testCaseStatus': 'success',
          document_count: '4',
        },
        {
          originEntityFQN: 't1',
          'testCaseResult.testCaseStatus': 'failed',
          document_count: '2',
        },
        {
          originEntityFQN: 't2',
          'testCaseResult.testCaseStatus': 'aborted',
          document_count: '1',
        },
        {
          originEntityFQN: 't2',
          'testCaseResult.testCaseStatus': 'queued',
          document_count: '9',
        },
      ])
    ).toEqual({
      t1: { passed: 4, failed: 2, aborted: 0 },
      t2: { passed: 0, failed: 0, aborted: 1 },
    });
  });

  it('keys each table so a mixed-case FQN finds it', () => {
    const counts = toTableStatusCounts([
      {
        originEntityFQN: 'snow.db.public.orders',
        'testCaseResult.testCaseStatus': 'success',
        document_count: '3',
      },
    ]);

    expect(counts[toTableCountsKey('SNOW.DB.PUBLIC.Orders')]).toEqual({
      passed: 3,
      failed: 0,
      aborted: 0,
    });
  });
});
