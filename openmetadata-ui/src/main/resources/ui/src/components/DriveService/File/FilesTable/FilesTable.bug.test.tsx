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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { File } from '../../../../generated/entity/data/file';
import { UsePagingInterface } from '../../../../hooks/paging/usePaging';
import { searchQuery } from '../../../../rest/searchAPI';
import FilesTable from './FilesTable';
import { FilesTableProps } from './FilesTable.interface';

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../common/Table/TableV2', () =>
  jest.fn(({ dataSource, loading, customPaginationProps }) => (
    <div data-testid="files-table">
      {loading ? (
        <div data-testid="table-loading">Loading...</div>
      ) : (
        <div>
          {dataSource?.map((file: File, index: number) => (
            <div data-testid={`file-row-${index}`} key={file.id || index}>
              {file.name}
            </div>
          ))}
        </div>
      )}
      <div data-testid="pagination-info">
        Page: {customPaginationProps?.currentPage}, Size:{' '}
        {customPaginationProps?.pageSize}
      </div>
      {customPaginationProps?.onShowSizeChange && (
        <button
          data-testid="change-page-size-25"
          onClick={() => customPaginationProps.onShowSizeChange(25)}>
          Change to 25
        </button>
      )}
      {customPaginationProps?.onShowSizeChange && (
        <button
          data-testid="change-page-size-50"
          onClick={() => customPaginationProps.onShowSizeChange(50)}>
          Change to 50
        </button>
      )}
    </div>
  ))
);

const mockFiles: File[] = [
  {
    id: 'file-1',
    name: 'report-q1.pdf',
    fullyQualifiedName: 'test-drive-service.report-q1.pdf',
    service: {
      id: 'service-1',
      type: 'driveService',
      name: 'test-drive-service',
      fullyQualifiedName: 'test-drive-service',
    },
  },
  {
    id: 'file-2',
    name: 'report-q2.pdf',
    fullyQualifiedName: 'test-drive-service.report-q2.pdf',
    service: {
      id: 'service-1',
      type: 'driveService',
      name: 'test-drive-service',
      fullyQualifiedName: 'test-drive-service',
    },
  },
];

const mockSearchResponse = {
  hits: {
    hits: mockFiles.map((file) => ({ _source: file })),
    total: { value: 100 },
  },
};

const mockSearchQuery = searchQuery as jest.MockedFunction<typeof searchQuery>;

/**
 * A stateful harness that mirrors how `ServiceDetailsPage` wires a real
 * `usePaging` instance into `FilesTable`. The `usePaging` hook owns
 * `pageSize`/`currentPage` state, so the harness does the same: it updates
 * `pageSize` (and resets `currentPage` to 1) when `handlePageSizeChange`
 * fires, exactly as the real hook does. This lets the search `useEffect`
 * observe a genuine `pageSize` transition — the scenario the bug report
 * describes.
 */
const FilesTableHarness = ({
  initialPageSize = 15,
}: {
  initialPageSize?: number;
}) => {
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagingData, setPagingData] = useState({ total: 0 });
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const paging: UsePagingInterface = {
    currentPage,
    pageSize,
    paging: pagingData,
    showPagination: pagingData.total > pageSize,
    handlePageSizeChange: (size: number) => {
      setPageSize(size);
      setCurrentPage(1);
    },
    handlePageChange: jest.fn(),
    handlePagingChange: setPagingData,
    pagingCursor: {
      cursorType: undefined,
      cursorValue: undefined,
      currentPage: String(currentPage),
      pageSize,
    },
  };

  const props: FilesTableProps = {
    showDeleted: false,
    handleShowDeleted: jest.fn(),
    paging,
    handlePageChange: jest.fn(),
    files,
    isLoading,
    setFiles,
    setIsLoading,
    serviceFqn: 'test-drive-service',
  };

  return <FilesTable {...props} />;
};

const renderFilesTable = (initialEntries: string[] = ['/?file=report']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <FilesTableHarness />
    </MemoryRouter>
  );

describe('FilesTable search page-size refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchQuery.mockResolvedValue(mockSearchResponse as never);
  });

  it('should fetch search results on mount with the initial page size', async () => {
    renderFilesTable();

    await waitFor(() => {
      expect(mockSearchQuery).toHaveBeenCalledTimes(1);
    });

    expect(mockSearchQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNumber: 1, pageSize: 15 })
    );
  });

  it('should refetch with the new page size when the picker changes during an active search on page 1', async () => {
    renderFilesTable();

    // Initial search fires with the default page size of 15.
    await waitFor(() => {
      expect(mockSearchQuery).toHaveBeenCalledTimes(1);
    });

    expect(mockSearchQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNumber: 1, pageSize: 15 })
    );

    // Simulate selecting "25 / page" while still on page 1 — the exact
    // scenario from the bug report where `currentPage` stays at 1 so the
    // old effect deps did not change.
    fireEvent.click(screen.getByTestId('change-page-size-25'));

    await waitFor(() => {
      expect(mockSearchQuery).toHaveBeenCalledTimes(2);
    });

    expect(mockSearchQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNumber: 1, pageSize: 25 })
    );

    // The table should now reflect the freshly fetched rows (not a stale page).
    expect(screen.getByTestId('file-row-0')).toHaveTextContent('report-q1.pdf');
  });

  it('should not infinitely re-fetch after a page-size change', async () => {
    renderFilesTable();

    await waitFor(() => {
      expect(mockSearchQuery).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByTestId('change-page-size-25'));

    await waitFor(() => {
      expect(mockSearchQuery).toHaveBeenCalledTimes(2);
    });

    // Allow any pending microtasks/state updates to flush, then confirm the
    // call count has stabilised at exactly two (the fix must not add
    // `searchFiles` to the deps, which would loop forever).
    await waitFor(() => {
      expect(screen.getByTestId('pagination-info')).toHaveTextContent(
        'Page: 1, Size: 25'
      );
    });

    expect(mockSearchQuery).toHaveBeenCalledTimes(2);
  });

  it('should refetch for successive page-size changes', async () => {
    renderFilesTable();

    await waitFor(() => {
      expect(mockSearchQuery).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByTestId('change-page-size-25'));

    await waitFor(() => {
      expect(mockSearchQuery).toHaveBeenCalledTimes(2);
    });

    expect(mockSearchQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageSize: 25 })
    );

    fireEvent.click(screen.getByTestId('change-page-size-50'));

    await waitFor(() => {
      expect(mockSearchQuery).toHaveBeenCalledTimes(3);
    });

    expect(mockSearchQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNumber: 1, pageSize: 50 })
    );

    expect(mockSearchQuery).toHaveBeenCalledTimes(3);
  });

  it('should not fire a search when there is no active file search query', () => {
    renderFilesTable(['/']);

    // No `?file=` param means searchValue is undefined, so the search effect
    // guard (`if (searchValue)`) must keep searchQuery uncalled.
    expect(mockSearchQuery).not.toHaveBeenCalled();
  });
});
