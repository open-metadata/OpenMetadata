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
import { getCsvAsyncJobResult } from '../../../rest/csvAPI';
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

    const exportBtn = await screen.findByText('label.export');

    await act(async () => {
      fireEvent.click(exportBtn);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Complete'));
    });

    expect(getCsvAsyncJobResult).toHaveBeenCalledWith(mockExportJob.jobId);

    await waitFor(() =>
      expect(downloadFile).toHaveBeenCalledWith(
        'name\nmetric_one',
        expect.stringContaining('.csv')
      )
    );
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
});
