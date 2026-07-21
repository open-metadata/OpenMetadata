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
import {
  OntologyBulkJob,
  Operation,
  Status,
} from '../../../generated/api/data/ontologyBulkJob';
import { DEFAULT_POLL_INTERVAL_MS } from '../../../hooks/usePollingEffect';
import {
  cancelOntologyBulkJob,
  listOntologyBulkJobs,
} from '../../../rest/ontologyAPI';
import { useOntologyBulkJobs } from './useOntologyBulkJobs';

jest.mock('../../../rest/ontologyAPI', () => ({
  cancelOntologyBulkJob: jest.fn(),
  listOntologyBulkJobs: jest.fn(),
}));

const mockList = listOntologyBulkJobs as jest.MockedFunction<
  typeof listOntologyBulkJobs
>;
const mockCancel = cancelOntologyBulkJob as jest.MockedFunction<
  typeof cancelOntologyBulkJob
>;

const GLOSSARY_ID = 'glossary-1';

const makeJob = (
  overrides: Partial<OntologyBulkJob> = {}
): OntologyBulkJob => ({
  createdAt: 1,
  createdBy: 'admin',
  dryRun: false,
  glossary: { id: GLOSSARY_ID, type: 'glossary' },
  id: 1,
  operation: Operation.CSVUpsert,
  progress: 100,
  status: Status.Completed,
  total: 10,
  updatedAt: 1,
  ...overrides,
});

const mockListResolves = (jobs: OntologyBulkJob[]): void => {
  mockList.mockResolvedValue({ jobs } as Awaited<
    ReturnType<typeof listOntologyBulkJobs>
  >);
};

describe('useOntologyBulkJobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockCancel.mockResolvedValue(makeJob({ status: Status.Cancelled }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('filters returned jobs to those matching the passed glossaryId', async () => {
    mockListResolves([
      makeJob({ id: 1, glossary: { id: GLOSSARY_ID, type: 'glossary' } }),
      makeJob({ id: 2, glossary: { id: 'other-glossary', type: 'glossary' } }),
      makeJob({ id: 3, glossary: { id: GLOSSARY_ID, type: 'glossary' } }),
    ]);

    const { result } = renderHook(() => useOntologyBulkJobs(GLOSSARY_ID));

    await waitFor(() => expect(result.current.jobs).toHaveLength(2));

    expect(result.current.jobs.map((job) => job.id)).toEqual([1, 3]);
    expect(result.current.hasLoadError).toBe(false);
  });

  it('sets hasLoadError when listOntologyBulkJobs rejects and does not throw', async () => {
    mockList.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useOntologyBulkJobs(GLOSSARY_ID));

    await waitFor(() => expect(result.current.hasLoadError).toBe(true));

    expect(result.current.jobs).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('clears jobs and skips the fetch when glossaryId is undefined', async () => {
    mockListResolves([makeJob()]);

    const { result } = renderHook(() => useOntologyBulkJobs(undefined));

    await waitFor(() => expect(result.current.jobs).toEqual([]));

    expect(mockList).not.toHaveBeenCalled();
  });

  it('polls only while at least one job is active', async () => {
    mockListResolves([makeJob({ status: Status.Running })]);

    const { result } = renderHook(() => useOntologyBulkJobs(GLOSSARY_ID));

    await waitFor(() => expect(result.current.jobs).toHaveLength(1));

    expect(mockList).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS);
    });

    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));

    mockListResolves([makeJob({ status: Status.Completed })]);

    await act(async () => {
      jest.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS);
    });

    await waitFor(() =>
      expect(result.current.jobs[0].status).toBe(Status.Completed)
    );

    const callsAfterSettling = mockList.mock.calls.length;

    await act(async () => {
      jest.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS * 3);
    });

    expect(mockList).toHaveBeenCalledTimes(callsAfterSettling);
  });

  it('cancels a job, then refreshes and always clears isCancelling', async () => {
    mockListResolves([makeJob({ id: 7, status: Status.Completed })]);

    const { result } = renderHook(() => useOntologyBulkJobs(GLOSSARY_ID));

    await waitFor(() => expect(result.current.jobs).toHaveLength(1));

    expect(mockList).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.cancelJob(7);
    });

    expect(mockCancel).toHaveBeenCalledWith(7);
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(result.current.isCancelling).toBe(false);
  });

  it('clears isCancelling in finally even when cancel rejects', async () => {
    mockListResolves([makeJob({ id: 9, status: Status.Running })]);
    mockCancel.mockRejectedValue(new Error('cancel failed'));

    const { result } = renderHook(() => useOntologyBulkJobs(GLOSSARY_ID));

    await waitFor(() => expect(result.current.jobs).toHaveLength(1));

    await act(async () => {
      await expect(result.current.cancelJob(9)).rejects.toThrow(
        'cancel failed'
      );
    });

    expect(result.current.isCancelling).toBe(false);
  });
});
