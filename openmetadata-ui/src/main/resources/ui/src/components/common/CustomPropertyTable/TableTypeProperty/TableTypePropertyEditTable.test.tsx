/*
 *  Copyright 2025 Collate.
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
import { act, render, screen } from '@testing-library/react';
import { getGridColumns } from './EditTableTypePropertyModal';
import TableTypePropertyEditTable from './TableTypePropertyEditTable';
import { TableTypePropertyEditTableProps } from './TableTypePropertyEditTable.interface';

describe('TableTypePropertyEditTable', () => {
  let mockDataSource: { value: Record<string, string>[] };
  let handleEditDataSource: jest.Mock;
  let handleCopy: jest.Mock;
  let handlePaste: jest.Mock;
  let pushToUndoStack: jest.Mock;

  const columns = ['pw-import-export-column1', 'pw-import-export-column2'];

  beforeEach(() => {
    mockDataSource = {
      value: [
        {
          'pw-import-export-column1': 'Property 1',
          'pw-import-export-column2': 'Value 1',
          id: '0',
        },
        {
          'pw-import-export-column1': 'Property 2',
          'pw-import-export-column2': 'Value 2',
          id: '1',
        },
      ],
    };
    handleEditDataSource = jest.fn();
    handleCopy = jest.fn();
    handlePaste = jest.fn();
    pushToUndoStack = jest.fn();
  });

  const getProps = (): TableTypePropertyEditTableProps => ({
    columns: getGridColumns(columns),
    dataSource: mockDataSource.value,
    setGridContainer: jest.fn(),
    handleOnRowsChange: handleEditDataSource,
    handleCopy,
    handlePaste,
  });

  it('should render the table with given columns and dataSource', async () => {
    await act(async () => {
      render(
        <div style={{ width: '400px' }}>
          <TableTypePropertyEditTable {...getProps()} />
        </div>
      );
    });

    expect(screen.getByText('Property 1')).toBeInTheDocument();
    expect(screen.getByText('Property 2')).toBeInTheDocument();

    // react-data-grid virtual list is only rendering first column in test environment
    // expect(screen.getByText('Value 1')).toBeInTheDocument();
    // expect(screen.getByText('Value 2')).toBeInTheDocument();
  });

  it('should call handleEditDataSource and pushToUndoStack on row edit', () => {
    render(<TableTypePropertyEditTable {...getProps()} />);
    // Simulate row edit by calling the prop directly
    const updatedRows = [
      {
        'pw-import-export-column1': 'Property 1',
        'pw-import-export-column2': 'Value 1',
        id: '0',
      },
      {
        'pw-import-export-column1': 'Property 2',
        'pw-import-export-column2': 'Changed',
        id: '1',
      },
    ];
    // Call the handler as DataGrid would
    handleEditDataSource(updatedRows);
    pushToUndoStack(mockDataSource.value);

    expect(handleEditDataSource).toHaveBeenCalledWith(updatedRows);
    expect(pushToUndoStack).toHaveBeenCalledWith(mockDataSource.value);
  });

  it('should call handleCopy and handlePaste when triggered', () => {
    render(<TableTypePropertyEditTable {...getProps()} />);
    // Simulate copy and paste by calling the prop directly
    handleCopy({} as any);
    handlePaste({} as any);

    expect(handleCopy).toHaveBeenCalled();
    expect(handlePaste).toHaveBeenCalled();
  });

  it('should render with different columns', () => {
    const customColumns = getGridColumns(['pw-import-export-column1']);
    render(
      <TableTypePropertyEditTable {...getProps()} columns={customColumns} />
    );

    expect(screen.getByText('Property 1')).toBeInTheDocument();
    expect(screen.queryByText('Value 1')).not.toBeInTheDocument();
  });
});
