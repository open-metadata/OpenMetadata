/*
 *  Copyright 2025 Collate.
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
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import {
  PipelineState,
  PipelineType,
} from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { queryClient } from '../../../../queryClient';
import { getIngestionPipelines } from '../../../../rest/ingestionPipelineAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import {
  createRouteActivationStore,
  RouteActivationProvider,
  RouteActivationStore,
} from '../../../platform/ai-shell/context/RouteActivationContext';
import { useIngestionPipelineStats } from './useIngestionPipelineStats';

jest.mock(
  '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline',
  () => ({
    PipelineState: {
      Failed: 'failed',
      PartialSuccess: 'partialSuccess',
      Running: 'running',
      Success: 'success',
    },
    PipelineType: {
      AutoClassification: 'autoClassification',
      Dbt: 'dbt',
      Lineage: 'lineage',
      Metadata: 'metadata',
      Profiler: 'profiler',
      Usage: 'usage',
    },
  })
);

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelines: jest.fn(),
}));

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../../constants/Services.constant', () => ({
  OPEN_METADATA: 'OpenMetadata',
}));

const mockGetIngestionPipelines = getIngestionPipelines as jest.MockedFunction<
  typeof getIngestionPipelines
>;
const mockSearchQuery = searchQuery as jest.MockedFunction<typeof searchQuery>;

// The single search now returns every connection service in one response. Each
// hit's _source carries the fields the health buckets need; entityType defaults to
// a database service (its category is irrelevant to the failed/healthy/pending
// counts, which key off pipeline state per service id).
const mockServices = (
  services: Array<{ id: string; [key: string]: unknown }>
) => {
  mockSearchQuery.mockResolvedValue({
    hits: {
      hits: services.map((service) => ({
        _source: { entityType: 'databaseService', ...service },
      })),
      total: { value: services.length },
    },
  } as never);
};

const pipeline = (
  pipelineState: PipelineState | undefined,
  serviceId: string
) => ({
  pipelineStatuses: pipelineState ? [{ pipelineState }] : undefined,
  service: { id: serviceId },
});

const withQueryClient = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: queryClient }, children);

describe('useIngestionPipelineStats cache integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    window.sessionStorage.clear();
    mockServices([
      { id: 'svc-1' },
      { id: 'svc-2' },
      { id: 'svc-3' },
      { id: 'svc-4' },
    ]);
    mockGetIngestionPipelines.mockResolvedValue({
      data: [
        pipeline(PipelineState.Success, 'svc-1'),
        pipeline(PipelineState.PartialSuccess, 'svc-2'),
        pipeline(PipelineState.Failed, 'svc-3'),
        pipeline(undefined, 'svc-4'),
      ],
    } as never);
  });

  it('deduplicates concurrent ingestion pipeline stats requests', async () => {
    const first = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withQueryClient,
    });
    const second = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withQueryClient,
    });

    await waitFor(() => {
      expect(first.result.current.isLoading).toBe(false);
      expect(second.result.current.isLoading).toBe(false);
    });

    expect(first.result.current).toMatchObject({
      connectedServices: 4,
      failedServices: 1,
      healthyServices: 1,
      pendingServices: 1,
      warningServices: 1,
    });
    expect(second.result.current).toMatchObject(first.result.current);
    expect(mockGetIngestionPipelines).toHaveBeenCalledTimes(1);
  });

  // A single capped read left every pipeline past the first page unseen, so
  // the services owning them fell into "not run yet" whatever state they were
  // actually in -- wrong on exactly the large installs that lean on this card.
  it('follows the paging cursor so late pipelines are not miscounted', async () => {
    mockServices([{ id: 'svc-1' }, { id: 'svc-2' }]);
    mockGetIngestionPipelines
      .mockResolvedValueOnce({
        data: [pipeline(PipelineState.Success, 'svc-1')],
        paging: { after: 'page-2' },
      } as never)
      .mockResolvedValueOnce({
        data: [pipeline(PipelineState.Failed, 'svc-2')],
        paging: {},
      } as never);

    const { result } = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withQueryClient,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetIngestionPipelines).toHaveBeenCalledTimes(2);
    expect(mockGetIngestionPipelines).toHaveBeenLastCalledWith(
      expect.objectContaining({ paging: { after: 'page-2' } })
    );
    // svc-2's only pipeline is on the second page: unpaged it was "not run
    // yet" rather than failing.
    expect(result.current).toMatchObject({
      failedServices: 1,
      healthyServices: 1,
      pendingServices: 0,
    });
  });

  it('stops paging once the cursor clears', async () => {
    mockServices([{ id: 'svc-1' }]);
    mockGetIngestionPipelines.mockResolvedValue({
      data: [pipeline(PipelineState.Success, 'svc-1')],
      paging: {},
    } as never);

    const { result } = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withQueryClient,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetIngestionPipelines).toHaveBeenCalledTimes(1);
  });

  it('counts every configured service, not just ones with pipelines', async () => {
    // Connections page shows every configured service regardless of whether
    // it has ever run a pipeline -- svc-5 has no pipeline at all and must
    // still be counted (as pending), matching what /connections shows.
    mockServices([{ id: 'svc-1' }, { id: 'svc-5' }]);
    mockGetIngestionPipelines.mockResolvedValue({
      data: [pipeline(PipelineState.Success, 'svc-1')],
    } as never);

    const { result } = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withQueryClient,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current).toMatchObject({
      connectedServices: 2,
      failedServices: 0,
      healthyServices: 1,
      pendingServices: 1,
      warningServices: 0,
    });
  });

  it('counts each service once, worst pipeline state wins', async () => {
    mockServices([{ id: 'svc-1' }, { id: 'svc-2' }, { id: 'svc-3' }]);
    mockGetIngestionPipelines.mockResolvedValue({
      data: [
        // Same service: metadata pipeline succeeded, profiler pipeline failed
        // -> any failing agent flags the whole service as failed.
        pipeline(PipelineState.Success, 'svc-1'),
        pipeline(PipelineState.Failed, 'svc-1'),
        // Same service: two successful pipelines -> counted once as healthy.
        pipeline(PipelineState.Success, 'svc-2'),
        pipeline(PipelineState.Success, 'svc-2'),
        // Distinct service, single warning pipeline.
        pipeline(PipelineState.PartialSuccess, 'svc-3'),
      ],
    } as never);

    const { result } = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withQueryClient,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current).toMatchObject({
      connectedServices: 3,
      failedServices: 1,
      healthyServices: 1,
      pendingServices: 0,
      warningServices: 1,
    });
  });

  it('lets a failed pipeline override an earlier in-progress one regardless of array order', async () => {
    // Running/Queued/Stopped have no entry in STATE_SEVERITY. If an
    // unmapped state becomes "worst" first, a later Failed pipeline must
    // still override it -- not get masked because its severity comparison
    // against an undefined baseline silently evaluates to false.
    mockServices([{ id: 'svc-1' }]);
    mockGetIngestionPipelines.mockResolvedValue({
      data: [
        pipeline(PipelineState.Running, 'svc-1'),
        pipeline(PipelineState.Failed, 'svc-1'),
      ],
    } as never);

    const { result } = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withQueryClient,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current).toMatchObject({
      connectedServices: 1,
      failedServices: 1,
      healthyServices: 0,
      pendingServices: 0,
      warningServices: 0,
    });
  });

  it('ignores pipelines parented by a non-service container (e.g. an AI automation agent or a test suite)', async () => {
    // Only svc-1 is a real configured service; agent-1 is an aiAutomation
    // container that also owns a pipeline but must not inflate the count.
    mockServices([{ id: 'svc-1' }]);
    mockGetIngestionPipelines.mockResolvedValue({
      data: [
        pipeline(PipelineState.Success, 'svc-1'),
        pipeline(PipelineState.Failed, 'agent-1'),
      ],
    } as never);

    const { result } = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withQueryClient,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current).toMatchObject({
      connectedServices: 1,
      failedServices: 0,
      healthyServices: 1,
      pendingServices: 0,
      warningServices: 0,
    });
  });

  it('excludes the built-in OpenMetadata metadata service (server-side filter)', async () => {
    // The built-in OpenMetadata service is now excluded server-side by the shared
    // connections query filter, so the search returns no such hit.
    mockServices([]);
    mockGetIngestionPipelines.mockResolvedValue({ data: [] } as never);

    const { result } = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withQueryClient,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.connectedServices).toBe(0);
    expect(mockSearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryFilter: expect.objectContaining({
          query: {
            bool: expect.objectContaining({
              must_not: [
                {
                  bool: {
                    filter: [
                      { term: { entityType: 'metadataService' } },
                      { term: { fullyQualifiedName: 'OpenMetadata' } },
                    ],
                  },
                },
              ],
            }),
          },
        }),
      })
    );
  });

  it('hydrates from cache on remount without loading', async () => {
    const first = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withQueryClient,
    });

    await waitFor(() => {
      expect(first.result.current.connectedServices).toBe(4);
    });

    const second = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withQueryClient,
    });

    expect(second.result.current).toMatchObject({
      connectedServices: 4,
      failedServices: 1,
      healthyServices: 1,
      isLoading: false,
      pendingServices: 1,
      warningServices: 1,
    });
    expect(mockGetIngestionPipelines).toHaveBeenCalledTimes(1);
  });

  it('flags isError on fetch failure and retries on the next mount', async () => {
    mockGetIngestionPipelines
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        data: [pipeline(PipelineState.Success, 'svc-1')],
      } as never);

    const failed = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withQueryClient,
    });

    await waitFor(() => {
      expect(failed.result.current.isLoading).toBe(false);
    });

    // On failure the hook must flag the error so consumers can render an explicit
    // "unavailable" state rather than treating zeros as a real (healthy) reading.
    expect(failed.result.current.isError).toBe(true);

    const recovered = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withQueryClient,
    });

    await waitFor(() => {
      expect(recovered.result.current.healthyServices).toBe(1);
    });

    expect(recovered.result.current.isError).toBe(false);
    expect(mockGetIngestionPipelines).toHaveBeenCalledTimes(2);
  });

  it('surfaces failing services with the worst recent pipeline and a clean reason', async () => {
    mockServices([
      {
        displayName: 'Snowflake Prod',
        fullyQualifiedName: 'snowflake_prod',
        id: 'svc-db',
        name: 'snowflake_prod',
        serviceType: 'Snowflake',
      },
    ]);
    mockGetIngestionPipelines.mockResolvedValue({
      data: [
        {
          pipelineStatuses: [
            {
              pipelineState: PipelineState.Failed,
              status: [
                { failures: [{ error: 'Workflow failed - check logs' }] },
              ],
              timestamp: 1000,
            },
          ],
          pipelineType: PipelineType.Lineage,
          service: { id: 'svc-db' },
        },
        {
          pipelineStatuses: [
            {
              pipelineState: PipelineState.Failed,
              status: [
                {
                  failures: [
                    { error: 'Authentication failed connecting to Snowflake' },
                  ],
                },
              ],
              timestamp: 2000,
            },
          ],
          pipelineType: PipelineType.Metadata,
          service: { id: 'svc-db' },
        },
      ],
    } as never);

    const { result } = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withQueryClient,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.failingServices).toHaveLength(1);
    expect(result.current.failingServices[0]).toMatchObject({
      displayName: 'Snowflake Prod',
      fqn: 'snowflake_prod',
      pipelineType: PipelineType.Metadata,
      reason: 'Authentication failed connecting to Snowflake',
      serviceType: 'Snowflake',
      state: 'failed',
    });
  });

  it('falls back to a typed reason when the raw error is generic', async () => {
    mockServices([
      { id: 'svc-db', name: 'redshift_eu', serviceType: 'Redshift' },
    ]);
    mockGetIngestionPipelines.mockResolvedValue({
      data: [
        {
          pipelineStatuses: [
            {
              pipelineState: PipelineState.Failed,
              status: [
                { failures: [{ error: 'Workflow failed - check logs' }] },
              ],
              timestamp: 5000,
            },
          ],
          pipelineType: PipelineType.Lineage,
          service: { id: 'svc-db' },
        },
      ],
    } as never);

    const { result } = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withQueryClient,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.failingServices[0].reason).toBe(
      'Lineage ingestion failed'
    );
  });
});

describe('useIngestionPipelineStats route revalidation', () => {
  const ROUTE = '/';
  const withActivation = (store: RouteActivationStore) => {
    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(RouteActivationProvider, { store }, children)
      );

    return Wrapper;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    window.sessionStorage.clear();
    mockServices([{ id: 'svc-1' }]);
    mockGetIngestionPipelines.mockResolvedValue({
      data: [pipeline(PipelineState.Success, 'svc-1')],
    } as never);
  });

  it('does not fetch again on activation while the cache is fresh', async () => {
    const store = createRouteActivationStore();
    store.setActivePath(ROUTE);
    const { result } = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withActivation(store),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetIngestionPipelines).toHaveBeenCalledTimes(1);

    act(() => store.bumpEpoch(ROUTE));

    // Within the 30s TTL the activation revalidation is a no-op.
    expect(mockGetIngestionPipelines).toHaveBeenCalledTimes(1);
  });

  it('refetches on activation once the cache TTL has expired', async () => {
    const store = createRouteActivationStore();
    store.setActivePath(ROUTE);
    const { result } = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withActivation(store),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetIngestionPipelines).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(31_000)); // past PIPELINE_STATS_TTL_MS
    act(() => store.bumpEpoch(ROUTE));

    await waitFor(() =>
      expect(mockGetIngestionPipelines).toHaveBeenCalledTimes(2)
    );
  });

  it('force-refetches immediately on a websocket dirty signal, ignoring TTL', async () => {
    const store = createRouteActivationStore();
    store.setActivePath(ROUTE);
    const { result } = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withActivation(store),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetIngestionPipelines).toHaveBeenCalledTimes(1);

    act(() => store.markRouteDirty(ROUTE)); // dirty → invalidate + refetch now

    await waitFor(() =>
      expect(mockGetIngestionPipelines).toHaveBeenCalledTimes(2)
    );
  });
});
