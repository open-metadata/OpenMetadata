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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { MOCK_TABLE } from '../../../mocks/TableData.mock';
import { getSampleDataByTableId } from '../../../rest/tableAPI';
import SampleDataTable from './SampleDataTable.component';

const mockProps = {
  tableId: 'id',
  owners: [{ type: 'user', id: 'ownerId' }],
  permissions: {
    Create: true,
    Delete: true,
    ViewAll: true,
    EditAll: true,
    EditDescription: true,
    EditDisplayName: true,
    EditCustomFields: true,
  } as OperationPermission,
};

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children }) => <span>{children}</span>),
}));

jest.mock('../../../rest/tableAPI', () => ({
  getSampleDataByTableId: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_TABLE)),
}));

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return jest
    .fn()
    .mockReturnValue(
      <div data-testid="error-placeholder">ErrorPlaceholder</div>
    );
});

jest.mock('../../Modals/EntityDeleteModal/EntityDeleteModal', () => {
  return jest.fn().mockReturnValue(<p>EntityDeleteModal</p>);
});

describe('Test SampleDataTable Component', () => {
  it('Render error placeholder if the columns passed are empty', async () => {
    (getSampleDataByTableId as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: '' })
    );

    await act(async () => {
      render(<SampleDataTable {...mockProps} />);
    });

    const errorPlaceholder = screen.getByTestId('error-placeholder');

    expect(errorPlaceholder).toBeInTheDocument();
  });

  it('Renders all the data that was sent to the component', async () => {
    await act(async () => {
      render(<SampleDataTable {...mockProps} />);
    });

    const deleteButton = screen.getByTestId('sample-data-manage-button');
    const table = screen.getByTestId('sample-data-table');

    expect(deleteButton).toBeInTheDocument();
    expect(table).toBeInTheDocument();
  });

  it('Sample Data menu dropdown should not be present when not have permission', async () => {
    await act(async () => {
      render(
        <SampleDataTable
          {...mockProps}
          permissions={{
            ...mockProps.permissions,
            EditAll: false,
          }}
        />
      );
    });

    expect(
      screen.queryByTestId('sample-data-manage-button')
    ).not.toBeInTheDocument();
  });

  it('Render Delete Modal when delete sample data button is clicked', async () => {
    await act(async () => {
      render(<SampleDataTable {...mockProps} />);
    });

    const dropdown = screen.getByTestId('sample-data-manage-button');

    expect(dropdown).toBeInTheDocument();

    fireEvent.click(dropdown);

    const deleteButton = screen.getByTestId('delete-button-details-container');

    fireEvent.click(deleteButton);

    const deleteModal = screen.getByText('EntityDeleteModal');

    expect(deleteModal).toBeInTheDocument();
  });
});
