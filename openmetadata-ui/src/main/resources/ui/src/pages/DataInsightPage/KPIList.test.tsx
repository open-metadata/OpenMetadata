/*
 *  Copyright 2022 Collate.
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

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react-test-renderer';
import KPIList from './KPIList';
import { KPI_DATA } from './mocks/KPIList';

const mockPush = jest.fn();

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
    )),
}));

jest.mock('components/common/DeleteWidget/DeleteWidgetModal', () =>
  jest.fn().mockReturnValue(<div data-testid="delete-modal">Delete Modal</div>)
);

jest.mock('components/common/next-previous/NextPrevious', () =>
  jest
    .fn()
    .mockReturnValue(<div data-testid="next-previous">Next Previous</div>)
);

jest.mock('components/common/rich-text-editor/RichTextEditorPreviewer', () =>
  jest.fn().mockReturnValue(<div data-testid="editor">Editor</div>)
);

jest.mock('components/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>)
);

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../utils/TimeUtils', () => ({
  formatDateTime: jest.fn().mockReturnValue('7 Dec 2022, 00:00'),
}));

jest.mock('rest/KpiAPI', () => ({
  getListKPIs: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: KPI_DATA })),
}));

describe('KPI list component', () => {
  it('Should render the kpi list', async () => {
    render(<KPIList />, { wrapper: MemoryRouter });

    const container = await screen.findByTestId('kpi-table');
    const descriptionKPI = await screen.findByText('Description KPI');
    const ownerKPI = await screen.findByText('Owner KPI');

    expect(container).toBeInTheDocument();

    expect(descriptionKPI).toBeInTheDocument();
    expect(ownerKPI).toBeInTheDocument();
  });

  it('Action button should work', async () => {
    const KPI = KPI_DATA[0];

    render(<KPIList />, { wrapper: MemoryRouter });

    const editButton = await screen.findByTestId(
      `edit-action-${KPI.displayName}`
    );
    const deleteButton = await screen.findByTestId(
      `delete-action-${KPI.displayName}`
    );

    expect(editButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(editButton);
    });

    expect(mockPush).toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(deleteButton);
    });

    expect(await screen.findByTestId('delete-modal')).toBeInTheDocument();
  });
});
