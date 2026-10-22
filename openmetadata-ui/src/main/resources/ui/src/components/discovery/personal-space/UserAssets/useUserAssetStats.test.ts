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
import { renderHook, waitFor } from '@testing-library/react';
import { SearchIndex } from '../../../../enums/search.enum';
import { User } from '../../../../generated/entity/teams/user';
import { getListTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { useUserAssetStats } from './useUserAssetStats';

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  ...jest.requireActual('../../../../rest/incidentManagerAPI'),
  getListTestCaseIncidentStatus: jest.fn(),
}));

const mockSearchQuery = searchQuery as jest.Mock;
const mockIncidents = getListTestCaseIncidentStatus as jest.Mock;

const user = {
  id: 'u1',
  name: 'alice',
  teams: [{ id: 't1', type: 'team' }],
} as User;

interface SearchParams {
  searchIndex: string;
  pageSize: number;
  queryFilter: Record<string, unknown>;
}

const isFailedTestsQuery = (params: SearchParams) =>
  JSON.stringify(params.queryFilter).includes('testSuite.summary.failed');

const total = (value: number, extra: Record<string, unknown> = {}) => ({
  hits: { total: { value }, ...extra },
});

const respond = ({
  assets = total(10, {}),
  failed = 3,
  queries = 42,
  ownedTables = [
    { id: 'tbl-1', name: 'orders', fullyQualifiedName: 'svc.db.s.orders' },
  ],
  perIndex = {} as Record<string, number>,
} = {}) =>
  mockSearchQuery.mockImplementation((params: SearchParams) => {
    if (params.searchIndex === SearchIndex.DATA_ASSET) {
      return Promise.resolve(
        isFailedTestsQuery(params) ? total(failed) : assets
      );
    }
    if (params.searchIndex === SearchIndex.TABLE && params.pageSize > 0) {
      return Promise.resolve({
        hits: {
          total: { value: ownedTables.length },
          hits: ownedTables.map((source) => ({ _source: source })),
        },
      });
    }
    if (params.searchIndex === SearchIndex.QUERY) {
      return Promise.resolve(total(queries));
    }

    return Promise.resolve(total(perIndex[params.searchIndex] ?? 0));
  });

const withBuckets = (value: number) => ({
  hits: { total: { value } },
  aggregations: {
    entityType: {
      buckets: [
        { key: 'table', doc_count: 6 },
        { key: 'dashboard', doc_count: 3 },
        { key: 'pipeline', doc_count: 1 },
      ],
    },
  },
});

const renderStats = async () => {
  const hook = renderHook(() => useUserAssetStats(user));
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

  return hook.result;
};

describe('useUserAssetStats', () => {
  beforeEach(() => {
    mockSearchQuery.mockReset();
    mockIncidents.mockReset();
    mockIncidents.mockResolvedValue({ data: [], paging: { total: 0 } });
  });

  it('counts owned assets with the entity type breakdown, scoped to user and teams', async () => {
    respond({ assets: withBuckets(10) });
    const result = await renderStats();

    expect(result.current.assetStats).toEqual({
      total: 10,
      tables: 6,
      dashboards: 3,
      pipelines: 1,
    });

    const assetFilter = JSON.stringify(
      mockSearchQuery.mock.calls.find(
        ([params]) =>
          params.searchIndex === SearchIndex.DATA_ASSET &&
          !isFailedTestsQuery(params)
      )[0].queryFilter
    );

    expect(assetFilter).toContain('"owners.id":"u1"');
    expect(assetFilter).toContain('"owners.id":"t1"');
  });

  it('falls back to per-index counts when the aggregation is missing', async () => {
    respond({
      assets: total(5),
      perIndex: {
        [SearchIndex.TABLE]: 2,
        [SearchIndex.DASHBOARD]: 2,
        [SearchIndex.PIPELINE]: 1,
      },
    });
    const result = await renderStats();

    expect(result.current.assetStats).toEqual({
      total: 5,
      tables: 2,
      dashboards: 2,
      pipelines: 1,
    });
  });

  it('derives the health score from assets with failing tests', async () => {
    respond({ assets: withBuckets(10), failed: 3 });
    const result = await renderStats();

    expect(result.current.requireAttention).toBe(3);
    expect(result.current.dataHealthScore).toBe(70);
  });

  it('pages through open incidents and counts Severity1 ones', async () => {
    respond();
    mockIncidents
      .mockResolvedValueOnce({
        data: [{ severity: 'Severity1' }, { severity: 'Severity2' }],
        paging: { total: 3, after: 'next' },
      })
      .mockResolvedValueOnce({
        data: [{ severity: 'Severity1' }],
        paging: { total: 3 },
      });
    const result = await renderStats();

    expect(result.current.incidentStats).toEqual({ total: 3, severity1: 2 });
    expect(mockIncidents).toHaveBeenCalledTimes(2);
    expect(mockIncidents).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ assignee: 'u1', latest: true })
    );
    expect(mockIncidents).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ after: 'next' })
    );
  });

  it('counts queries on owned tables and names the most viewed one', async () => {
    respond({ queries: 42 });
    const result = await renderStats();

    expect(result.current.queryStats).toEqual({
      count: 42,
      mostViewed: 'orders',
      mostViewedFqn: 'svc.db.s.orders',
    });

    const queryRequest = mockSearchQuery.mock.calls.find(
      ([params]) => params.searchIndex === SearchIndex.QUERY
    )[0];

    expect(JSON.stringify(queryRequest.queryFilter)).toContain(
      '"queryUsedIn.id":"tbl-1"'
    );
  });

  it('skips the query count when the user owns no tables', async () => {
    respond({ ownedTables: [] });
    const result = await renderStats();

    expect(result.current.queryStats).toEqual({
      count: 0,
      mostViewed: '-',
      mostViewedFqn: undefined,
    });
    expect(
      mockSearchQuery.mock.calls.some(
        ([params]) => params.searchIndex === SearchIndex.QUERY
      )
    ).toBe(false);
  });

  it('zeroes the stats when every request fails', async () => {
    mockSearchQuery.mockRejectedValue(new Error('boom'));
    mockIncidents.mockRejectedValue(new Error('boom'));
    const result = await renderStats();

    expect(result.current.assetStats.total).toBe(0);
    expect(result.current.incidentStats).toEqual({ total: 0, severity1: 0 });
    expect(result.current.queryStats.count).toBe(0);
    expect(result.current.dataHealthScore).toBe(0);
  });

  it('does not fetch without a user', () => {
    const { result } = renderHook(() => useUserAssetStats(undefined));

    expect(result.current.isLoading).toBe(true);
    expect(mockSearchQuery).not.toHaveBeenCalled();
  });
});
