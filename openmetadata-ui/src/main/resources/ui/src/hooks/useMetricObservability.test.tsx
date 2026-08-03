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
import type { ReactNode } from 'react';
import { Health } from '../generated/api/data/metricObservability';
import { getMetricTabObservability } from '../rest/metricTabsAPI';
import { useMetricObservability } from './useMetricObservability';

jest.mock('../rest/metricTabsAPI', () => ({
  getMetricTabObservability: jest.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
};

describe('useMetricObservability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMetricTabObservability as jest.Mock).mockResolvedValue({
      health: Health.Healthy,
      score: 98,
    });
  });

  it('refetches the server rollup when a fresh observer mounts', async () => {
    const { wrapper } = createWrapper();
    const first = renderHook(() => useMetricObservability('metric-1'), {
      wrapper,
    });

    await waitFor(() =>
      expect(first.result.current.observability).toBeDefined()
    );
    first.unmount();

    const second = renderHook(() => useMetricObservability('metric-1'), {
      wrapper,
    });

    await waitFor(() =>
      expect(getMetricTabObservability).toHaveBeenCalledTimes(2)
    );
    second.unmount();
  });

  it('does not request a rollup without a metric id', async () => {
    renderHook(() => useMetricObservability(), {
      wrapper: createWrapper().wrapper,
    });

    await waitFor(() =>
      expect(getMetricTabObservability).not.toHaveBeenCalled()
    );
  });

  it('waits until an explicitly disabled query is enabled', async () => {
    const { wrapper } = createWrapper();
    const { rerender, result } = renderHook(
      ({ enabled }) =>
        useMetricObservability('metric-1', {
          enabled,
        }),
      {
        initialProps: { enabled: false },
        wrapper,
      }
    );

    expect(getMetricTabObservability).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() =>
      expect(result.current.observability).toEqual({
        health: Health.Healthy,
        score: 98,
      })
    );

    expect(getMetricTabObservability).toHaveBeenCalledTimes(1);
  });
});
