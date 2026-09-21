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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReactNode } from 'react';
import { useWebSocketConnector } from '../../../../context/WebSocketProvider/WebSocketProvider';
import {
  cancelCsvAsyncJob,
  CsvAsyncJob,
  getCsvAsyncJobResult,
  getCsvAsyncJobs,
} from '../../../../rest/csvAPI';
import { CsvJobsTray } from './CsvJobsTray.component';
import {
  CSV_JOBS_POST_ACTION_REFRESH_MS,
  CSV_JOBS_REFRESH_EVENT,
  markCsvJobOwned,
} from './CsvJobsTray.constants';

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest
    .fn()
    .mockImplementation(
      ({
        children,
        className,
        onPress,
      }: {
        children?: ReactNode;
        className?: string;
        onPress?: () => void;
      }) => (
        <button className={className} type="button" onClick={onPress}>
          {children}
        </button>
      )
    ),
  // ToastUtils pulls `toast` from this package, so an incomplete mock makes any
  // error path throw instead of reporting.
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('../../../../context/WebSocketProvider/WebSocketProvider', () => ({
  useWebSocketConnector: jest.fn(),
}));

jest.mock('../../../../rest/csvAPI', () => ({
  cancelCsvAsyncJob: jest.fn(),
  getCsvAsyncJobResult: jest.fn(),
  getCsvAsyncJobs: jest.fn(),
}));

const mockSocket = {
  off: jest.fn(),
  on: jest.fn(),
} as unknown as ReturnType<typeof useWebSocketConnector>['socket'];

const mockGetCsvAsyncJobs = getCsvAsyncJobs as jest.MockedFunction<
  typeof getCsvAsyncJobs
>;
const mockCancelCsvAsyncJob = cancelCsvAsyncJob as jest.MockedFunction<
  typeof cancelCsvAsyncJob
>;
const mockGetCsvAsyncJobResult = getCsvAsyncJobResult as jest.MockedFunction<
  typeof getCsvAsyncJobResult
>;
const mockUseWebSocketConnector = useWebSocketConnector as jest.MockedFunction<
  typeof useWebSocketConnector
>;

const createJob = (overrides: Partial<CsvAsyncJob> = {}): CsvAsyncJob => ({
  createdBy: 'admin',
  entityType: 'metric',
  jobId: 'job-1',
  operation: 'EXPORT',
  progress: 100,
  result: 'name\nmetric',
  status: 'COMPLETED',
  total: 100,
  ...overrides,
});

const renderComponent = async () => {
  await act(async () => {
    render(<CsvJobsTray />);
    await Promise.resolve();
  });
};

