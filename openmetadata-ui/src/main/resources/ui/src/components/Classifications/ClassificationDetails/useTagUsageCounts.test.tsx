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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { Tag } from '../../../generated/entity/classification/tag';
import { postExactAggregateFieldOptions } from '../../../rest/miscAPI';
import { useTagUsageCounts } from './useTagUsageCounts';

jest.mock('../../../rest/miscAPI', () => ({
  postExactAggregateFieldOptions: jest.fn(),
}));

const mockPost = postExactAggregateFieldOptions as jest.MockedFunction<
  typeof postExactAggregateFieldOptions
>;

const asTags = (...names: string[]) =>
  names.map((name) => ({ name, fullyQualifiedName: name })) as Tag[];

const aggregationFor = (counts: Record<string, number>) => ({
  data: {
    aggregations: {
      'sterms#tags.tagFQN': {
        buckets: Object.entries(counts).map(([key, doc_count]) => ({
          key,
          doc_count,
        })),
      },
    },
  },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useTagUsageCounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue(
      aggregationFor({ 'c.page1tag': 3 }) as unknown as Awaited<
        ReturnType<typeof postExactAggregateFieldOptions>
      >
    );
  });

  it('should aggregate every tag on the page in a single request', async () => {
    const { result } = renderHook(
      () => useTagUsageCounts('c', asTags('c.a', 'c.b')),
      { wrapper }
    );

    await waitFor(() =>
      expect(result.current.isUsageCountsLoading).toBe(false)
    );

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({ fieldValue: '(c\\.a|c\\.b)', size: 2 }),
      expect.any(AbortSignal)
    );
  });

  // Paging must re-key, or a page would render the previous page's counts
  it('should re-aggregate when the page of tags changes', async () => {
    const { result, rerender } = renderHook(
      ({ tags }) => useTagUsageCounts('c', tags),
      { wrapper, initialProps: { tags: asTags('c.a') } }
    );

    await waitFor(() =>
      expect(result.current.isUsageCountsLoading).toBe(false)
    );

    rerender({ tags: asTags('c.b') });

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2));

    expect(mockPost).toHaveBeenLastCalledWith(
      expect.objectContaining({ fieldValue: '(c\\.b)' }),
      expect.any(AbortSignal)
    );
  });

  it('should abort the request the user paged away from', async () => {
    // Left pending so paging away happens while it is still in flight
    mockPost.mockReturnValueOnce(new Promise(() => undefined) as never);

    const { rerender } = renderHook(
      ({ tags }) => useTagUsageCounts('c', tags),
      {
        wrapper,
        initialProps: { tags: asTags('c.a') },
      }
    );

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));

    rerender({ tags: asTags('c.b') });

    await waitFor(() => expect(mockPost.mock.calls[0][1]?.aborted).toBe(true));
  });

  it('should query the tier field for the Tier classification', async () => {
    renderHook(() => useTagUsageCounts('Tier', asTags('Tier.Gold')), {
      wrapper,
    });

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        expect.objectContaining({ fieldName: 'tier.tagFQN' }),
        expect.any(AbortSignal)
      )
    );
  });

  it('should not request anything when disabled or the page is empty', async () => {
    renderHook(() => useTagUsageCounts('c', asTags('c.a'), false), { wrapper });
    renderHook(() => useTagUsageCounts('c', []), { wrapper });

    await waitFor(() => expect(mockPost).not.toHaveBeenCalled());
  });

  it('should report unknown counts when the aggregation fails', async () => {
    mockPost.mockRejectedValueOnce(new Error('search unavailable'));

    const { result } = renderHook(() => useTagUsageCounts('c', asTags('c.a')), {
      wrapper,
    });

    await waitFor(() =>
      expect(result.current.isUsageCountsLoading).toBe(false)
    );

    expect(result.current.usageCounts).toBeUndefined();
  });
});
