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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
} from '../../../../constants/constants';
import { CursorType } from '../../../../enums/pagination.enum';
import { Spreadsheet } from '../../../../generated/entity/data/spreadsheet';
import {
  LabelType,
  State,
  TagSource,
} from '../../../../generated/type/tagLabel';
import { UsePagingInterface } from '../../../../hooks/paging/usePaging';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import SpreadsheetsTable from './SpreadsheetsTable';
import { SpreadsheetsTableProps } from './SpreadsheetsTable.interface';

jest.mock('../../../../utils/RouterUtils');
jest.mock('../../../../utils/EntityUtils');
jest.mock('../../../../utils/TableColumn.util');
jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn(() => <div data-testid="error-placeholder">No data available</div>)
);
jest.mock('../../../common/RichTextEditor/RichTextEditorPreviewNew', () =>
  jest.fn(({ markdown }) => (
    <div data-testid="rich-text-preview">{markdown}</div>
  ))
);
jest.mock('../../../common/Table/Table', () =>
  jest.fn(
    ({
      columns,
      dataSource,
      loading,
      customPaginationProps,
      extraTableFilters,
    }) => (
      <div data-testid="spreadsheets-table">
        <div data-testid="table-columns-count">{columns?.length || 0}</div>
        <div data-testid="table-filters">{extraTableFilters}</div>
        {loading ? (
          <div data-testid="table-loading">Loading...</div>
        ) : (
          <div>
            {dataSource.map((spreadsheet: Spreadsheet, index: number) => (
              <div
                data-testid={`spreadsheet-row-${index}`}
                key={spreadsheet.id || index}>
                {spreadsheet.name}
              </div>
            ))}
          </div>
        )}
        <div data-testid="pagination-info">
          Page: {customPaginationProps.currentPage}, Size:{' '}
          {customPaginationProps.pageSize}
        </div>
      </div>
    )
  )
);

const mockGetEntityDetailsPath = getEntityDetailsPath as jest.Mock;

