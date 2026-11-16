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

import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { SearchIndex } from '../enums/search.enum';
import { queryClient } from '../queryClient';
import { postAggregateFieldOptions } from '../rest/miscAPI';
import { searchQuery } from '../rest/searchAPI';
import {
  buildCuratedQueryFilter,
  DEFAULT_CURATED_RULE,
} from '../utils/curatedRule';
import { useCuratedAssets } from './useCuratedAssets';

jest.mock('../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../rest/miscAPI', () => ({
  postAggregateFieldOptions: jest.fn(),
}));

const mockSearchQuery = searchQuery as jest.MockedFunction<typeof searchQuery>;
const mockAggregate = postAggregateFieldOptions as jest.MockedFunction<
  typeof postAggregateFieldOptions
>;

/** The test-case index's answer: one bucket per asset with a failing test. */
const failingAssets = (...fqns: string[]) =>
  ({
    data: {
      aggregations: {
        'sterms#originEntityFQN': {
          // Normalised to lowercase on the index.
          buckets: fqns.map((key) => ({
            doc_count: 1,
            key: key.toLowerCase(),
          })),
        },
      },
    },
  } as never);

const hit = (name: string, extra: Record<string, unknown> = {}) => ({
  _source: {
    entityType: 'table',
    fullyQualifiedName: `svc.db.${name}`,
    id: name,
    name,
    serviceType: 'Snowflake',
    tier: { tagFQN: 'Tier.Tier1' },
    ...extra,
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('buildCuratedQueryFilter', () => {
  it('requires every clause, so the rule reads as an AND', () => {
    const filter = buildCuratedQueryFilter(DEFAULT_CURATED_RULE);

    expect(filter.query.bool.must).toEqual([
      { term: { 'tier.tagFQN': 'Tier.Tier1' } },
      { term: { 'certification.tagLabel.tagFQN': 'Certification.Gold' } },
    ]);
  });
});

describe('useCuratedAssets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    mockAggregate.mockResolvedValue(failingAssets());
  });

  it('reports the rule total, not just the page it renders', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: { hits: [hit('a'), hit('b')], total: { value: 24 } },
    } as never);

    const { result } = renderHook(
      () => useCuratedAssets({ rule: DEFAULT_CURATED_RULE }),
      {
        wrapper,
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.assets).toHaveLength(2);
    expect(result.current.totalCount).toBe(24);
  });

  it('shows the tier leaf rather than its fully qualified tag', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: { hits: [hit('a')], total: { value: 1 } },
    } as never);

    const { result } = renderHook(
      () => useCuratedAssets({ rule: DEFAULT_CURATED_RULE }),
      {
        wrapper,
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.assets[0].tier).toBe('Tier1');
  });

  // No data-asset document carries a test outcome — the `failedTestCases`
  // this read before is on no index, so every row showed a green dot.
  it('marks an asset unhealthy only when the test-case index has it failing', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: { hits: [hit('Failing'), hit('passing')], total: { value: 2 } },
    } as never);
    mockAggregate.mockResolvedValue(failingAssets('svc.db.Failing'));

    const { result } = renderHook(
      () => useCuratedAssets({ rule: DEFAULT_CURATED_RULE }),
      {
        wrapper,
      }
    );

    await waitFor(() =>
      expect(result.current.assets[0]?.isHealthy).toBeDefined()
    );

    expect(result.current.assets.map((a) => a.isHealthy)).toEqual([
      false,
      true,
    ]);

    // One aggregation for the whole page, scoped to its FQNs and to failures.
    expect(mockAggregate).toHaveBeenCalledTimes(1);

    const request = mockAggregate.mock.calls[0][0];

    expect(request.fieldName).toBe('originEntityFQN');
    expect(request.index).toBe(SearchIndex.TEST_CASE);
    expect(request.query).toContain('svc.db.Failing');
    expect(request.query).toContain('Failed');
  });

  it('shows no health at all when the test lookup fails', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: { hits: [hit('a')], total: { value: 1 } },
    } as never);
    mockAggregate.mockRejectedValue(new Error('network'));

    const { result } = renderHook(
      () => useCuratedAssets({ rule: DEFAULT_CURATED_RULE }),
      {
        wrapper,
      }
    );

    await waitFor(() => expect(mockAggregate).toHaveBeenCalled());
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    // Unknown, not healthy — and the card itself is not in error.
    expect(result.current.assets[0].isHealthy).toBeUndefined();
    expect(result.current.isError).toBe(false);
  });

  it('narrows the saved filter by entity type rather than by index', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: { hits: [], total: { value: 0 } },
    } as never);

    const { result } = renderHook(
      () =>
        useCuratedAssets({
          queryFilter:
            '{"query":{"bool":{"must":[{"term":{"deleted":false}}]}}}',
          resources: ['table', 'topic'],
          rule: DEFAULT_CURATED_RULE,
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const request = mockSearchQuery.mock.calls[0][0];

    expect(request.searchIndex).toBe(SearchIndex.DATA_ASSET);
    expect(JSON.stringify(request.queryFilter)).toContain(
      '{"term":{"entityType":"table"}}'
    );
  });

  it('queries the all index when the saved config selects every type', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: { hits: [], total: { value: 0 } },
    } as never);

    const { result } = renderHook(
      () =>
        useCuratedAssets({
          queryFilter: '{"query":{"bool":{"must":[]}}}',
          resources: ['all'],
          rule: DEFAULT_CURATED_RULE,
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockSearchQuery.mock.calls[0][0].searchIndex).toBe(SearchIndex.ALL);
  });

  it('surfaces a failed search instead of an empty rule result', async () => {
    mockSearchQuery.mockRejectedValue(new Error('network'));

    const { result } = renderHook(
      () => useCuratedAssets({ rule: DEFAULT_CURATED_RULE }),
      {
        wrapper,
      }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.assets).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });
});
