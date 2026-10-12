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
import { File } from '../../../generated/entity/data/file';
import { getDriveAssets } from '../../../rest/driveAPI';
import { useServiceDriveAssets } from './useServiceDriveAssets';

const mockFilters: Record<string, string | undefined> = {};
const mockPagingCursor: { cursorType?: string; cursorValue?: string } = {};
const mockHandlePageChange = jest.fn();
// Stable like the real hook's `setPaging`: a fresh function per render would refetch forever.
const mockHandlePagingChange = jest.fn();
const mockPaging = { after: 'next-cursor', before: 'prev-cursor', total: 30 };

jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: () => ({
    paging: mockPaging,
    pageSize: 15,
    currentPage: 1,
    handlePagingChange: mockHandlePagingChange,
    handlePageChange: mockHandlePageChange,
    pagingCursor: mockPagingCursor,
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

const ASSET_FIELDS = 'tags,owners,domains,dataProducts,certification';

const fileNamed = (name: string) => ({ name } as File);

// Holds each request open until the test resolves it — by index, in request order — so a request
// can be made to resolve after the one that followed it.
type ResolveList = (names: string[]) => void;

const deferResponses = (count: number): ResolveList[] => {
  const resolvers: ResolveList[] = [];
  const deferred = () =>
    new Promise((resolve) => {
      resolvers.push((names) =>
        resolve({ data: names.map(fileNamed), paging: { total: names.length } })
      );
    });
  for (let i = 0; i < count; i++) {
    (getDriveAssets as jest.Mock).mockImplementationOnce(deferred);
  }

  return resolvers;
};

const renderFiles = (showDeleted = false) =>
  renderHook(
    ({ deleted }) =>
      useServiceDriveAssets<File>(EntityType.FILE, 'drive-svc', deleted),
    { initialProps: { deleted: showDeleted } }
  );

describe('useServiceDriveAssets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete mockFilters.file;
    delete mockPagingCursor.cursorType;
    delete mockPagingCursor.cursorValue;
    (getDriveAssets as jest.Mock).mockResolvedValue({
      data: [fileNamed('q3-budget.pdf')],
      paging: { total: 1 },
    });
  });

  it('lists the top-level assets of the service with the fields the table renders', async () => {
    const { result } = renderFiles();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getDriveAssets).toHaveBeenCalledWith(EntityType.FILE, {
      service: 'drive-svc',
      fields: ASSET_FIELDS,
      root: true,
      paging: { limit: 15 },
      include: 'non-deleted',
    });
    expect(result.current.items).toEqual([fileNamed('q3-budget.pdf')]);
    expect(mockHandlePagingChange).toHaveBeenCalledWith({ total: 1 });
  });

  it('lists deleted assets when the deleted switch is on', async () => {
    renderFiles(true);

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
    renderFiles();

    await waitFor(() =>
      expect(getDriveAssets).toHaveBeenCalledWith(
        EntityType.FILE,
        expect.objectContaining({ paging: { after: 'cursor-2', limit: 15 } })
      )
    );
  });

  it('leaves the rows to the table while its search is active', () => {
    mockFilters.file = 'budget';
    renderFiles();

    expect(getDriveAssets).not.toHaveBeenCalled();
  });

  it('keeps the latest list when an earlier request resolves after it', async () => {
    const pending = deferResponses(2);
    const { result, rerender } = renderFiles();
    await waitFor(() => expect(getDriveAssets).toHaveBeenCalledTimes(1));

    rerender({ deleted: true });
    await waitFor(() => expect(getDriveAssets).toHaveBeenCalledTimes(2));

    await act(async () => pending[1](['deleted.pdf']));
    await act(async () => pending[0](['live.pdf']));

    expect(result.current.items).toEqual([fileNamed('deleted.pdf')]);
    expect(result.current.isLoading).toBe(false);
  });

  it('pages with the cursor of the direction asked for', async () => {
    const { result } = renderFiles();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() =>
      result.current.onPageChange({ cursorType: 'after', currentPage: 2 })
    );

    expect(mockHandlePageChange).toHaveBeenCalledWith(
      2,
      { cursorType: 'after', cursorValue: 'next-cursor' },
      15
    );
  });

  it('pages by number while searching, as search results have no cursor', async () => {
    mockFilters.file = 'budget';
    const { result } = renderFiles();

    act(() =>
      result.current.onPageChange({ cursorType: 'after', currentPage: 2 })
    );

    expect(mockHandlePageChange).toHaveBeenCalledWith(2);
  });

  it('empties the list and says why when the request fails', async () => {
    (getDriveAssets as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const { result } = renderFiles();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items).toEqual([]);
    expect(mockHandlePagingChange).toHaveBeenCalledWith(
      expect.objectContaining({ total: 0 })
    );
  });
});
