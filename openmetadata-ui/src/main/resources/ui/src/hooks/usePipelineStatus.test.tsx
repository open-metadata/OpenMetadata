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
import { StatusType } from '../generated/entity/data/pipeline';
import {
  LastRunStatus,
  PipelineSummary,
} from '../generated/type/pipelineSummary';
import { queryClient } from '../queryClient';
import { getPipelineStatus, listPipelineSummaries } from '../rest/pipelineAPI';
import {
  ALL_PIPELINES,
  PIPELINE_RUN_HISTORY_SIZE,
  PIPELINE_STATUS_PAGE_SIZE,
  usePipelineRunHistory,
  usePipelineStatus,
} from './usePipelineStatus';

jest.mock('../rest/pipelineAPI', () => ({
  getPipelineStatus: jest.fn(),
  listPipelineSummaries: jest.fn(),
}));

const mockList = listPipelineSummaries as jest.MockedFunction<
  typeof listPipelineSummaries
>;
const mockStatus = getPipelineStatus as jest.MockedFunction<
  typeof getPipelineStatus
>;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const pipeline = (name: string, lastRunStatus?: LastRunStatus) =>
  ({
    impactedAssetsCount: 0,
    lastRunStatus,
    pipelineFqn: `airflow.${name}`,
    pipelineId: `id-${name}`,
    pipelineName: name,
    serviceType: 'Airflow',
  } as PipelineSummary);

const page = (rows: PipelineSummary[], total = rows.length) =>
  ({ data: rows, paging: { total } } as never);

// The summary endpoint orders by name; these pages are what it would return
// for each status filter, and for none.
const PAGES: Record<string, ReturnType<typeof page>> = {
  [ALL_PIPELINES]: page(
    [
      pipeline('a_hourly', LastRunStatus.Successful),
      pipeline('b_never'),
      pipeline('c_running', LastRunStatus.Running),
    ],
    7
  ),
  [LastRunStatus.Failed]: page([pipeline('dim_user', LastRunStatus.Failed)], 2),
  [LastRunStatus.Skipped]: page([
    pipeline('dim_product', LastRunStatus.Skipped),
  ]),
  [LastRunStatus.Pending]: page([]),
  [LastRunStatus.Successful]: page([
    pipeline('a_hourly', LastRunStatus.Successful),
  ]),
};

describe('usePipelineStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    mockList.mockImplementation(async (params) =>
      params?.status ? PAGES[params.status] : PAGES[ALL_PIPELINES]
    );
  });

  it('counts each status from the server, not from the rows in hand', async () => {
    const { result } = renderHook(() => usePipelineStatus(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.counts).toEqual({
      [ALL_PIPELINES]: 7,
      [LastRunStatus.Failed]: 2,
      [LastRunStatus.Skipped]: 1,
      [LastRunStatus.Pending]: 0,
      [LastRunStatus.Successful]: 1,
    });
    expect(mockList).toHaveBeenCalledWith({
      limit: PIPELINE_STATUS_PAGE_SIZE,
      status: LastRunStatus.Failed,
    });
  });

  // Ordered by name, the unfiltered page would bury a failure under whatever
  // sorts first.
  it('ranks All by urgency, then fills in running and never-run pipelines', async () => {
    const { result } = renderHook(() => usePipelineStatus(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(
      result.current.rows[ALL_PIPELINES].map((row) => row.pipelineName)
    ).toEqual(['dim_user', 'dim_product', 'a_hourly', 'b_never', 'c_running']);
  });

  it('keeps each bucket’s own page', async () => {
    const { result } = renderHook(() => usePipelineStatus(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.rows[LastRunStatus.Failed]).toEqual([
      pipeline('dim_user', LastRunStatus.Failed),
    ]);
  });
});

describe('usePipelineRunHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it('reads recent runs per pipeline and orders them oldest first', async () => {
    mockStatus.mockResolvedValue({
      data: [
        { executionStatus: StatusType.Failed, timestamp: 3 },
        { executionStatus: StatusType.Successful, timestamp: 2 },
        { executionStatus: StatusType.Successful, timestamp: 1 },
      ],
    } as never);

    const { result } = renderHook(
      () => usePipelineRunHistory(['airflow.dim_user']),
      { wrapper }
    );

    await waitFor(() =>
      expect(result.current['airflow.dim_user']).toHaveLength(3)
    );

    expect(
      result.current['airflow.dim_user'].map((run) => run.timestamp)
    ).toEqual([1, 2, 3]);
    expect(mockStatus).toHaveBeenCalledWith(
      'airflow.dim_user',
      expect.objectContaining({ limit: PIPELINE_RUN_HISTORY_SIZE })
    );
  });

  it('gives a pipeline with no answer yet an empty history', () => {
    mockStatus.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => usePipelineRunHistory(['a.b']), {
      wrapper,
    });

    expect(result.current['a.b']).toEqual([]);
  });
});
