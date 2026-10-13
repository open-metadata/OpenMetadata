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
  ServiceHealth,
  ServicesOverview,
  ServiceSummary,
} from '../../../../generated/api/services/servicesOverview';
import {
  PipelineState,
  PipelineType,
} from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { queryClient } from '../../../../queryClient';
import { getIngestionPipelines } from '../../../../rest/ingestionPipelineAPI';
import { getServicesOverview } from '../../../../rest/serviceAPI';
import {
  createRouteActivationStore,
  RouteActivationProvider,
  RouteActivationStore,
} from '../../../platform/ai-shell/context/RouteActivationContext';
import {
  MAX_FAILING_ROWS,
  PIPELINE_STATS_TTL_MS,
  useIngestionPipelineStats,
} from './useIngestionPipelineStats';

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelines: jest.fn(),
}));

jest.mock('../../../../rest/serviceAPI', () => ({
  getServicesOverview: jest.fn(),
}));

const mockGetIngestionPipelines = getIngestionPipelines as jest.MockedFunction<
  typeof getIngestionPipelines
>;
const mockGetServicesOverview = getServicesOverview as jest.MockedFunction<
  typeof getServicesOverview
>;

const service = (
  id: string,
  health: ServiceHealth,
  extra: Partial<ServiceSummary> = {}
): ServiceSummary => ({
  entityType: 'databaseService',
  fullyQualifiedName: id,
  health,
  id,
  name: id,
  serviceType: 'Snowflake',
  ...extra,
});

/**
 * One overview response. `healthCounts` is the estate-wide tally the server
 * keeps per entity type; `data` is the filtered page of failing services.
 */
const overview = (
  healthCounts: ServicesOverview['healthCounts'],
  data: ServiceSummary[] = [],
  total = 0
): ServicesOverview =>
  ({
    counts: {},
    data,
    healthCounts,
    paging: { total: data.length },
    serviceTypeCounts: {},
    total,
  } as ServicesOverview);

const run = (
  pipelineState: PipelineState,
  timestamp: number,
  error?: string
) => ({
  pipelineState,
  status: error ? [{ failures: [{ error }] }] : [],
  timestamp,
});

const pipeline = (
  fqn: string,
  pipelineType: PipelineType,
  latest: ReturnType<typeof run>
) => ({
  fullyQualifiedName: fqn,
  pipelineStatuses: [latest],
  pipelineType,
});

const withQueryClient = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: queryClient }, children);

const renderStats = () =>
  renderHook(() => useIngestionPipelineStats(), { wrapper: withQueryClient });

