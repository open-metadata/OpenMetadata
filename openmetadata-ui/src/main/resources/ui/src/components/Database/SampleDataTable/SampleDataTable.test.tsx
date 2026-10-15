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

import { act, fireEvent, render, screen, within } from '@testing-library/react';
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

jest.mock('../../common/DeleteModal/DeleteModal', () => {
  return jest.fn().mockReturnValue(<p>DeleteModal</p>);
});

describe('Test SampleDataTable Component', () => {
  it('Render error placeholder if the columns passed are empty', async () => {
    (getSampleDataByTableId as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: '' })
    );

    await act(async () => {
      render(<SampleDataTable {...mockProps} />);
    });

    expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('sample-data')).not.toBeInTheDocument();
    expect(screen.queryByTestId('row-limit-select')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('sample-data-manage-button')
    ).not.toBeInTheDocument();
  });

  it('Renders all the data that was sent to the component', async () => {
    await act(async () => {
      render(<SampleDataTable {...mockProps} />);
    });

    expect(screen.getByTestId('sample-data')).toBeInTheDocument();
    expect(screen.getByTestId('row-limit-select')).toBeInTheDocument();
    expect(screen.getByTestId('sample-data-manage-button')).toBeInTheDocument();
    expect(screen.getByTestId('sample-data-table')).toBeInTheDocument();
    expect(screen.getByText('address_id1')).toBeInTheDocument();
    expect(screen.getByText('last_name3')).toBeInTheDocument();
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

    expect(screen.getByTestId('sample-data-manage-button')).toBeInTheDocument();
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

    const deleteModal = screen.getByText('DeleteModal');

    expect(deleteModal).toBeInTheDocument();
  });

  it('Should render row limit selector', async () => {
    await act(async () => {
      render(<SampleDataTable {...mockProps} />);
    });

    const rowLimitSelect = screen.getByTestId('row-limit-select');

    expect(rowLimitSelect).toBeInTheDocument();
  });

  it('Should limit the rendered rows to the selected row limit', async () => {
    const columns = ['id'];
    const rows = Array.from({ length: 15 }, (_, index) => [`row-${index}`]);
    (getSampleDataByTableId as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        columns: [{ name: 'id', dataType: 'STRING' }],
        sampleData: { columns, rows },
      })
    );

    const { container } = await act(async () =>
      render(<SampleDataTable {...mockProps} />)
    );

    const getBodyRows = () =>
      container.querySelectorAll('tbody tr[data-row-key]');

    expect(getBodyRows()).toHaveLength(15);

    const rowLimitSelect = screen.getByTestId('row-limit-select');

    await act(async () => {
      fireEvent.click(within(rowLimitSelect).getByRole('button'));
    });
    await act(async () => {
      fireEvent.click(await screen.findByTestId('row-limit-option-10'));
    });

    expect(rowLimitSelect).toHaveTextContent('10');
    expect(getBodyRows()).toHaveLength(10);
    expect(screen.getByText('row-9')).toBeInTheDocument();
    expect(screen.queryByText('row-10')).not.toBeInTheDocument();
  });

  it('Should render export button in dropdown', async () => {
    await act(async () => {
      render(<SampleDataTable {...mockProps} />);
    });

    const dropdown = screen.getByTestId('sample-data-manage-button');

    expect(dropdown).toBeInTheDocument();

    fireEvent.click(dropdown);

    const exportButton = screen.getByTestId('export-button-details-container');

    expect(exportButton).toBeInTheDocument();
  });

  it('Should trigger CSV export when export button is clicked', async () => {
    const originalCreateElement = document.createElement.bind(document);
    const mockCreateElement = jest.fn((tag: string) =>
      originalCreateElement(tag)
    );
    const mockCreateObjectURL = jest.fn(() => 'mock-url');

    global.document.createElement = mockCreateElement;
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = jest.fn();

    try {
      await act(async () => {
        render(<SampleDataTable {...mockProps} />);
      });

      const dropdown = screen.getByTestId('sample-data-manage-button');

      fireEvent.click(dropdown);

      const exportButton = screen.getByTestId(
        'export-button-details-container'
      );

      fireEvent.click(exportButton);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockCreateObjectURL).toHaveBeenCalled();
    } finally {
      global.document.createElement = originalCreateElement;
    }
  });

  // Task 8 Batch 3: hasPermission's raw
  // `permissions.EditAll || permissions.EditSampleData || isCurrentUserTableOwner` ->
  // `canEditAll || canEditSampleData || isCurrentUserTableOwner`. This is the N-term-raw-OR-
  // with-bare-EditAll pattern (Task 8 Batch 2 KnowledgeCard precedent): keeping canEditAll as
  // its own explicit OR-term is required — dropping it in favor of just canEditSampleData
  // would REGRESS the case below (EditAll=true, EditSampleData explicitly false), not fix an
  // explicit-deny-wins gap.
  describe('hasPermission (N-term OR with bare EditAll)', () => {
    it('keeps the delete action available via EditAll when EditSampleData is explicitly false', async () => {
      await act(async () => {
        render(
          <SampleDataTable
            {...mockProps}
            permissions={{
              ...mockProps.permissions,
              EditAll: true,
              EditSampleData: false,
            }}
          />
        );
      });

      const dropdown = screen.getByTestId('sample-data-manage-button');
      fireEvent.click(dropdown);

      expect(
        screen.getByTestId('delete-button-details-container')
      ).toBeInTheDocument();
    });

    it('hides the delete action when both EditAll and EditSampleData are false and the user is not an owner', async () => {
      await act(async () => {
        render(
          <SampleDataTable
            {...mockProps}
            owners={[{ type: 'user', id: 'someone-else' }]}
            permissions={{
              ...mockProps.permissions,
              EditAll: false,
              EditSampleData: false,
            }}
          />
        );
      });

      const dropdown = screen.getByTestId('sample-data-manage-button');
      fireEvent.click(dropdown);

      expect(
        screen.queryByTestId('delete-button-details-container')
      ).not.toBeInTheDocument();
    });
  });
});
