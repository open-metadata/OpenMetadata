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
import { CSV_JOBS_REFRESH_EVENT } from './CsvJobsTray.constants';

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
    // Restored here rather than at the end of the one test that fakes them, so a
    // failure mid-test cannot leak fake timers into the tests that follow.
    jest.clearAllTimers();
    jest.useRealTimers();
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
    jest.useFakeTimers();

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

    // Once nothing is active the timer must stop rather than poll forever.
    const callsAfterCompletion = mockGetCsvAsyncJobs.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(20000);
    });

    expect(mockGetCsvAsyncJobs).toHaveBeenCalledTimes(callsAfterCompletion);
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
