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

// Deliberately does not mock components/common/Table/Table: what the real Ant
// Design table renders is one half of the display-matches-export assertion.
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

// A query projection can repeat a name (a self-join re-introduces the join
// keys), and each occurrence carries its own value.
const SAMPLE_COLUMNS = ['dup', 'dup', 'other'];
const SAMPLE_ROWS = [['first-dup', 'second-dup', 'other-value']];

const MOCK_TABLE_WITH_DUPLICATE_COLUMNS = {
  id: 'table-id',
  name: 'duplicate_columns_table',
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

describe('SampleDataTable with duplicate column names', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSampleDataByTableId as jest.Mock).mockResolvedValue(
      MOCK_TABLE_WITH_DUPLICATE_COLUMNS
    );
  });

  it('should render a cell per occurrence, each with its own value', async () => {
    const { container } = await act(async () =>
      render(<SampleDataTable {...mockProps} />)
    );

    const cellTexts = Array.from(
      container.querySelectorAll('tbody tr[data-row-key] td')
    ).map((cell) => cell.textContent);

    expect(cellTexts).toEqual(SAMPLE_ROWS[0]);
  });

  it('should export exactly what the table renders', async () => {
    const { container } = await act(async () =>
      render(<SampleDataTable {...mockProps} />)
    );

    fireEvent.click(screen.getByTestId('sample-data-manage-button'));
    fireEvent.click(screen.getByTestId('export-button-details-container'));

    const cellTexts = Array.from(
      container.querySelectorAll('tbody tr[data-row-key] td')
    ).map((cell) => cell.textContent);
    const csvContent = (downloadFile as jest.Mock).mock.calls[0][0] as string;
    const [header, firstDataLine] = csvContent.split('\n');

    expect(header).toBe(SAMPLE_COLUMNS.join(','));
    expect(firstDataLine).toBe(cellTexts.join(','));
  });
});
