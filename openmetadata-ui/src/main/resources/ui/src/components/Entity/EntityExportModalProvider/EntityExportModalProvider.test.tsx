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
import React from 'react';
import {
  EntityExportModalProvider,
  useEntityExportModalProvider,
} from './EntityExportModalProvider.component';
import { ExportData } from './EntityExportModalProvider.interface';

const dummyTeamsCSV = `name*,displayName,description,teamType*,parents*,Owner,isJoinable,defaultRoles,policies
access table only,access table only,,Group,Organization,,true,Only table,
Engineering,,,BusinessUnit,Organization,,true,,
Finance,,,BusinessUnit,Organization,,true,,
Legal,,,BusinessUnit,Organization,,true,,
Applications,,,Group,Engineering,,true,,
`;

const mockShowModal: ExportData = {
  name: 'test',
  onExport: jest.fn().mockImplementation(() => Promise.resolve(dummyTeamsCSV)),
};

const ConsumerComponent = () => {
  const { showModal } = useEntityExportModalProvider();

  return <button onClick={() => showModal(mockShowModal)}>Manage</button>;
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

    expect(mockShowModal.onExport).toHaveBeenCalledWith(mockShowModal.name);
    expect(screen.queryByTestId('export-entity-modal')).not.toBeInTheDocument();
  });
});
