/*
 *  Copyright 2023 Collate.
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
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ExportTypes } from '../../../constants/Export.constants';
import {
  CsvAsyncJob,
  getCsvAsyncJob,
  getCsvAsyncJobResult,
} from '../../../rest/csvAPI';
import { downloadFile } from '../../../utils/Export/ExportUtils';
import {
  EntityExportModalProvider,
  useEntityExportModalProvider,
} from './EntityExportModalProvider.component';
import { ExportData } from './EntityExportModalProvider.interface';

const mockExportJob = {
  jobId: '123456',
  message: 'Export initiated successfyully',
};

const createDeferredExport = () => {
  let resolve: (value: typeof mockExportJob) => void = () => undefined;
  const promise = new Promise<typeof mockExportJob>((resolver) => {
    resolve = resolver;
  });

  return { promise, resolve };
};

// Multi-type export keeps the modal (the type picker is needed for image/PDF);
// a CSV-only export now skips the modal and runs into the tray instead.
const mockShowModal: ExportData = {
  name: 'test',
  exportTypes: [ExportTypes.CSV, ExportTypes.PNG],
  onExport: jest.fn().mockImplementation(() => Promise.resolve(mockExportJob)),
};

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockImplementation(() => ({
    pathname: '/mock-path',
  })),
}));

jest.mock('../../../rest/csvAPI', () => ({
  getCsvAsyncJob: jest.fn(),
  getCsvAsyncJobResult: jest.fn(),
}));

jest.mock('../../../utils/Export/ExportUtils', () => ({
  downloadFile: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const ConsumerComponent = () => {
  const { showModal } = useEntityExportModalProvider();

  return <button onClick={() => showModal(mockShowModal)}>Manage</button>;
};

const WebsocketConsumerComponent = () => {
  const { showModal, onUpdateCSVExportJob } = useEntityExportModalProvider();

  return (
    <>
      <button onClick={() => showModal(mockShowModal)}>Manage</button>
      <button
        onClick={() =>
          onUpdateCSVExportJob({
            jobId: mockExportJob.jobId,
            status: 'COMPLETED',
          })
        }>
        Complete
      </button>
      <button
        onClick={() =>
          onUpdateCSVExportJob({
            data: null,
            jobId: mockExportJob.jobId,
            status: 'COMPLETED',
          })
        }>
        Complete with null data
      </button>
    </>
  );
};

const JobCorrelationConsumer = ({
  onExport,
}: {
  onExport: ExportData['onExport'];
}) => {
  const { triggerExportForBulkEdit, onUpdateCSVExportJob, csvExportData } =
    useEntityExportModalProvider();

  return (
    <>
      <button
        onClick={() =>
          triggerExportForBulkEdit({
            name: 'correlated-export',
            exportTypes: [ExportTypes.CSV],
            onExport,
          })
        }>
        Start correlated export
      </button>
      <button
        onClick={() =>
          onUpdateCSVExportJob({
            jobId: 'unrelated-job',
            status: 'COMPLETED',
            data: 'unrelated,data',
          })
        }>
        Complete unrelated job
      </button>
      <button
        onClick={() =>
          onUpdateCSVExportJob({
            jobId: mockExportJob.jobId,
            status: 'COMPLETED',
            data: 'matching,data',
          })
        }>
        Complete matching job
      </button>
      <div data-testid="correlated-export-data">{csvExportData ?? ''}</div>
    </>
  );
};

const PollingConsumer = ({
  onError,
  onExport,
}: {
  onError?: () => void;
  onExport: ExportData['onExport'];
}) => {
  const { csvExportData, csvExportError, triggerExportForBulkEdit } =
    useEntityExportModalProvider();

  return (
    <>
      <button
        onClick={() =>
          triggerExportForBulkEdit({
            name: 'polled-export',
            exportTypes: [ExportTypes.CSV],
            onError,
            onExport,
          })
        }>
        Start polled export
      </button>
      <div data-testid="polled-export-data">{csvExportData ?? ''}</div>
      <div data-testid="polled-export-error">{csvExportError ?? ''}</div>
    </>
  );
};

const triggerIdentityLog: unknown[] = [];
const showModalIdentityLog: unknown[] = [];

const IdentityConsumerComponent = ({ onExport }: { onExport: jest.Mock }) => {
  const { triggerExportForBulkEdit, showModal, onUpdateCSVExportJob } =
    useEntityExportModalProvider();

  triggerIdentityLog.push(triggerExportForBulkEdit);
  showModalIdentityLog.push(showModal);

  return (
    <>
      <button
        onClick={() =>
          triggerExportForBulkEdit({
            name: 'g1',
            onExport,
            exportTypes: [ExportTypes.CSV],
          })
        }>
        Trigger
      </button>
      <button
        onClick={() =>
          onUpdateCSVExportJob({
            jobId: mockExportJob.jobId,
            status: 'COMPLETED',
            data: 'name\nterm_one',
          })
        }>
        Complete
      </button>
    </>
  );
};

describe('EntityExportModalProvider component', () => {
  it('Component should render', async () => {
    render(
      <EntityExportModalProvider>
        <ConsumerComponent />
      </EntityExportModalProvider>
    );

    expect(await screen.findByText('Manage')).toBeInTheDocument();
  });

  it('Export modal should be visible', async () => {
    render(
      <EntityExportModalProvider>
        <ConsumerComponent />
      </EntityExportModalProvider>
    );

    const manageBtn = await screen.findByText('Manage');

    expect(manageBtn).toBeInTheDocument();

    fireEvent.click(manageBtn);

    expect(
      await screen.findByTestId('export-entity-modal')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('file-name-input')).toBeInTheDocument();
  });

  it('Title should be visible, if provided', async () => {
    mockShowModal.title = 'Modal dummy title';
    render(
      <EntityExportModalProvider>
        <ConsumerComponent />
      </EntityExportModalProvider>
    );

    const manageBtn = await screen.findByText('Manage');

    expect(manageBtn).toBeInTheDocument();

    fireEvent.click(manageBtn);

    expect(await screen.findByText(mockShowModal.title)).toBeInTheDocument();
  });

  it('Export modal cancel button should remove modal', async () => {
    render(
      <EntityExportModalProvider>
        <ConsumerComponent />
      </EntityExportModalProvider>
    );

    const manageBtn = await screen.findByText('Manage');

    expect(manageBtn).toBeInTheDocument();

    fireEvent.click(manageBtn);

    expect(
      await screen.findByTestId('export-entity-modal')
    ).toBeInTheDocument();

    const cancelBtn = await screen.findByText('label.cancel');

    expect(cancelBtn).toBeInTheDocument();

    fireEvent.click(cancelBtn);

    expect(screen.queryByTestId('export-entity-modal')).not.toBeInTheDocument();
  });

  it('Export button should call API', async () => {
    mockShowModal.title = 'Modal dummy title';
    global.URL.createObjectURL = jest.fn();
    global.URL.revokeObjectURL = jest.fn();

    render(
      <EntityExportModalProvider>
        <ConsumerComponent />
      </EntityExportModalProvider>
    );

    const manageBtn = await screen.findByText('Manage');

    expect(manageBtn).toBeInTheDocument();

    fireEvent.click(manageBtn);

    const entityModal = await screen.findByTestId('export-entity-modal');

    expect(entityModal).toBeInTheDocument();

    const exportBtn = await screen.findByText('label.export');

    expect(exportBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(exportBtn);
    });

    expect(mockShowModal.onExport).toHaveBeenCalledWith(mockShowModal.name, {
      recursive: true,
    });

    expect(await screen.findByText(mockExportJob.message)).toBeInTheDocument();
  });

  it('Completion event without payload downloads the CSV from the job result endpoint', async () => {
    (getCsvAsyncJobResult as jest.Mock).mockResolvedValueOnce(
      'name\nmetric_one'
    );

    render(
      <EntityExportModalProvider>
        <WebsocketConsumerComponent />
      </EntityExportModalProvider>
    );

    fireEvent.click(await screen.findByText('Manage'));

    const exportBtn = await screen.findByTestId('submit-button');

    await act(async () => {
      fireEvent.click(exportBtn);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Complete'));
    });

    expect(getCsvAsyncJobResult).toHaveBeenCalledWith(
      mockExportJob.jobId,
      expect.objectContaining({ aborted: expect.any(Boolean) })
    );

    await waitFor(() =>
      expect(downloadFile).toHaveBeenCalledWith(
        'name\nmetric_one',
        expect.stringContaining('.csv')
      )
    );
  });

  it('Completion event with null data downloads the CSV from the job result endpoint', async () => {
    (getCsvAsyncJobResult as jest.Mock).mockResolvedValueOnce(
      'name\nmetric_one'
    );

    render(
      <EntityExportModalProvider>
        <WebsocketConsumerComponent />
      </EntityExportModalProvider>
    );

    fireEvent.click(await screen.findByText('Manage'));

    const exportBtn = await screen.findByTestId('submit-button');

    await act(async () => {
      fireEvent.click(exportBtn);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Complete with null data'));
    });

    expect(getCsvAsyncJobResult).toHaveBeenCalledWith(
      mockExportJob.jobId,
      expect.objectContaining({ aborted: expect.any(Boolean) })
    );

    await waitFor(() =>
      expect(downloadFile).toHaveBeenCalledWith(
        'name\nmetric_one',
        expect.stringContaining('.csv')
      )
    );
  });

  it('ignores an unrelated completion after the active export job is known', async () => {
    (useLocation as jest.Mock).mockReturnValue({ pathname: '/bulk/edit' });
    const exportRequest = createDeferredExport();
    const onExport = jest.fn().mockReturnValue(exportRequest.promise);

    render(
      <EntityExportModalProvider>
        <JobCorrelationConsumer onExport={onExport} />
      </EntityExportModalProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Start correlated export'));
    });

    await waitFor(() => expect(onExport).toHaveBeenCalledTimes(1));

    await act(async () => {
      exportRequest.resolve(mockExportJob);
      await exportRequest.promise;
    });

    fireEvent.click(screen.getByText('Complete unrelated job'));

    expect(screen.getByTestId('correlated-export-data')).toBeEmptyDOMElement();

    fireEvent.click(screen.getByText('Complete matching job'));

    await waitFor(() =>
      expect(screen.getByTestId('correlated-export-data')).toHaveTextContent(
        'matching,data'
      )
    );
  });

  it('processes a matching completion buffered before the export job resolves', async () => {
    (useLocation as jest.Mock).mockReturnValue({ pathname: '/bulk/edit' });
    const exportRequest = createDeferredExport();
    const onExport = jest.fn().mockReturnValue(exportRequest.promise);

    render(
      <EntityExportModalProvider>
        <JobCorrelationConsumer onExport={onExport} />
      </EntityExportModalProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Start correlated export'));
    });

    await waitFor(() => expect(onExport).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('Complete matching job'));

    expect(screen.getByTestId('correlated-export-data')).toBeEmptyDOMElement();

    await act(async () => {
      exportRequest.resolve(mockExportJob);
      await exportRequest.promise;
    });

    await waitFor(() =>
      expect(screen.getByTestId('correlated-export-data')).toHaveTextContent(
        'matching,data'
      )
    );
  });

  it('recovers a completion that happened before the WebSocket subscription', async () => {
    (useLocation as jest.Mock).mockReturnValue({ pathname: '/bulk/edit' });
    const onExport = jest.fn().mockResolvedValue(mockExportJob);
    const completedJob: CsvAsyncJob = {
      createdBy: 'admin',
      entityType: 'database',
      jobId: mockExportJob.jobId,
      operation: 'EXPORT',
      status: 'COMPLETED',
    };
    (getCsvAsyncJob as jest.Mock).mockResolvedValueOnce(completedJob);
    (getCsvAsyncJobResult as jest.Mock).mockResolvedValueOnce(
      'name\npolled-result'
    );

    render(
      <EntityExportModalProvider>
        <PollingConsumer onExport={onExport} />
      </EntityExportModalProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Start polled export'));
    });

    await waitFor(() =>
      expect(getCsvAsyncJob).toHaveBeenCalledWith(
        mockExportJob.jobId,
        expect.objectContaining({ aborted: expect.any(Boolean) })
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId('polled-export-data')).toHaveTextContent(
        'name polled-result'
      )
    );
  });

  it.each(['FAILED', 'CANCELLED'] as const)(
    'stops a bulk-edit export when polling observes %s',
    async (status) => {
      (useLocation as jest.Mock).mockReturnValue({ pathname: '/bulk/edit' });
      const onError = jest.fn();
      const onExport = jest.fn().mockResolvedValue(mockExportJob);
      const terminalJob: CsvAsyncJob = {
        createdBy: 'admin',
        entityType: 'database',
        error: 'sensitive backend detail',
        jobId: mockExportJob.jobId,
        operation: 'EXPORT',
        status,
      };
      (getCsvAsyncJob as jest.Mock).mockResolvedValueOnce(terminalJob);

      render(
        <EntityExportModalProvider>
          <PollingConsumer onError={onError} onExport={onExport} />
        </EntityExportModalProvider>
      );

      await act(async () => {
        fireEvent.click(screen.getByText('Start polled export'));
      });

      await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

      expect(screen.getByTestId('polled-export-error')).toHaveTextContent(
        'message.unexpected-error'
      );
      expect(screen.getByTestId('polled-export-error')).not.toHaveTextContent(
        'sensitive backend detail'
      );
    }
  );

  it('fails a bulk-edit export when status requests repeatedly time out', async () => {
    jest.useFakeTimers();

    try {
      (useLocation as jest.Mock).mockReturnValue({ pathname: '/bulk/edit' });
      const onError = jest.fn();
      const onExport = jest.fn().mockResolvedValue(mockExportJob);
      (getCsvAsyncJob as jest.Mock).mockImplementation(
        () => new Promise<CsvAsyncJob>(() => undefined)
      );

      render(
        <EntityExportModalProvider>
          <PollingConsumer onError={onError} onExport={onExport} />
        </EntityExportModalProvider>
      );

      await act(async () => {
        fireEvent.click(screen.getByText('Start polled export'));
      });

      const retryIntervals = [1_000, 2_000, 4_000, 8_000, 10_000];

      for (let failedRequest = 0; failedRequest < 6; failedRequest++) {
        await act(async () => {
          jest.advanceTimersByTime(5_000);
        });

        const retryInterval = retryIntervals[failedRequest];
        if (retryInterval) {
          await act(async () => {
            jest.advanceTimersByTime(retryInterval);
          });
        }
      }

      expect(getCsvAsyncJob).toHaveBeenCalledTimes(6);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('polled-export-error')).toHaveTextContent(
        'message.unexpected-error'
      );
    } finally {
      (getCsvAsyncJob as jest.Mock).mockReset();
      jest.useRealTimers();
    }
  });

  it('keeps polling a healthy export beyond the former thirty-minute limit', async () => {
    jest.useFakeTimers();

    try {
      (useLocation as jest.Mock).mockReturnValue({ pathname: '/bulk/edit' });
      const onError = jest.fn();
      const onExport = jest.fn().mockResolvedValue(mockExportJob);
      const runningJob: CsvAsyncJob = {
        createdBy: 'admin',
        entityType: 'database',
        jobId: mockExportJob.jobId,
        operation: 'EXPORT',
        status: 'RUNNING',
      };
      (getCsvAsyncJob as jest.Mock).mockResolvedValue(runningJob);

      const { unmount } = render(
        <EntityExportModalProvider>
          <PollingConsumer onError={onError} onExport={onExport} />
        </EntityExportModalProvider>
      );

      await act(async () => {
        fireEvent.click(screen.getByText('Start polled export'));
      });

      for (let pollAttempt = 1; pollAttempt <= 183; pollAttempt++) {
        const intervalMs = Math.min(1_000 * 2 ** (pollAttempt - 1), 10_000);
        await act(async () => {
          jest.advanceTimersByTime(intervalMs);
        });
      }

      expect(getCsvAsyncJob).toHaveBeenCalledTimes(184);
      expect(onError).not.toHaveBeenCalled();
      expect(screen.getByTestId('polled-export-error')).toBeEmptyDOMElement();

      unmount();
    } finally {
      (getCsvAsyncJob as jest.Mock).mockReset();
      jest.useRealTimers();
    }
  });

  it('aborts status polling when the provider unmounts', async () => {
    (useLocation as jest.Mock).mockReturnValue({ pathname: '/bulk/edit' });
    const onExport = jest.fn().mockResolvedValue(mockExportJob);
    let pollingSignal: AbortSignal | undefined;
    (getCsvAsyncJob as jest.Mock).mockImplementationOnce(
      (_jobId: string, signal: AbortSignal) => {
        pollingSignal = signal;

        return new Promise(() => undefined);
      }
    );

    const { unmount } = render(
      <EntityExportModalProvider>
        <PollingConsumer onExport={onExport} />
      </EntityExportModalProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Start polled export'));
    });

    await waitFor(() => expect(pollingSignal).toBeDefined());

    unmount();

    expect(pollingSignal?.aborted).toBe(true);
  });

  it('Export modal should not be visible if route is bulk edit', async () => {
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/bulk/edit',
    });
    render(
      <EntityExportModalProvider>
        <ConsumerComponent />
      </EntityExportModalProvider>
    );

    const manageBtn = await screen.findByText('Manage');

    fireEvent.click(manageBtn);

    expect(screen.queryByTestId('export-entity-modal')).not.toBeInTheDocument();
  });

  it('should keep bulk-edit export callbacks stable across csvExportData updates', async () => {
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/bulk/edit',
    });
    triggerIdentityLog.length = 0;
    showModalIdentityLog.length = 0;
    const onExport = jest
      .fn()
      .mockImplementation(() => Promise.resolve(mockExportJob));

    render(
      <EntityExportModalProvider>
        <IdentityConsumerComponent onExport={onExport} />
      </EntityExportModalProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Trigger'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Complete'));
    });

    expect(new Set(triggerIdentityLog).size).toBe(1);
    expect(new Set(showModalIdentityLog).size).toBe(1);
  });

  it('should call onError when a bulk-edit export fails', async () => {
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/bulk/edit',
    });
    const onError = jest.fn();
    const onExport = jest
      .fn()
      .mockImplementation(() => Promise.reject(new Error('export failed')));

    const FailingConsumer = () => {
      const { triggerExportForBulkEdit } = useEntityExportModalProvider();

      useEffect(() => {
        triggerExportForBulkEdit({
          name: 'g1',
          onExport,
          exportTypes: [ExportTypes.CSV],
          onError,
        });
      }, [triggerExportForBulkEdit]);

      return null;
    };

    render(
      <EntityExportModalProvider>
        <FailingConsumer />
      </EntityExportModalProvider>
    );

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });

  it('should run a CSV-only export into the tray without opening the modal', async () => {
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/mock-path',
    });
    const onExport = jest.fn().mockResolvedValue(mockExportJob);
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');

    const CsvOnlyConsumer = () => {
      const { showModal } = useEntityExportModalProvider();

      return (
        <button
          onClick={() =>
            showModal({
              name: 'g1',
              onExport,
              exportTypes: [ExportTypes.CSV],
            })
          }>
          Export
        </button>
      );
    };

    render(
      <EntityExportModalProvider>
        <CsvOnlyConsumer />
      </EntityExportModalProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Export'));
    });

    expect(onExport).toHaveBeenCalledWith('g1', { recursive: true });
    expect(screen.queryByTestId('export-entity-modal')).not.toBeInTheDocument();

    await waitFor(() =>
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'csv-jobs-refresh' })
      )
    );

    dispatchSpy.mockRestore();
  });

  it('should notify onError and show a generic error when a bulk-edit export job fails', async () => {
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/bulk/edit',
    });
    const onExport = jest.fn().mockResolvedValue(mockExportJob);
    const onError = jest.fn();

    const ErrorConsumer = () => {
      const { triggerExportForBulkEdit, onUpdateCSVExportJob, csvExportError } =
        useEntityExportModalProvider();

      return (
        <>
          <button
            onClick={() =>
              triggerExportForBulkEdit({
                name: 'g1',
                onExport,
                exportTypes: [ExportTypes.CSV],
                onError,
              })
            }>
            Trigger
          </button>
          <button
            onClick={() =>
              onUpdateCSVExportJob({
                jobId: mockExportJob.jobId,
                status: 'FAILED',
                error: 'sensitive backend detail',
              })
            }>
            Fail
          </button>
          <div data-testid="export-error">{csvExportError ?? ''}</div>
        </>
      );
    };

    render(
      <EntityExportModalProvider>
        <ErrorConsumer />
      </EntityExportModalProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Trigger'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Fail'));
    });

    expect(onError).toHaveBeenCalledTimes(1);
    // The raw backend error must not leak into the UI; a generic message shows.
    expect(screen.getByTestId('export-error')).toHaveTextContent(
      'message.unexpected-error'
    );
    expect(screen.getByTestId('export-error')).not.toHaveTextContent(
      'sensitive backend detail'
    );
  });
});
