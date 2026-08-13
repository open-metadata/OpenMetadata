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

// Deliberately does not mock components/common/Table/Table: the real Ant Design
// Table is what reserves `children` on a record and what derives the row key.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Table } from '../../../generated/entity/data/table';
import { getSampleDataByTableId } from '../../../rest/tableAPI';
import { downloadFile } from '../../../utils/Export/ExportUtils';
import SampleDataTable from './SampleDataTable.component';

const mockProps = {
  tableId: 'id',
  owners: [{ type: 'user', id: 'ownerId' }],
  permissions: {
    ViewAll: true,
    EditAll: true,
  } as OperationPermission,
};

// `children` is Ant Design's default `childrenColumnName`; `name` is what the
// table was previously handed as its `rowKey`. Both are legal column names.
const SAMPLE_COLUMNS = ['name', 'children', 'label'];
const SAMPLE_ROWS = [
  ['shared-name', 'first-child-value', 'first-label'],
  ['shared-name', 'second-child-value', 'second-label'],
];

const MOCK_TABLE_WITH_RESERVED_COLUMNS = {
  id: 'table-id',
  name: 'reserved_columns_table',
  columns: SAMPLE_COLUMNS.map((name) => ({ name, dataType: 'STRING' })),
  sampleData: {
    columns: SAMPLE_COLUMNS,
    rows: SAMPLE_ROWS,
  },
} as unknown as Table;

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children }) => <span>{children}</span>),
}));

jest.mock('../../../rest/tableAPI', () => ({
  getSampleDataByTableId: jest.fn(),
  deleteSampleDataByTableId: jest.fn(),
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

jest.mock('../../../utils/Export/ExportUtils', () => ({
  downloadFile: jest.fn(),
}));

describe('SampleDataTable with reserved column names', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSampleDataByTableId as jest.Mock).mockResolvedValue(
      MOCK_TABLE_WITH_RESERVED_COLUMNS
    );
  });

  it('should render the table when a column is named children', async () => {
    await act(async () => {
      render(<SampleDataTable {...mockProps} />);
    });

    expect(screen.getByTestId('sample-data-table')).toBeInTheDocument();
    expect(screen.getByText('children')).toBeInTheDocument();
  });

  it('should render every cell of a column named children', async () => {
    await act(async () => {
      render(<SampleDataTable {...mockProps} />);
    });

    expect(screen.getByText('first-child-value')).toBeInTheDocument();
    expect(screen.getByText('second-child-value')).toBeInTheDocument();
  });

  it('should render one row per sample row without extra flattened rows', async () => {
    const { container } = await act(async () =>
      render(<SampleDataTable {...mockProps} />)
    );

    expect(container.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(
      SAMPLE_ROWS.length
    );
  });

  it('should give each row a distinct row key even when cell values repeat', async () => {
    const { container } = await act(async () =>
      render(<SampleDataTable {...mockProps} />)
    );

    const rowKeys = Array.from(
      container.querySelectorAll('tbody tr.ant-table-row')
    ).map((row) => row.getAttribute('data-row-key'));

    expect(rowKeys.length).toBeGreaterThan(1);
    expect(rowKeys).not.toContain(null);
    expect(new Set(rowKeys).size).toBe(rowKeys.length);
  });

  it('should export a CSV headed by the raw column names', async () => {
    await act(async () => {
      render(<SampleDataTable {...mockProps} />);
    });

    fireEvent.click(screen.getByTestId('sample-data-manage-button'));
    fireEvent.click(screen.getByTestId('export-button-details-container'));

    const csvContent = (downloadFile as jest.Mock).mock.calls[0][0] as string;
    const [header, ...dataLines] = csvContent.split('\n');

    expect(header).toBe(SAMPLE_COLUMNS.join(','));
    expect(dataLines).toContain(SAMPLE_ROWS[0].join(','));
    expect(dataLines).toContain(SAMPLE_ROWS[1].join(','));
  });
});
