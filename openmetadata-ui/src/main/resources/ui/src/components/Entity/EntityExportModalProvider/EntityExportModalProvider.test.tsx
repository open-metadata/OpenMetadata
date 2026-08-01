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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { ExportTypes } from '../../../constants/Export.constants';
import {
  EntityExportModalProvider,
  useEntityExportModalProvider,
} from './EntityExportModalProvider.component';
import { ExportData } from './EntityExportModalProvider.interface';

const mockExportJob = {
  jobId: '123456',
  message: 'Export initiated successfyully',
};

const mockShowModal: ExportData = {
  name: 'test',
  exportTypes: [ExportTypes.CSV],
  onExport: jest.fn().mockImplementation(() => Promise.resolve(mockExportJob)),
};

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockImplementation(() => ({
    pathname: '/mock-path',
  })),
}));

const mockDownloadFile = jest.fn();
jest.mock('../../../utils/Export/ExportUtils', () => ({
  downloadFile: (...args: unknown[]) => mockDownloadFile(...args),
}));

const ConsumerComponent = () => {
  const { showModal } = useEntityExportModalProvider();

  return <button onClick={() => showModal(mockShowModal)}>Manage</button>;
};

/**
 * Drives the websocket callback directly, the way the socket listener does.
 * The backend broadcasts export results to every connection belonging to the
 * user, so this provider receives other tabs' jobs too.
 */
const CorrelationComponent = () => {
  const { showModal, onUpdateCSVExportJob } = useEntityExportModalProvider();

  return (
    <>
      <button onClick={() => showModal(mockShowModal)}>Manage</button>
      <button
        onClick={() =>
          onUpdateCSVExportJob({
            jobId: 'another-tabs-job',
            status: 'COMPLETED',
            data: 'WRONG,CSV',
          })
        }>
        emit-foreign
      </button>
      <button
        onClick={() =>
          onUpdateCSVExportJob({
            jobId: mockExportJob.jobId,
            status: 'COMPLETED',
            data: 'OURS,CSV',
          })
        }>
        emit-ours
      </button>
    </>
  );
};

describe('EntityExportModalProvider CSV export job correlation', () => {
  beforeEach(() => {
    mockDownloadFile.mockClear();
  });

  it('ignores a completed export belonging to a different job', async () => {
    render(
      <EntityExportModalProvider>
        <CorrelationComponent />
      </EntityExportModalProvider>
    );

    fireEvent.click(await screen.findByText('Manage'));
    await act(async () => {
      fireEvent.click(await screen.findByText('label.export'));
    });

    // This job id is not ours; the payload must be discarded rather than
    // downloaded under our own file name.
    await act(async () => {
      fireEvent.click(screen.getByText('emit-foreign'));
    });

    expect(mockDownloadFile).not.toHaveBeenCalled();
  });

  it('downloads the export matching its own job id', async () => {
    render(
      <EntityExportModalProvider>
        <CorrelationComponent />
      </EntityExportModalProvider>
    );

    fireEvent.click(await screen.findByText('Manage'));
    await act(async () => {
      fireEvent.click(await screen.findByText('label.export'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('emit-ours'));
    });

    expect(mockDownloadFile).toHaveBeenCalledWith(
      'OURS,CSV',
      expect.stringContaining('.csv')
    );
  });
});

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
});
