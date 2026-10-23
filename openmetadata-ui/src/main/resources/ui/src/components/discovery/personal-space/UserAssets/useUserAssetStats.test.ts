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
import { act, renderHook, waitFor } from '@testing-library/react';
import { SearchIndex } from '../../../../enums/search.enum';
import { User } from '../../../../generated/entity/teams/user';
import { getListTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { INCIDENT_MAX_PAGES, OWNED_TABLES_LIMIT } from './UserAssets.constants';
import { useUserAssetStats } from './useUserAssetStats';

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  ...jest.requireActual('../../../../rest/incidentManagerAPI'),
  getListTestCaseIncidentStatus: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
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
    (showErrorToast as jest.Mock).mockReset();
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
      expect.objectContaining({ assignee: 'alice', latest: true })
    );
    expect(mockIncidents).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ offset: 'next' })
    );
  });

  it('stops paging incidents after the max page count when the cursor never ends', async () => {
    respond();
    mockIncidents.mockResolvedValue({
      data: [{ severity: 'Severity1' }],
      paging: { total: 1000, after: 'same' },
    });
    const result = await renderStats();

    expect(mockIncidents).toHaveBeenCalledTimes(INCIDENT_MAX_PAGES);
    expect(result.current.incidentStats.severity1).toBe(INCIDENT_MAX_PAGES);
  });

  it('counts queries on owned tables and names the most viewed one', async () => {
    respond({ queries: 42 });
    const result = await renderStats();

    expect(result.current.queryStats).toEqual({
      count: 42,
      isPartial: false,
      mostViewed: 'orders',
      mostViewedFqn: 'svc.db.s.orders',
    });

    const queryRequest = mockSearchQuery.mock.calls.find(
      ([params]) => params.searchIndex === SearchIndex.QUERY
    )[0];

    expect(queryRequest.queryFilter).toEqual({
      query: { terms: { 'queryUsedIn.id': ['tbl-1'] } },
    });

    const ownedTablesRequest = mockSearchQuery.mock.calls.find(
      ([params]) => params.searchIndex === SearchIndex.TABLE
    )[0];

    // The ids travel in the GET URL; past ~100 the server answers HTTP 414.
    expect(ownedTablesRequest).toEqual(
      expect.objectContaining({
        fetchSource: true,
        includeFields: ['id', 'name', 'displayName', 'fullyQualifiedName'],
        pageSize: 100,
      })
    );
  });

  it('marks the query count partial once the owned-table cap is reached', async () => {
    respond({
      ownedTables: Array.from({ length: OWNED_TABLES_LIMIT }, (_, index) => ({
        id: `tbl-${index}`,
        name: `table_${index}`,
        fullyQualifiedName: `svc.db.s.table_${index}`,
      })),
    });
    const result = await renderStats();

    expect(result.current.queryStats.isPartial).toBe(true);
  });

  it('skips the query count when the user owns no tables', async () => {
    respond({ ownedTables: [] });
    const result = await renderStats();

    expect(result.current.queryStats).toEqual({
      count: 0,
      isPartial: false,
      mostViewed: '-',
      mostViewedFqn: undefined,
    });
    expect(
      mockSearchQuery.mock.calls.some(
        ([params]) => params.searchIndex === SearchIndex.QUERY
      )
    ).toBe(false);
  });

  it('reports an error instead of zero stats when a request fails', async () => {
    respond();
    mockIncidents.mockRejectedValue(new Error('boom'));
    const result = await renderStats();

    expect(result.current.error).toEqual(new Error('boom'));
    expect(showErrorToast).toHaveBeenCalledTimes(1);
    // Only the incident tile failed; the other requests' results stay usable.
    expect(result.current.failed).toEqual({
      assets: false,
      incidents: true,
      queries: false,
      health: false,
    });
    expect(result.current.assetStats.total).toBeGreaterThan(0);
  });

  it('has no error when every request succeeds', async () => {
    respond();
    const result = await renderStats();

    expect(result.current.error).toBeUndefined();
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('refetches after an error and clears it', async () => {
    respond();
    mockIncidents.mockRejectedValueOnce(new Error('boom'));
    const result = await renderStats();

    expect(result.current.error).toBeDefined();

    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeUndefined();
    expect(mockIncidents).toHaveBeenCalledTimes(2);
  });

  it("ignores the previous user's late responses after switching users", async () => {
    const firstUserResolvers: Array<() => void> = [];
    mockSearchQuery.mockImplementation((params: SearchParams) => {
      const forFirstUser = JSON.stringify(params.queryFilter).includes('"u1"');
      if (forFirstUser) {
        return new Promise((resolve) => {
          firstUserResolvers.push(() => resolve(withBuckets(99)));
        });
      }

      return Promise.resolve(
        params.pageSize > 0 ? { hits: { hits: [] } } : total(5)
      );
    });
    const bob = { id: 'u2', name: 'bob' } as User;
    const { result, rerender } = renderHook(
      (props: { subject: User }) => useUserAssetStats(props.subject),
      { initialProps: { subject: user } }
    );

    rerender({ subject: bob });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.assetStats.total).toBe(5);

    await act(async () => firstUserResolvers.forEach((resolve) => resolve()));

    expect(result.current.assetStats.total).toBe(5);
  });

  it('does not fetch or stay loading without a user', async () => {
    const { result } = renderHook(() => useUserAssetStats(undefined));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockSearchQuery).not.toHaveBeenCalled();
    expect(mockIncidents).not.toHaveBeenCalled();
  });
});
