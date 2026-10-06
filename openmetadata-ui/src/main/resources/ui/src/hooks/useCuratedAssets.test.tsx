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
import { queryClient } from '../queryClient';
import { searchQuery } from '../rest/searchAPI';
import {
  buildCuratedQueryFilter,
  DEFAULT_CURATED_RULE,
} from '../utils/curatedRule';
import { useCuratedAssets } from './useCuratedAssets';

jest.mock('../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

const mockSearchQuery = searchQuery as jest.MockedFunction<typeof searchQuery>;

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

  it('marks an asset unhealthy only when a test is actually failing', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: {
        hits: [
          hit('failing', { failedTestCases: 2 }),
          hit('passing', { failedTestCases: 0 }),
          // No test counts at all: nothing is known to be failing, which is
          // not the same as a warning the user can act on.
          hit('untested'),
        ],
        total: { value: 3 },
      },
    } as never);

    const { result } = renderHook(
      () => useCuratedAssets({ rule: DEFAULT_CURATED_RULE }),
      {
        wrapper,
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.assets.map((a) => a.isHealthy)).toEqual([
      false,
      true,
      true,
    ]);
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