describe('CsvJobsTray', () => {
  beforeEach(() => {
    mockUseWebSocketConnector.mockReturnValue({
      socket: mockSocket,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('hides terminal jobs returned on the initial fetch', async () => {
    mockGetCsvAsyncJobs.mockResolvedValue([
      createJob({ jobId: 'completed-job', status: 'COMPLETED' }),
      createJob({
        jobId: 'failed-job',
        operation: 'IMPORT',
        result: undefined,
        status: 'FAILED',
      }),
    ]);

    await renderComponent();

    await waitFor(() => expect(mockGetCsvAsyncJobs).toHaveBeenCalledTimes(1));

    expect(
      screen.queryByText('label.background-job-plural')
    ).not.toBeInTheDocument();
  });

  // A fast export can finish before the tray's first fetch resolves, so the job
  // is already terminal on that fetch and would otherwise be hidden as "stale".
  // Because the user just started it (it is marked owned), it must be surfaced
  // and the tray must auto-open for the download.
  it('surfaces an owned job that is already terminal on the initial fetch', async () => {
    markCsvJobOwned('owned-fast-job');

    mockGetCsvAsyncJobs.mockResolvedValue([
      createJob({ jobId: 'owned-fast-job', status: 'COMPLETED' }),
    ]);

    await renderComponent();

    await waitFor(() => expect(mockGetCsvAsyncJobs).toHaveBeenCalledTimes(1));

    expect(
      await screen.findByText('label.background-job-plural')
    ).toBeInTheDocument();
    expect(
      screen.getByText('label.exported-entity-plural')
    ).toBeInTheDocument();
  });

  // Regression: after Clear completed the tray must collapse, a freshly started
  // job must not reuse the old open state and pop the popover while still
  // running, and the tray must auto-open again once that job finishes — instead
  // of leaving the user stuck on the "N running" launcher.
  it('collapses on clear and re-opens only when the next job finishes', async () => {
    mockGetCsvAsyncJobs
      .mockResolvedValueOnce([
        createJob({
          jobId: 'job-a',
          progress: 20,
          result: undefined,
          status: 'RUNNING',
        }),
      ])
      .mockResolvedValueOnce([
        createJob({ jobId: 'job-a', status: 'COMPLETED' }),
      ])
      .mockResolvedValueOnce([
        createJob({ jobId: 'job-a', status: 'COMPLETED' }),
        createJob({
          jobId: 'job-b',
          progress: 10,
          result: undefined,
          status: 'RUNNING',
        }),
      ])
      .mockResolvedValue([
        createJob({ jobId: 'job-a', status: 'COMPLETED' }),
        createJob({ jobId: 'job-b', status: 'COMPLETED' }),
      ]);

    await renderComponent();

    // Job A finishes -> tray auto-opens.
    await act(async () => {
      window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
    });

    expect(
      await screen.findByText('label.background-job-plural')
    ).toBeInTheDocument();

    // Clear completed empties the tray -> it collapses.
    fireEvent.click(screen.getByText('label.clear-completed'));

    await waitFor(() =>
      expect(
        screen.queryByText('label.background-job-plural')
      ).not.toBeInTheDocument()
    );

    // A newly started job must surface as the launcher, not reopen the popover.
    await act(async () => {
      window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
    });

    expect(
      await screen.findByText('label.count-jobs-running')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('label.background-job-plural')
    ).not.toBeInTheDocument();

    // Once it finishes, the tray auto-opens even though it was minimised.
    await act(async () => {
      window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
    });

    expect(
      await screen.findByText('label.background-job-plural')
    ).toBeInTheDocument();
  });

  // Many sources fetch concurrently (mount, refresh event, sockets, poll). A
  // slow older fetch resolving after a newer one must not overwrite the fresher
  // state and flip a completed job back to running.
  it('ignores a stale fetch that resolves after a newer one', async () => {
    let resolveSlow: (jobs: CsvAsyncJob[]) => void = () => undefined;
    let resolveFast: (jobs: CsvAsyncJob[]) => void = () => undefined;

    mockGetCsvAsyncJobs
      .mockResolvedValueOnce([
        createJob({
          jobId: 'job-1',
          progress: 20,
          result: undefined,
          status: 'RUNNING',
        }),
      ])
      .mockImplementationOnce(
        () =>
          new Promise<CsvAsyncJob[]>((resolve) => {
            resolveSlow = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<CsvAsyncJob[]>((resolve) => {
            resolveFast = resolve;
          })
      );

    await renderComponent();

    // Two concurrent refreshes: the second (newer) fetch is the one that wins.
    await act(async () => {
      window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
      window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
    });

    await act(async () => {
      // eslint-disable-next-line sonarjs/no-extra-arguments -- deferred test resolver
      resolveFast([createJob({ jobId: 'job-1', status: 'COMPLETED' })]);
    });

    // Older fetch resolves later with the stale RUNNING snapshot — ignored.
    await act(async () => {
      // eslint-disable-next-line sonarjs/no-extra-arguments -- deferred test resolver
      resolveSlow([
        createJob({
          jobId: 'job-1',
          progress: 20,
          result: undefined,
          status: 'RUNNING',
        }),
      ]);
    });

    expect(
      await screen.findByText('label.exported-entity-plural')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('label.count-jobs-running')
    ).not.toBeInTheDocument();
  });

  it('keeps an initially active job visible after it completes', async () => {
    mockGetCsvAsyncJobs
      .mockResolvedValueOnce([
        createJob({
          jobId: 'running-job',
          progress: 20,
          result: undefined,
          status: 'RUNNING',
        }),
      ])
      .mockResolvedValueOnce([
        createJob({ jobId: 'running-job', status: 'COMPLETED' }),
      ]);

    await renderComponent();

    expect(
      await screen.findByText('label.count-jobs-running')
    ).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
    });

    expect(
      await screen.findByText('label.background-job-plural')
    ).toBeInTheDocument();

    expect(
      await screen.findByText('label.exported-entity-plural')
    ).toBeInTheDocument();
  });

  it('shows a terminal job discovered after the initial fetch', async () => {
    mockGetCsvAsyncJobs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        createJob({ jobId: 'new-completed-job', status: 'COMPLETED' }),
      ]);

    await renderComponent();

    await waitFor(() => expect(mockGetCsvAsyncJobs).toHaveBeenCalledTimes(1));

    expect(
      screen.queryByText('label.background-job-plural')
    ).not.toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
    });

    expect(
      await screen.findByText('label.background-job-plural')
    ).toBeInTheDocument();
  });

  it('cancels an active job from the tray', async () => {
    mockGetCsvAsyncJobs.mockResolvedValue([
      createJob({
        jobId: 'running-job',
        progress: 20,
        result: undefined,
        status: 'RUNNING',
      }),
    ]);
    mockCancelCsvAsyncJob.mockResolvedValue(
      createJob({
        jobId: 'running-job',
        result: undefined,
        status: 'CANCELLED',
      })
    );

    await renderComponent();

    fireEvent.click(await screen.findByText('label.count-jobs-running'));
    fireEvent.click(screen.getByRole('button', { name: 'label.cancel' }));

    await waitFor(() =>
      expect(mockCancelCsvAsyncJob).toHaveBeenCalledWith('running-job')
    );
  });

  it('downloads completed export results from the tray', async () => {
    const createObjectURL = jest.fn().mockReturnValue('blob:csv-job');
    const revokeObjectURL = jest.fn();

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });

    mockGetCsvAsyncJobs.mockResolvedValueOnce([]).mockResolvedValueOnce([
      createJob({
        jobId: 'completed-export-job',
        status: 'COMPLETED',
      }),
    ]);
    mockGetCsvAsyncJobResult.mockResolvedValueOnce('name\nmetric');

    await renderComponent();

    await act(async () => {
      window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
    });

    fireEvent.click(await screen.findByText('label.background-job-plural'));
    fireEvent.click(screen.getByRole('button', { name: 'label.download' }));

    await waitFor(() =>
      expect(mockGetCsvAsyncJobResult).toHaveBeenCalledWith(
        'completed-export-job'
      )
    );

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv-job');
  });

  // The completion websocket event only reaches sockets held by the server that
  // ran the job, so on a multi-server deployment it is often delivered to a peer.
  // Polling is what actually keeps the tray truthful.
  it('polls for job updates while a job is active, without a websocket event', async () => {
    mockGetCsvAsyncJobs
      .mockResolvedValueOnce([
        createJob({
          jobId: 'running-job',
          progress: 20,
          result: undefined,
          status: 'RUNNING',
        }),
      ])
      .mockResolvedValue([
        createJob({ jobId: 'running-job', status: 'COMPLETED' }),
      ]);

    await act(async () => {
      render(<CsvJobsTray />);
    });

    expect(mockGetCsvAsyncJobs).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockGetCsvAsyncJobs).toHaveBeenCalledTimes(2);
    expect(screen.getByText('label.background-job-plural')).toBeInTheDocument();

    // Once nothing is active the loop must stop rather than poll forever.
    const callsAfterCompletion = mockGetCsvAsyncJobs.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(20000);
    });

    expect(mockGetCsvAsyncJobs).toHaveBeenCalledTimes(callsAfterCompletion);
  });

  it('auto-opens an owned export for download via polling alone on multi-pod', async () => {
    const multipodExportJobId = 'multipod-export-job';
    markCsvJobOwned(multipodExportJobId);

    mockGetCsvAsyncJobs
      .mockResolvedValueOnce([
        createJob({
          jobId: multipodExportJobId,
          progress: 20,
          result: undefined,
          status: 'RUNNING',
        }),
      ])
      .mockResolvedValue([
        createJob({ jobId: multipodExportJobId, status: 'COMPLETED' }),
      ]);

    await act(async () => {
      render(<CsvJobsTray />);
    });

    expect(
      await screen.findByText('label.count-jobs-running')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'label.download' })
    ).not.toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(
      screen.getByRole('button', { name: 'label.download' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('label.exported-entity-plural')
    ).toBeInTheDocument();
  });

  it('fires a follow-up fetch after a refresh event to catch a late-registering job', async () => {
    mockGetCsvAsyncJobs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        createJob({
          jobId: 'late-job',
          progress: 10,
          result: undefined,
          status: 'RUNNING',
        }),
      ]);

    await renderComponent();

    await act(async () => {
      window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
    });

    expect(
      screen.queryByText('label.count-jobs-running')
    ).not.toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(CSV_JOBS_POST_ACTION_REFRESH_MS);
    });

    expect(
      await screen.findByText('label.count-jobs-running')
    ).toBeInTheDocument();
  });

  it('stays closed after the user minimises an auto-opened job', async () => {
    markCsvJobOwned('minimise-job');
    mockGetCsvAsyncJobs.mockResolvedValue([
      createJob({ jobId: 'minimise-job', status: 'COMPLETED' }),
    ]);

    await renderComponent();

    expect(
      await screen.findByRole('button', { name: 'label.download' })
    ).toBeInTheDocument();

    fireEvent.click(
      document.querySelector('.csv-jobs-tray-close') as HTMLElement
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'label.download' })
      ).not.toBeInTheDocument()
    );

    await act(async () => {
      window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
    });

    expect(
      screen.queryByRole('button', { name: 'label.download' })
    ).not.toBeInTheDocument();
  });

  it('auto-opens for a failed job discovered after the initial fetch', async () => {
    mockGetCsvAsyncJobs.mockResolvedValueOnce([]).mockResolvedValue([
      createJob({
        error: 'Boom',
        jobId: 'failed-job',
        operation: 'IMPORT',
        result: undefined,
        status: 'FAILED',
      }),
    ]);

    await renderComponent();

    await act(async () => {
      window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
    });

    expect(
      await screen.findByText('label.clear-completed')
    ).toBeInTheDocument();
  });

  // The poll is self-scheduling rather than a fixed interval, so a response
  // slower than the interval cannot stack up concurrent requests.
  it('does not start another poll while one is still in flight', async () => {
    let resolveSlowFetch: (jobs: CsvAsyncJob[]) => void = () => undefined;
    mockGetCsvAsyncJobs
      .mockResolvedValueOnce([
        createJob({
          jobId: 'slow-job',
          progress: 20,
          result: undefined,
          status: 'RUNNING',
        }),
      ])
      .mockImplementationOnce(
        () =>
          new Promise<CsvAsyncJob[]>((resolve) => {
            resolveSlowFetch = resolve;
          })
      );

    await act(async () => {
      render(<CsvJobsTray />);
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockGetCsvAsyncJobs).toHaveBeenCalledTimes(2);

    // Three further intervals elapse while the second poll is unresolved.
    await act(async () => {
      jest.advanceTimersByTime(15000);
    });

    expect(mockGetCsvAsyncJobs).toHaveBeenCalledTimes(2);

    await act(async () => {
      // eslint-disable-next-line sonarjs/no-extra-arguments -- deferred test resolver
      resolveSlowFetch([createJob({ jobId: 'slow-job', status: 'COMPLETED' })]);
    });
  });

  it('marks a job undownloadable when its result is gone', async () => {
    // Reset rather than clear: clearAllMocks keeps implementations, so a queued
    // mock left by an earlier test would still answer here. Opening the tray
    // re-fetches, so the job mock has to be persistent rather than queued.
    mockGetCsvAsyncJobs.mockReset();
    mockGetCsvAsyncJobResult.mockReset();
    mockGetCsvAsyncJobs.mockResolvedValueOnce([]).mockResolvedValue([
      createJob({
        jobId: 'expired-export-job',
        status: 'COMPLETED',
      }),
    ]);
    mockGetCsvAsyncJobResult.mockRejectedValue({
      response: { status: 404 },
    });

    await renderComponent();

    await act(async () => {
      window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
    });

    fireEvent.click(await screen.findByText('label.background-job-plural'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.download' }));
    });

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'label.download' })
      ).not.toBeInTheDocument()
    );
  });
});
