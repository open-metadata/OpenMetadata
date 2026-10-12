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
import { act, renderHook, waitFor } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { CursorType } from '../../../enums/pagination.enum';
import { File } from '../../../generated/entity/data/file';
import { getDriveAssets } from '../../../rest/driveAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useDriveAssetList } from './useDriveAssetList';

const mockPagingCursor: { cursorType?: string; cursorValue?: string } = {};
const mockFilters: Record<string, string | undefined> = {};
const mockHandlePageChange = jest.fn();
const mockHandlePagingChange = jest.fn();
const mockPaging = { total: 30, after: 'cursor-2', before: 'cursor-0' };

jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: () => ({
    paging: mockPaging,
    pageSize: 15,
    currentPage: 1,
    pagingCursor: mockPagingCursor,
    handlePageChange: mockHandlePageChange,
    handlePagingChange: mockHandlePagingChange,
  }),
}));

jest.mock('../../../hooks/useTableFilters', () => ({
  useTableFilters: () => ({ filters: mockFilters, setFilters: jest.fn() }),
}));

jest.mock('../../../rest/driveAPI', () => ({
  getDriveAssets: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const FILES = [{ id: 'file-1', name: 'report.csv' }];
const ASSET_FIELDS = 'tags,owners,domains,dataProducts,certification';

const renderFileList = (showDeleted = false) =>
  renderHook(() =>
    useDriveAssetList<File>({
      entityType: EntityType.FILE,
      searchParam: 'file',
      serviceFqn: 'gdrive',
      showDeleted,
    })
  );

describe('useDriveAssetList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete mockPagingCursor.cursorType;
    delete mockPagingCursor.cursorValue;
    delete mockFilters.file;
    (getDriveAssets as jest.Mock).mockResolvedValue({
      data: FILES,
      paging: { total: 1 },
    });
  });

  it('lists the top-level files of the service', async () => {
    const { result } = renderFileList();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getDriveAssets).toHaveBeenCalledWith(EntityType.FILE, {
      service: 'gdrive',
      fields: ASSET_FIELDS,
      root: true,
      include: 'non-deleted',
      paging: { limit: 15 },
    });
    expect(result.current.assets).toEqual(FILES);
    expect(mockHandlePagingChange).toHaveBeenCalledWith({ total: 1 });
  });

  it('lists deleted files when the deleted switch is on', async () => {
    renderFileList(true);

    await waitFor(() =>
      expect(getDriveAssets).toHaveBeenCalledWith(
        EntityType.FILE,
        expect.objectContaining({ include: 'deleted' })
      )
    );
  });

  it('fetches the page the URL cursor points at', async () => {
    mockPagingCursor.cursorType = 'after';
    mockPagingCursor.cursorValue = 'cursor-2';

    renderFileList();

    await waitFor(() =>
      expect(getDriveAssets).toHaveBeenCalledWith(
        EntityType.FILE,
        expect.objectContaining({
          paging: { limit: 15, after: 'cursor-2' },
        })
      )
    );
  });

  it('leaves the rows to the table search while one is active', async () => {
    mockFilters.file = 'report';

    renderFileList();

    // Flush effects; the search has the table, so no list request may be made.
    await act(async () => Promise.resolve());

    expect(getDriveAssets).not.toHaveBeenCalled();
  });

  it('pages by cursor, carrying the page size', async () => {
    const { result } = renderFileList();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() =>
      result.current.handleAssetPageChange({
        cursorType: CursorType.AFTER,
        currentPage: 2,
      })
    );

    expect(mockHandlePageChange).toHaveBeenCalledWith(
      2,
      { cursorType: 'after', cursorValue: 'cursor-2' },
      15
    );
  });

  it('clears the rows and reports the error when the list fails', async () => {
    (getDriveAssets as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderFileList();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.assets).toEqual([]);
    expect(showErrorToast).toHaveBeenCalled();
  });
});