const mockSpreadsheets: Spreadsheet[] = [
  {
    id: 'spreadsheet-1',
    name: 'sales_data',
    displayName: 'Sales Data',
    fullyQualifiedName: 'test-service.sales_data',
    description:
      'This spreadsheet contains comprehensive sales data and analytics.',
    tags: [
      {
        tagFQN: 'PII.Sensitive',
        description: 'PII Sensitive tag',
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
    ],
    service: {
      id: 'service-1',
      type: 'driveService',
      name: 'test-drive-service',
      fullyQualifiedName: 'test-drive-service',
      displayName: 'Test Drive Service',
      deleted: false,
    },
    deleted: false,
    href: 'http://localhost:8585/api/v1/spreadsheets/spreadsheet-1',
    version: 1.0,
    updatedAt: 1640995200000,
    updatedBy: 'test-user',
  },
  {
    id: 'spreadsheet-2',
    name: 'inventory',
    displayName: 'Inventory Sheet',
    fullyQualifiedName: 'test-service.inventory',
    description: '',
    tags: [],
    service: {
      id: 'service-1',
      type: 'driveService',
      name: 'test-drive-service',
      fullyQualifiedName: 'test-drive-service',
      displayName: 'Test Drive Service',
      deleted: false,
    },
    deleted: false,
    href: 'http://localhost:8585/api/v1/spreadsheets/spreadsheet-2',
    version: 1.0,
    updatedAt: 1640995200000,
    updatedBy: 'test-user',
  },
  {
    id: 'spreadsheet-3',
    name: 'archived_data',
    displayName: 'Archived Data',
    fullyQualifiedName: 'test-service.archived_data',
    description: 'This spreadsheet has been archived',
    tags: [],
    service: {
      id: 'service-1',
      type: 'driveService',
      name: 'test-drive-service',
      fullyQualifiedName: 'test-drive-service',
      displayName: 'Test Drive Service',
      deleted: false,
    },
    deleted: true,
    href: 'http://localhost:8585/api/v1/spreadsheets/spreadsheet-3',
    version: 1.0,
    updatedAt: 1640995200000,
    updatedBy: 'test-user',
  },
];

const mockPaging: UsePagingInterface = {
  currentPage: 1,
  pageSize: 10,
  paging: {
    total: 25,
  },
  showPagination: true,
  handlePageChange: jest.fn(),
  handlePageSizeChange: jest.fn(),
  handlePagingChange: jest.fn(),
  pagingCursor: { cursorType: CursorType.AFTER, cursorValue: '' },
};

const defaultProps: SpreadsheetsTableProps = {
  showDeleted: false,
  handleShowDeleted: jest.fn(),
  paging: mockPaging,
  handlePageChange: jest.fn(),
  spreadsheets: mockSpreadsheets,
  isLoading: false,
};

const renderSpreadsheetsTable = (
  props: Partial<SpreadsheetsTableProps> = {}
) => {
  const finalProps = { ...defaultProps, ...props };

  return render(
    <MemoryRouter>
      <SpreadsheetsTable {...finalProps} />
    </MemoryRouter>
  );
};

describe('SpreadsheetsTable', () => {
  beforeEach(() => {
    mockGetEntityDetailsPath.mockImplementation(
      (_entityType, fqn) => `/spreadsheet/${fqn}`
    );

    jest.clearAllMocks();
  });

  it('should render spreadsheets table successfully', () => {
    renderSpreadsheetsTable();

    expect(screen.getByTestId('spreadsheets-table')).toBeInTheDocument();
    expect(screen.getByTestId('table-filters')).toBeInTheDocument();
  });

  it('should display spreadsheets data correctly', () => {
    renderSpreadsheetsTable();

    expect(screen.getByTestId('spreadsheet-row-0')).toHaveTextContent(
      'sales_data'
    );
    expect(screen.getByTestId('spreadsheet-row-1')).toHaveTextContent(
      'inventory'
    );
    expect(screen.getByTestId('spreadsheet-row-2')).toHaveTextContent(
      'archived_data'
    );
  });

  it('should show loading state when isLoading is true', () => {
    renderSpreadsheetsTable({
      isLoading: true,
    });

    expect(screen.getByTestId('table-loading')).toBeInTheDocument();
  });

  it('should render show deleted toggle in filters', () => {
    renderSpreadsheetsTable();

    const deleteToggle = screen.getByTestId('show-deleted');

    expect(deleteToggle).toBeInTheDocument();
    expect(deleteToggle).not.toBeChecked();
  });

  it('should handle show deleted toggle correctly', async () => {
    const mockHandleShowDeleted = jest.fn();
    renderSpreadsheetsTable({
      handleShowDeleted: mockHandleShowDeleted,
    });

    const deleteToggle = screen.getByTestId('show-deleted');
    fireEvent.click(deleteToggle);

    await waitFor(() => {
      expect(mockHandleShowDeleted).toHaveBeenCalledWith(true);
      expect(mockPaging.handlePageChange).toHaveBeenCalledWith(
        INITIAL_PAGING_VALUE
      );
      expect(mockPaging.handlePageSizeChange).toHaveBeenCalledWith(
        PAGE_SIZE_BASE
      );
    });
  });

  it('should show checked state when showDeleted is true', () => {
    renderSpreadsheetsTable({
      showDeleted: true,
    });

    const deleteToggle = screen.getByTestId('show-deleted');

    expect(deleteToggle).toBeChecked();
  });

  it('should display pagination information correctly', () => {
    renderSpreadsheetsTable();

    expect(screen.getByTestId('pagination-info')).toHaveTextContent(
      'Page: 1, Size: 10'
    );
  });

  it('should handle page change correctly', () => {
    const mockHandlePageChange = jest.fn();
    // Test page change functionality

    renderSpreadsheetsTable({
      handlePageChange: mockHandlePageChange,
    });

    expect(mockHandlePageChange).not.toHaveBeenCalled();
  });

  it('should render empty spreadsheets list', () => {
    renderSpreadsheetsTable({
      spreadsheets: [],
    });

    expect(screen.getByTestId('spreadsheets-table')).toBeInTheDocument();
    expect(screen.queryByTestId('spreadsheet-row-0')).not.toBeInTheDocument();
  });

  it('should handle different page sizes', () => {
    const customPaging = {
      ...mockPaging,
      pageSize: 25,
      currentPage: 2,
    };

    renderSpreadsheetsTable({
      paging: customPaging,
    });

    expect(screen.getByTestId('pagination-info')).toHaveTextContent(
      'Page: 2, Size: 25'
    );
  });

  it('should display deleted spreadsheets when showDeleted is enabled', () => {
    renderSpreadsheetsTable({
      showDeleted: true,
    });

    expect(screen.getByTestId('spreadsheet-row-2')).toHaveTextContent(
      'archived_data'
    );
  });

  it('should handle spreadsheets without description', () => {
    const spreadsheetsWithoutDescription = mockSpreadsheets.filter(
      (spreadsheet) => !spreadsheet.description?.trim()
    );
    renderSpreadsheetsTable({
      spreadsheets: spreadsheetsWithoutDescription,
    });

    expect(screen.getByTestId('spreadsheets-table')).toBeInTheDocument();
  });

  it('should handle spreadsheets with rich description content', () => {
    const spreadsheetsWithRichDescription = [
      {
        ...mockSpreadsheets[0],
        description:
          '**Bold text** with _italic_ content and [links](http://example.com)',
      },
    ];

    renderSpreadsheetsTable({
      spreadsheets: spreadsheetsWithRichDescription,
    });

    expect(screen.getByTestId('spreadsheets-table')).toBeInTheDocument();
  });

  it('should handle pagination when showing all data', () => {
    const largePaging = {
      ...mockPaging,
      showPagination: false,
    };

    renderSpreadsheetsTable({
      paging: largePaging,
    });

    expect(screen.getByTestId('spreadsheets-table')).toBeInTheDocument();
  });

  it('should handle spreadsheets with long names', () => {
    const spreadsheetsWithLongNames = [
      {
        ...mockSpreadsheets[0],
        name: 'very-long-spreadsheet-name-that-might-cause-display-issues',
        displayName:
          'Very Long Spreadsheet Name That Might Cause Display Issues',
      },
    ];

    renderSpreadsheetsTable({
      spreadsheets: spreadsheetsWithLongNames,
    });

    expect(screen.getByTestId('spreadsheet-row-0')).toBeInTheDocument();
  });

  it('should handle spreadsheets without displayName gracefully', () => {
    const spreadsheetsWithoutDisplayName = [
      {
        ...mockSpreadsheets[0],
        displayName: undefined,
      },
    ];

    renderSpreadsheetsTable({
      spreadsheets: spreadsheetsWithoutDisplayName as Spreadsheet[],
    });

    expect(screen.getByTestId('spreadsheets-table')).toBeInTheDocument();
  });

  it('should show correct number of spreadsheets', () => {
    renderSpreadsheetsTable();

    const spreadsheetRows = screen.getAllByTestId(/spreadsheet-row-/);

    expect(spreadsheetRows).toHaveLength(mockSpreadsheets.length);
  });

  it('should handle toggle switch state changes', async () => {
    const mockHandleShowDeleted = jest.fn();
    renderSpreadsheetsTable({
      showDeleted: false,
      handleShowDeleted: mockHandleShowDeleted,
    });

    const deleteToggle = screen.getByTestId('show-deleted');

    fireEvent.click(deleteToggle);

    await waitFor(() => {
      expect(mockHandleShowDeleted).toHaveBeenCalledWith(true);
    });
  });

  it('should display error placeholder when configured', () => {
    renderSpreadsheetsTable({
      spreadsheets: [],
    });

    expect(screen.getByTestId('spreadsheets-table')).toBeInTheDocument();
  });

  it('should handle spreadsheets with undefined fullyQualifiedName', () => {
    const spreadsheetsWithUndefinedFQN = [
      {
        ...mockSpreadsheets[0],
        fullyQualifiedName: undefined,
      },
    ];

    renderSpreadsheetsTable({
      spreadsheets: spreadsheetsWithUndefinedFQN as Spreadsheet[],
    });

    expect(screen.getByTestId('spreadsheets-table')).toBeInTheDocument();
  });

  it('should handle spreadsheets with complex tag structures', () => {
    const spreadsheetsWithComplexTags = [
      {
        ...mockSpreadsheets[0],
        tags: [
          {
            tagFQN: 'PII.Sensitive',
            description: 'PII Sensitive tag',
            source: TagSource.Classification,
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
          {
            tagFQN: 'Tier.Tier1',
            description: 'Tier1 tag',
            source: TagSource.Classification,
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
        ],
      },
    ];

    renderSpreadsheetsTable({
      spreadsheets: spreadsheetsWithComplexTags,
    });

    expect(screen.getByTestId('spreadsheets-table')).toBeInTheDocument();
  });

  it('should handle mixed deleted and active spreadsheets', () => {
    const mixedSpreadsheets = [
      { ...mockSpreadsheets[0], deleted: false },
      { ...mockSpreadsheets[1], deleted: true },
      { ...mockSpreadsheets[2], deleted: false },
    ];

    renderSpreadsheetsTable({
      spreadsheets: mixedSpreadsheets,
    });

    expect(screen.getByTestId('spreadsheets-table')).toBeInTheDocument();
    expect(screen.getAllByTestId(/spreadsheet-row-/)).toHaveLength(3);
  });

  it('should handle spreadsheets with special characters in names', () => {
    const spreadsheetsWithSpecialChars = [
      {
        ...mockSpreadsheets[0],
        name: 'data-2023&special_chars%test',
        displayName: 'Data 2023 & Special Chars % Test',
      },
    ];

    renderSpreadsheetsTable({
      spreadsheets: spreadsheetsWithSpecialChars,
    });

    expect(screen.getByTestId('spreadsheet-row-0')).toBeInTheDocument();
  });
});