describe('useIngestionPipelineStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    window.sessionStorage.clear();
    mockGetServicesOverview.mockResolvedValue(
      overview(
        {
          dashboardService: { failed: 1, notRun: 2, success: 4 },
          databaseService: { failed: 2, success: 3 },
        },
        [
          service('snowflake_prod', ServiceHealth.Failed),
          service('looker', ServiceHealth.Failed, {
            entityType: 'dashboardService',
          }),
        ],
        12
      )
    );
    mockGetIngestionPipelines.mockResolvedValue({ data: [] } as never);
  });

  it('reads the buckets from the server tally, summed across service types', async () => {
    const { result } = renderStats();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current).toMatchObject({
      connectedServices: 12,
      failedServices: 3,
      healthyServices: 7,
      isError: false,
      pendingServices: 2,
      warningServices: 0,
    });
    expect(result.current.dataUpdatedAt).toBeGreaterThan(0);
  });

  // The old hook pulled every service and every pipeline (1000 per page, up to
  // 20 pages) on each landing load. The estate must now cost one request.
  it('asks the overview for the estate counts plus one page of failed services', async () => {
    const { result } = renderStats();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetServicesOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        excludeProvider: 'system',
        health: [ServiceHealth.Failed],
        includeHealth: true,
        limit: MAX_FAILING_ROWS,
      })
    );
  });

  it('reads pipelines only for the failing services it shows, scoped by service type', async () => {
    const { result } = renderStats();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetIngestionPipelines).toHaveBeenCalledTimes(2);
    expect(mockGetIngestionPipelines).toHaveBeenCalledWith(
      expect.objectContaining({
        arrQueryFields: ['pipelineStatuses'],
        serviceFilter: 'looker',
        serviceType: 'dashboardService',
      })
    );
  });

  it('fills the remaining rows with partially failed services', async () => {
    mockGetServicesOverview
      .mockResolvedValueOnce(
        overview({ databaseService: { failed: 1, partialSuccess: 4 } }, [
          service('a', ServiceHealth.Failed),
        ])
      )
      .mockResolvedValueOnce(
        overview({ databaseService: { failed: 1, partialSuccess: 4 } }, [
          service('b', ServiceHealth.PartialSuccess),
        ])
      );

    const { result } = renderStats();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetServicesOverview).toHaveBeenLastCalledWith(
      expect.objectContaining({
        health: [ServiceHealth.PartialSuccess],
        limit: MAX_FAILING_ROWS - 1,
      })
    );
    expect(result.current.failingServices.map((s) => s.state)).toEqual([
      'failed',
      'partialSuccess',
    ]);
    expect(result.current).toMatchObject({
      failedServices: 1,
      warningServices: 4,
    });
  });

  it('skips the partial read when failed services already fill the rows', async () => {
    mockGetServicesOverview.mockResolvedValue(
      overview(
        { databaseService: { failed: 40, partialSuccess: 5 } },
        Array.from({ length: MAX_FAILING_ROWS }, (_, i) =>
          service(`svc-${i}`, ServiceHealth.Failed)
        )
      )
    );

    const { result } = renderStats();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetServicesOverview).toHaveBeenCalledTimes(1);
    expect(mockGetIngestionPipelines).toHaveBeenCalledTimes(MAX_FAILING_ROWS);
    // The count is the server's, not the number of rows fetched.
    expect(result.current.failedServices).toBe(40);
    expect(result.current.failingServices).toHaveLength(MAX_FAILING_ROWS);
  });

  it('skips the partial read when nothing is partially failing', async () => {
    mockGetServicesOverview.mockResolvedValue(
      overview({ databaseService: { failed: 1, success: 1 } }, [
        service('a', ServiceHealth.Failed),
      ])
    );

    const { result } = renderStats();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetServicesOverview).toHaveBeenCalledTimes(1);
  });

  it('explains a row with the most recent run in the service worst state', async () => {
    mockGetServicesOverview.mockResolvedValue(
      overview({ databaseService: { failed: 1 } }, [
        service('snowflake_prod', ServiceHealth.Failed, {
          displayName: 'Snowflake Prod',
        }),
      ])
    );
    mockGetIngestionPipelines.mockResolvedValue({
      data: [
        pipeline(
          'snowflake_prod.lineage',
          PipelineType.Lineage,
          run(PipelineState.Failed, 1000, 'Workflow failed - check logs')
        ),
        pipeline(
          'snowflake_prod.metadata',
          PipelineType.Metadata,
          run(
            PipelineState.Failed,
            2000,
            'Authentication failed connecting to Snowflake'
          )
        ),
        pipeline(
          'snowflake_prod.profiler',
          PipelineType.Profiler,
          run(PipelineState.Success, 3000)
        ),
      ],
    } as never);

    const { result } = renderStats();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.failingServices[0]).toMatchObject({
      displayName: 'Snowflake Prod',
      fqn: 'snowflake_prod',
      lastRunTs: 2000,
      pipelineFqn: 'snowflake_prod.metadata',
      pipelineType: PipelineType.Metadata,
      reason: 'Authentication failed connecting to Snowflake',
      serviceCategory: 'databaseServices',
      serviceType: 'Snowflake',
      state: 'failed',
    });
  });

  // The fallback sentence is translated by the row, so the hook must not
  // compose English for it.
  it('leaves the reason empty when the raw error is generic', async () => {
    mockGetServicesOverview.mockResolvedValue(
      overview({ databaseService: { failed: 1 } }, [
        service('redshift_eu', ServiceHealth.Failed),
      ])
    );
    mockGetIngestionPipelines.mockResolvedValue({
      data: [
        pipeline(
          'redshift_eu.lineage',
          PipelineType.Lineage,
          run(PipelineState.Failed, 5000, 'Workflow failed - check logs')
        ),
      ],
    } as never);

    const { result } = renderStats();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.failingServices[0]).toMatchObject({
      pipelineType: PipelineType.Lineage,
      reason: '',
    });
  });

  it('ranks failed services before partial ones, then by most recent run', async () => {
    mockGetServicesOverview
      .mockResolvedValueOnce(
        overview({ databaseService: { failed: 2, partialSuccess: 1 } }, [
          service('old-failure', ServiceHealth.Failed),
          service('new-failure', ServiceHealth.Failed),
        ])
      )
      .mockResolvedValueOnce(
        overview({ databaseService: { failed: 2, partialSuccess: 1 } }, [
          service('partial', ServiceHealth.PartialSuccess),
        ])
      );
    mockGetIngestionPipelines.mockImplementation(
      async ({ serviceFilter }) =>
        ({
          data: [
            pipeline(
              `${serviceFilter}.metadata`,
              PipelineType.Metadata,
              run(
                serviceFilter === 'partial'
                  ? PipelineState.PartialSuccess
                  : PipelineState.Failed,
                { 'new-failure': 300, 'old-failure': 100, partial: 900 }[
                  serviceFilter ?? ''
                ] ?? 0
              )
            ),
          ],
        } as never)
    );

    const { result } = renderStats();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.failingServices.map((s) => s.id)).toEqual([
      'new-failure',
      'old-failure',
      'partial',
    ]);
  });

  it('deduplicates concurrent requests and hydrates a remount from cache', async () => {
    const first = renderStats();
    const second = renderStats();

    await waitFor(() => {
      expect(first.result.current.isLoading).toBe(false);
      expect(second.result.current.isLoading).toBe(false);
    });

    const third = renderStats();

    expect(third.result.current).toMatchObject({
      failedServices: 3,
      isLoading: false,
    });
    expect(mockGetServicesOverview).toHaveBeenCalledTimes(1);
  });

  it('flags isError on failure and retries on the next mount', async () => {
    mockGetServicesOverview.mockRejectedValueOnce(new Error('network'));

    const failed = renderStats();

    await waitFor(() => expect(failed.result.current.isLoading).toBe(false));

    // Consumers must be able to tell "unavailable" from a real (healthy) zero.
    expect(failed.result.current.isError).toBe(true);
    expect(failed.result.current.connectedServices).toBe(0);

    const recovered = renderStats();

    await waitFor(() =>
      expect(recovered.result.current.connectedServices).toBe(12)
    );

    expect(recovered.result.current.isError).toBe(false);
  });

  it('stays idle and not loading while disabled', () => {
    const { result } = renderHook(
      () => useIngestionPipelineStats({ enabled: false }),
      { wrapper: withQueryClient }
    );

    expect(result.current.isLoading).toBe(false);
    expect(mockGetServicesOverview).not.toHaveBeenCalled();
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

  const renderActive = async () => {
    const store = createRouteActivationStore();
    store.setActivePath(ROUTE);
    const view = renderHook(() => useIngestionPipelineStats(), {
      wrapper: withActivation(store),
    });
    await waitFor(() => expect(view.result.current.isLoading).toBe(false));

    return { ...view, store };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    window.sessionStorage.clear();
    mockGetServicesOverview.mockResolvedValue(
      overview({ databaseService: { success: 1 } }, [], 1)
    );
  });

  it('does not fetch again on activation while the cache is fresh', async () => {
    const { store } = await renderActive();

    act(() => jest.advanceTimersByTime(PIPELINE_STATS_TTL_MS - 1_000));
    act(() => store.bumpEpoch(ROUTE));

    expect(mockGetServicesOverview).toHaveBeenCalledTimes(1);
  });

  it('refetches on activation once the cache TTL has expired', async () => {
    const { store } = await renderActive();

    act(() => jest.advanceTimersByTime(PIPELINE_STATS_TTL_MS + 1_000));
    act(() => store.bumpEpoch(ROUTE));

    await waitFor(() =>
      expect(mockGetServicesOverview).toHaveBeenCalledTimes(2)
    );
  });

  it('force-refetches immediately on a websocket dirty signal, ignoring TTL', async () => {
    const { store } = await renderActive();

    act(() => store.markRouteDirty(ROUTE));

    await waitFor(() =>
      expect(mockGetServicesOverview).toHaveBeenCalledTimes(2)
    );
  });
});
