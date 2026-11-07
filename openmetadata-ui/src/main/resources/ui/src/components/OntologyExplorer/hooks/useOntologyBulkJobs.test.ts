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
const LIST_LIMIT = 100;

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

  it('passes the glossaryId to the API and uses the server-filtered response without further client-side filtering', async () => {
    mockListResolves([makeJob({ id: 1 }), makeJob({ id: 3 })]);

    const { result } = renderHook(() => useOntologyBulkJobs(GLOSSARY_ID));

    await waitFor(() => expect(result.current.jobs).toHaveLength(2));

    expect(mockList).toHaveBeenCalledWith(GLOSSARY_ID, LIST_LIMIT);
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

  it('starts polling when noteBackgroundSubmission is called even before an active job appears in the list', async () => {
    // Simulate a race: the list endpoint returns empty on the first refresh.
    mockListResolves([]);

    const { result } = renderHook(() => useOntologyBulkJobs(GLOSSARY_ID));

    await waitFor(() => expect(result.current.jobs).toEqual([]));

    expect(mockList).toHaveBeenCalledTimes(1);

    // The parent calls noteBackgroundSubmission after a background submission.
    act(() => {
      result.current.noteBackgroundSubmission(42);
    });

    // Polling should now be active even though no job is in the truncated list.
    await act(async () => {
      jest.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS);
    });

    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));

    // On the next poll the job finally appears as queued.
    mockListResolves([makeJob({ id: 42, status: Status.Queued })]);

    await act(async () => {
      jest.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS);
    });

    await waitFor(() => expect(result.current.jobs[0].id).toBe(42));
  });

  it('clears the pending flag once the submitted job appears so polling stops when the job finishes', async () => {
    // The list is initially empty, so the pending flag is the only thing
    // keeping polling alive after the background submission.
    mockListResolves([]);

    const { result } = renderHook(() => useOntologyBulkJobs(GLOSSARY_ID));

    await waitFor(() => expect(result.current.jobs).toEqual([]));

    act(() => {
      result.current.noteBackgroundSubmission(42);
    });

    // Polling runs while the job is not yet visible.
    await act(async () => {
      jest.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS);
    });

    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));

    // The job appears as running. The pending flag should clear, but polling
    // continues because the job itself is active.
    mockListResolves([makeJob({ id: 42, status: Status.Running })]);

    await act(async () => {
      jest.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS);
    });

    await waitFor(() => expect(result.current.jobs[0].id).toBe(42));

    // The job completes. With the pending flag already cleared, polling stops
    // because no job is active.
    mockListResolves([makeJob({ id: 42, status: Status.Completed })]);

    await act(async () => {
      jest.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS);
    });

    await waitFor(() =>
      expect(result.current.jobs[0].status).toBe(Status.Completed)
    );

    const callsAfterCompletion = mockList.mock.calls.length;

    await act(async () => {
      jest.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS * 3);
    });

    expect(mockList.mock.calls.length).toBe(callsAfterCompletion);
  });

  it('stops polling after the pending submission safety valve expires', async () => {
    mockListResolves([]);

    const { result } = renderHook(() => useOntologyBulkJobs(GLOSSARY_ID));

    await waitFor(() => expect(result.current.jobs).toEqual([]));

    act(() => {
      result.current.noteBackgroundSubmission();
    });

    // Polling runs while the safety valve is active.
    await act(async () => {
      jest.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS);
    });

    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));

    // Advance far past the 60s safety valve so it fires and clears the flag.
    await act(async () => {
      jest.advanceTimersByTime(70_000);
    });

    // Capture the call count after the safety valve has fired.
    const callsAfterExpiry = mockList.mock.calls.length;

    // No more polls should happen once the flag is cleared and no jobs are active.
    await act(async () => {
      jest.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS * 3);
    });

    expect(mockList.mock.calls.length).toBe(callsAfterExpiry);
  });

  it('clears the pending submission flag when the glossary changes', async () => {
    mockListResolves([makeJob({ id: 1, status: Status.Running })]);

    const { result, rerender } = renderHook(
      ({ id }) => useOntologyBulkJobs(id),
      { initialProps: { id: GLOSSARY_ID } }
    );

    await waitFor(() => expect(result.current.jobs).toHaveLength(1));

    act(() => {
      result.current.noteBackgroundSubmission(99);
    });

    // Switching glossaries clears the pending flag and fetches the new glossary.
    mockListResolves([]);
    rerender({ id: 'other-glossary' });

    await waitFor(() => expect(result.current.jobs).toEqual([]));

    const callsAfterSwitch = mockList.mock.calls.length;

    await act(async () => {
      jest.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS * 3);
    });

    // No active job and no pending flag for the new glossary → no polling.
    expect(mockList.mock.calls.length).toBe(callsAfterSwitch);
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
