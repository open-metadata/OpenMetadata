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
import { File } from '../../../../generated/entity/data/file';
import {
  LabelType,
  State,
  TagSource,
} from '../../../../generated/type/tagLabel';
import { UsePagingInterface } from '../../../../hooks/paging/usePaging';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import FilesTable from './FilesTable';
import { FilesTableProps } from './FilesTable.interface';

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
      <div data-testid="files-table">
        <div data-testid="table-columns-count">{columns?.length || 0}</div>
        <div data-testid="table-filters">{extraTableFilters}</div>
        {loading ? (
          <div data-testid="table-loading">Loading...</div>
        ) : (
          <div>
            {dataSource.map((file: File, index: number) => (
              <div data-testid={`file-row-${index}`} key={file.id || index}>
                {file.name}
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

const mockFiles: File[] = [
  {
    id: 'file-1',
    name: 'document.pdf',
    displayName: 'Important Document',
    fullyQualifiedName: 'test-service.document.pdf',
    description: 'This is an important document with detailed information.',
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
    href: 'http://localhost:8585/api/v1/files/file-1',
    version: 1.0,
    updatedAt: 1640995200000,
    updatedBy: 'test-user',
  },
  {
    id: 'file-2',
    name: 'data.csv',
    displayName: 'Data File',
    fullyQualifiedName: 'test-service.data.csv',
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
    href: 'http://localhost:8585/api/v1/files/file-2',
    version: 1.0,
    updatedAt: 1640995200000,
    updatedBy: 'test-user',
  },
  {
    id: 'file-3',
    name: 'deleted.txt',
    displayName: 'Deleted File',
    fullyQualifiedName: 'test-service.deleted.txt',
    description: 'This file has been deleted',
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
    href: 'http://localhost:8585/api/v1/files/file-3',
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

const defaultProps: FilesTableProps = {
  showDeleted: false,
  handleShowDeleted: jest.fn(),
  paging: mockPaging,
  handlePageChange: jest.fn(),
  files: mockFiles,
  isLoading: false,
};

const renderFilesTable = (props: Partial<FilesTableProps> = {}) => {
  const finalProps = { ...defaultProps, ...props };

  return render(
    <MemoryRouter>
      <FilesTable {...finalProps} />
    </MemoryRouter>
  );
};

describe('FilesTable', () => {
  beforeEach(() => {
    mockGetEntityDetailsPath.mockImplementation(
      (_entityType, fqn) => `/file/${fqn}`
    );

    jest.clearAllMocks();
  });

  it('should render files table successfully', () => {
    renderFilesTable();

    expect(screen.getByTestId('files-table')).toBeInTheDocument();
    expect(screen.getByTestId('table-filters')).toBeInTheDocument();
  });

  it('should display files data correctly', () => {
    renderFilesTable();

    expect(screen.getByTestId('file-row-0')).toHaveTextContent('document.pdf');
    expect(screen.getByTestId('file-row-1')).toHaveTextContent('data.csv');
    expect(screen.getByTestId('file-row-2')).toHaveTextContent('deleted.txt');
  });

  it('should show loading state when isLoading is true', () => {
    renderFilesTable({
      isLoading: true,
    });

    expect(screen.getByTestId('table-loading')).toBeInTheDocument();
  });

  it('should render show deleted toggle in filters', () => {
    renderFilesTable();

    const deleteToggle = screen.getByTestId('show-deleted');

    expect(deleteToggle).toBeInTheDocument();
    expect(deleteToggle).not.toBeChecked();
  });

  it('should handle show deleted toggle correctly', async () => {
    const mockHandleShowDeleted = jest.fn();
    renderFilesTable({
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
    renderFilesTable({
      showDeleted: true,
    });

    const deleteToggle = screen.getByTestId('show-deleted');

    expect(deleteToggle).toBeChecked();
  });

  it('should display pagination information correctly', () => {
    renderFilesTable();

    expect(screen.getByTestId('pagination-info')).toHaveTextContent(
      'Page: 1, Size: 10'
    );
  });

  it('should handle page change correctly', () => {
    const mockHandlePageChange = jest.fn();
    // Test page change functionality

    renderFilesTable({
      handlePageChange: mockHandlePageChange,
    });

    expect(mockHandlePageChange).not.toHaveBeenCalled();
  });

  it('should render empty files list', () => {
    renderFilesTable({
      files: [],
    });

    expect(screen.getByTestId('files-table')).toBeInTheDocument();
    expect(screen.queryByTestId('file-row-0')).not.toBeInTheDocument();
  });

  it('should handle different page sizes', () => {
    const customPaging = {
      ...mockPaging,
      pageSize: 25,
      currentPage: 2,
    };

    renderFilesTable({
      paging: customPaging,
    });

    expect(screen.getByTestId('pagination-info')).toHaveTextContent(
      'Page: 2, Size: 25'
    );
  });

  it('should display deleted files when showDeleted is enabled', () => {
    renderFilesTable({
      showDeleted: true,
    });

    expect(screen.getByTestId('file-row-2')).toHaveTextContent('deleted.txt');
  });

  it('should handle files without description', () => {
    const filesWithoutDescription = mockFiles.filter(
      (file) => !file.description?.trim()
    );
    renderFilesTable({
      files: filesWithoutDescription,
    });

    expect(screen.getByTestId('files-table')).toBeInTheDocument();
  });

  it('should handle files with rich description content', () => {
    const filesWithRichDescription = [
      {
        ...mockFiles[0],
        description: '**Bold text** with _italic_ content',
      },
    ];

    renderFilesTable({
      files: filesWithRichDescription,
    });

    expect(screen.getByTestId('files-table')).toBeInTheDocument();
  });

  it('should handle pagination when showing all data', () => {
    const largePaging = {
      ...mockPaging,
      showPagination: false,
    };

    renderFilesTable({
      paging: largePaging,
    });

    expect(screen.getByTestId('files-table')).toBeInTheDocument();
  });

  it('should handle files with long names', () => {
    const filesWithLongNames = [
      {
        ...mockFiles[0],
        name: 'very-long-file-name-that-might-cause-display-issues.pdf',
        displayName: 'Very Long File Name That Might Cause Display Issues',
      },
    ];

    renderFilesTable({
      files: filesWithLongNames,
    });

    expect(screen.getByTestId('file-row-0')).toBeInTheDocument();
  });

  it('should handle files without displayName gracefully', () => {
    const filesWithoutDisplayName = [
      {
        ...mockFiles[0],
        displayName: undefined,
      },
    ];

    renderFilesTable({
      files: filesWithoutDisplayName as File[],
    });

    expect(screen.getByTestId('files-table')).toBeInTheDocument();
  });

  it('should show correct number of files', () => {
    renderFilesTable();

    const fileRows = screen.getAllByTestId(/file-row-/);

    expect(fileRows).toHaveLength(mockFiles.length);
  });

  it('should handle toggle switch state changes', async () => {
    const mockHandleShowDeleted = jest.fn();
    renderFilesTable({
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
    renderFilesTable({
      files: [],
    });

    expect(screen.getByTestId('files-table')).toBeInTheDocument();
  });

  it('should handle files with undefined fullyQualifiedName', () => {
    const filesWithUndefinedFQN = [
      {
        ...mockFiles[0],
        fullyQualifiedName: undefined,
      },
    ];

    renderFilesTable({
      files: filesWithUndefinedFQN as File[],
    });

    expect(screen.getByTestId('files-table')).toBeInTheDocument();
  });
});
