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
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { CursorType } from '../../../enums/pagination.enum';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import {
  deleteTestDefinitionByFqn,
  getListTestDefinitions,
  patchTestDefinition,
} from '../../../rest/testAPI';
import { showSuccessToast } from '../../../utils/ToastUtils';
import { useTestDefinitionListPage } from './useTestDefinitionListPage';

const MOCK_TEST_DEFINITIONS = [
  {
    id: 'id-1',
    name: 'columnValuesToBeUnique',
    fullyQualifiedName: 'columnValuesToBeUnique',
    enabled: false,
  },
  {
    id: 'id-2',
    name: 'tableRowCountToEqual',
    fullyQualifiedName: 'tableRowCountToEqual',
    enabled: true,
  },
] as unknown as TestDefinition[];

const MOCK_PAGING = { after: 'after-cursor', before: undefined, total: 2 };

const MOCK_PERMISSION = {
  ViewAll: true,
  ViewBasic: true,
} as unknown as OperationPermission;

const mockHandlePageChange = jest.fn();
const mockHandlePagingChange = jest.fn();
const mockHandlePageSizeChange = jest.fn();
const mockUpdateUrlParams = jest.fn();
const mockGetEntityPermissionByFqn = jest.fn();

// `mockPaging` is a stable reference so the data-loading effect (which depends
// on `pagingCursor` and `paging`) does not refire on every render and cause a
// fetch loop. `mockPageSize` and `mockPagingCursor` are mutable so individual
// tests can rerender with a changed page size or an active cursor and observe
// the refetch the effect performs; both are reset in `beforeEach`.
const mockPaging = { after: 'after-cursor', before: '', total: 2 };
let mockPageSize = 15;
let mockPagingCursor: {
  cursorType?: CursorType;
  cursorValue?: string;
} = {};

let mockUrlFilters: Record<string, string> = {};

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {
      testDefinition: {
        Create: true,
        ViewBasic: true,
        ViewAll: true,
      },
    },
    getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
  })),
}));

jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockImplementation(() => ({
    currentPage: 1,
    paging: mockPaging,
    pageSize: mockPageSize,
    handlePagingChange: mockHandlePagingChange,
    handlePageChange: mockHandlePageChange,
    handlePageSizeChange: mockHandlePageSizeChange,
    showPagination: true,
    pagingCursor: mockPagingCursor,
  })),
}));

jest.mock('../../../hooks/useTableFilters', () => ({
  useTableFilters: jest.fn().mockImplementation(() => ({
    filters: mockUrlFilters,
    setFilters: mockUpdateUrlParams,
  })),
}));

jest.mock('../../../rest/testAPI', () => ({
  getListTestDefinitions: jest.fn(),
  patchTestDefinition: jest.fn(),
  deleteTestDefinitionByFqn: jest.fn(),
}));

// The global setupTests mock for ToastUtils only exports showErrorToast; the
// hook also calls showSuccessToast, so override the module here to provide both.
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const renderTestDefinitionListPage = () =>
  renderHook(() => useTestDefinitionListPage());

const renderAndSettle = async () => {
  const rendered = renderTestDefinitionListPage();

  await waitFor(() => {
    expect(getListTestDefinitions).toHaveBeenCalled();
  });

  await waitFor(() => {
    expect(rendered.result.current.isLoading).toBe(false);
    expect(rendered.result.current.permissionLoading).toBe(false);
  });

  return rendered;
};

describe('useTestDefinitionListPage', () => {
  beforeEach(() => {
    mockUrlFilters = {};
    mockPageSize = 15;
    mockPagingCursor = {};
    mockHandlePageChange.mockReset();
    mockHandlePagingChange.mockReset();
    mockHandlePageSizeChange.mockReset();
    mockUpdateUrlParams.mockReset();
    (showSuccessToast as jest.Mock).mockClear();
    mockGetEntityPermissionByFqn.mockReset().mockResolvedValue(MOCK_PERMISSION);
    (getListTestDefinitions as jest.Mock)
      .mockReset()
      .mockResolvedValue({ data: MOCK_TEST_DEFINITIONS, paging: MOCK_PAGING });
    (patchTestDefinition as jest.Mock)
      .mockReset()
      .mockResolvedValue(MOCK_TEST_DEFINITIONS[0]);
    (deleteTestDefinitionByFqn as jest.Mock)
      .mockReset()
      .mockResolvedValue(undefined);
  });

  describe('return shape', () => {
    it('should expose the documented data, permission, filter and handler keys', async () => {
      const { result } = await renderAndSettle();

      const value = result.current;

      expect(Array.isArray(value.testDefinitions)).toBe(true);
      expect(typeof value.isLoading).toBe('boolean');
      expect(typeof value.createPermission).toBe('boolean');
      expect(typeof value.viewPermission).toBe('boolean');
      expect(typeof value.testDefinitionPermissions).toBe('object');
      expect(typeof value.permissionLoading).toBe('boolean');
      expect(typeof value.showPagination).toBe('boolean');
      expect(typeof value.hasActiveFilters).toBe('boolean');
      expect(typeof value.isFormVisible).toBe('boolean');
      expect(typeof value.isDeleteModalVisible).toBe('boolean');

      expect(typeof value.pagingData).toBe('object');
      expect(value.pagingData).toEqual(
        expect.objectContaining({
          currentPage: 1,
          pageSize: 15,
          paging: mockPaging,
          pagingHandler: expect.any(Function),
          onShowSizeChange: expect.any(Function),
          isLoading: expect.any(Boolean),
        })
      );

      expect(typeof value.urlFilters).toBe('object');
      expect(Array.isArray(value.parsedFilters)).toBe(true);

      expect(value.selectedDefinition).toBeUndefined();
      expect(value.definitionToDelete).toBeUndefined();

      expect(typeof value.setSingleFilter).toBe('function');
      expect(typeof value.handleFilterChange).toBe('function');
      expect(typeof value.clearAllFilters).toBe('function');
      expect(typeof value.openCreateForm).toBe('function');
      expect(typeof value.handleEnableToggle).toBe('function');
      expect(typeof value.handleEdit).toBe('function');
      expect(typeof value.handleDeleteClick).toBe('function');
      expect(typeof value.handleDeleteConfirm).toBe('function');
      expect(typeof value.handleDeleteCancel).toBe('function');
      expect(typeof value.handleFormSuccess).toBe('function');
      expect(typeof value.handleFormCancel).toBe('function');
      expect(typeof value.fetchTestDefinitions).toBe('function');
    });

    it('should derive createPermission and viewPermission from the resource permissions', async () => {
      const { result } = await renderAndSettle();

      expect(result.current.createPermission).toBe(true);
      expect(result.current.viewPermission).toBe(true);
    });

    it('should expose currentPage and pageSize at the top level, not only inside pagingData', async () => {
      const { result } = await renderAndSettle();

      expect(result.current.currentPage).toBe(1);
      expect(result.current.pageSize).toBe(15);
    });
  });

  describe('fetchTestDefinitions', () => {
    it('should load the list on mount using the current page size and no cursor', async () => {
      const { result } = await renderAndSettle();

      expect(getListTestDefinitions).toHaveBeenCalledWith({
        after: undefined,
        before: undefined,
        limit: 15,
        entityType: undefined,
        testPlatform: undefined,
      });
      expect(result.current.testDefinitions).toEqual(MOCK_TEST_DEFINITIONS);
      expect(mockHandlePagingChange).toHaveBeenCalledWith(MOCK_PAGING);
    });

    it('should fan out per-row permissions via Promise.allSettled and key them by definition name', async () => {
      const { result } = await renderAndSettle();

      expect(mockGetEntityPermissionByFqn).toHaveBeenCalledTimes(2);
      expect(mockGetEntityPermissionByFqn).toHaveBeenNthCalledWith(
        1,
        ResourceEntity.TEST_DEFINITION,
        'columnValuesToBeUnique'
      );
      expect(mockGetEntityPermissionByFqn).toHaveBeenNthCalledWith(
        2,
        ResourceEntity.TEST_DEFINITION,
        'tableRowCountToEqual'
      );
      expect(result.current.testDefinitionPermissions).toEqual({
        columnValuesToBeUnique: MOCK_PERMISSION,
        tableRowCountToEqual: MOCK_PERMISSION,
      });
    });

    it('should keep permissionLoading true until the per-row permission promises settle', async () => {
      let resolvePermission: (value: unknown) => void = () => undefined;
      mockGetEntityPermissionByFqn.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePermission = resolve;
          })
      );

      const { result } = renderTestDefinitionListPage();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.permissionLoading).toBe(true);

      await act(async () => {
        resolvePermission(MOCK_PERMISSION);
      });

      await waitFor(() => {
        expect(result.current.permissionLoading).toBe(false);
      });
    });

    it('should skip the permission fan-out and empty the map for an empty list', async () => {
      (getListTestDefinitions as jest.Mock).mockResolvedValue({
        data: [],
        paging: MOCK_PAGING,
      });

      const { result } = await renderAndSettle();

      expect(mockGetEntityPermissionByFqn).not.toHaveBeenCalled();
      expect(result.current.testDefinitionPermissions).toEqual({});
    });
  });

  describe('filters', () => {
    it('should report hasActiveFilters false without url filter params', async () => {
      const { result } = await renderAndSettle();

      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('should report hasActiveFilters true and reflect a url filter in urlFilters', async () => {
      mockUrlFilters = { entityType: 'table' };

      const { result } = await renderAndSettle();

      expect(result.current.hasActiveFilters).toBe(true);
      expect(result.current.urlFilters).toEqual({ entityType: ['table'] });
    });

    it('should reset paging to the first page and update the url param on setSingleFilter', async () => {
      const { result } = await renderAndSettle();

      act(() => {
        result.current.setSingleFilter('entityType', 'table');
      });

      expect(mockUpdateUrlParams).toHaveBeenCalledWith({ entityType: 'table' });
      expect(mockHandlePageChange).toHaveBeenCalledWith(1, {
        cursorType: null,
        cursorValue: undefined,
      });
    });

    it('should clear then set the quick filters and reset paging on handleFilterChange', async () => {
      const { result } = await renderAndSettle();

      act(() => {
        result.current.handleFilterChange([
          {
            label: 'label.entity-type',
            key: 'entityType',
            value: [{ key: 'table', label: 'Table' }],
          },
        ]);
      });

      expect(mockUpdateUrlParams).toHaveBeenCalledWith({
        entityType: 'table',
        testPlatforms: null,
      });
      expect(mockHandlePageChange).toHaveBeenCalledWith(1, {
        cursorType: null,
        cursorValue: undefined,
      });
    });

    it('should null every quick filter and reset paging on clearAllFilters', async () => {
      const { result } = await renderAndSettle();

      act(() => {
        result.current.clearAllFilters();
      });

      expect(mockUpdateUrlParams).toHaveBeenCalledWith({
        entityType: null,
        testPlatforms: null,
      });
      expect(mockHandlePageChange).toHaveBeenCalledWith(1, {
        cursorType: null,
        cursorValue: undefined,
      });
    });

    it('should refetch with the entityType/testPlatform filter when url filters change', async () => {
      const { rerender, result } = await renderAndSettle();

      (getListTestDefinitions as jest.Mock).mockClear();
      mockUrlFilters = { entityType: 'table', testPlatforms: 'OpenMetadata' };

      rerender();

      await waitFor(() => {
        expect(getListTestDefinitions).toHaveBeenCalledWith({
          after: undefined,
          before: undefined,
          limit: 15,
          entityType: 'table',
          testPlatform: 'OpenMetadata',
        });
      });

      await waitFor(() => {
        expect(mockGetEntityPermissionByFqn).toHaveBeenCalledTimes(4);
        expect(result.current.permissionLoading).toBe(false);
      });
    });
  });

  describe('parsedFilters', () => {
    it('should map every TEST_DEFINITION_FILTERS entry through with an empty value list when no url filters are set', async () => {
      const { result } = await renderAndSettle();

      const parsed = result.current.parsedFilters;

      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual(
        expect.objectContaining({
          key: 'entityType',
          label: 'label.entity-type',
          value: [],
        })
      );
      expect(parsed[1]).toEqual(
        expect.objectContaining({
          key: 'testPlatforms',
          label: 'label.test-platform-plural',
          value: [],
        })
      );
      // The original filter `options` are spread through untouched.
      expect(Array.isArray(parsed[0].options)).toBe(true);
      expect(parsed[0].options).toEqual(
        expect.arrayContaining([expect.objectContaining({ key: 'TABLE' })])
      );
    });

    it('should map url filter values through mapUrlValueToOption per filter key', async () => {
      mockUrlFilters = { entityType: 'table', testPlatforms: 'OpenMetadata' };

      const { result } = await renderAndSettle();

      const parsed = result.current.parsedFilters;

      // `table` does not match the `TABLE` option key, so mapUrlValueToOption
      // falls back to using the raw value for the label.
      expect(parsed[0].value).toEqual([{ key: 'table', label: 'table' }]);
      // `OpenMetadata` matches a platform option, so the option label is used
      // (which equals the value here).
      expect(parsed[1].value).toEqual([
        { key: 'OpenMetadata', label: 'OpenMetadata' },
      ]);
    });

    it('should keep only the first value from a comma separated url filter', async () => {
      mockUrlFilters = { entityType: 'table,column' };

      const { result } = await renderAndSettle();

      expect(result.current.urlFilters).toEqual({ entityType: ['table'] });
      expect(result.current.parsedFilters[0].value).toEqual([
        { key: 'table', label: 'table' },
      ]);
    });

    it('should drop empty segments via filter(Boolean) and keep the first surviving value', async () => {
      mockUrlFilters = { entityType: ',,table,,' };

      const { result } = await renderAndSettle();

      expect(result.current.urlFilters).toEqual({ entityType: ['table'] });
    });

    it('should yield an empty value list and no active filter when every segment is empty', async () => {
      mockUrlFilters = { entityType: ',,,' };

      const { result } = await renderAndSettle();

      expect(result.current.urlFilters).toEqual({ entityType: [] });
      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  describe('pagination effect refetch', () => {
    it('should refetch with an after cursor when pagingCursor carries an after value', async () => {
      const { rerender } = await renderAndSettle();

      (getListTestDefinitions as jest.Mock).mockClear();
      mockPagingCursor = {
        cursorType: CursorType.AFTER,
        cursorValue: 'next-after',
      };

      rerender();

      await waitFor(() => {
        expect(getListTestDefinitions).toHaveBeenCalledWith(
          expect.objectContaining({
            after: 'next-after',
            before: undefined,
            limit: 15,
          })
        );
      });
    });

    it('should refetch with a before cursor when pagingCursor carries a before value', async () => {
      const { rerender } = await renderAndSettle();

      (getListTestDefinitions as jest.Mock).mockClear();
      mockPagingCursor = {
        cursorType: CursorType.BEFORE,
        cursorValue: 'prev-before',
      };

      rerender();

      await waitFor(() => {
        expect(getListTestDefinitions).toHaveBeenCalledWith(
          expect.objectContaining({
            after: undefined,
            before: 'prev-before',
            limit: 15,
          })
        );
      });
    });

    it('should refetch with the new page size when pageSize changes', async () => {
      const { rerender } = await renderAndSettle();

      (getListTestDefinitions as jest.Mock).mockClear();
      mockPageSize = 25;

      rerender();

      await waitFor(() => {
        expect(getListTestDefinitions).toHaveBeenCalledWith(
          expect.objectContaining({ limit: 25 })
        );
      });
    });
  });

  describe('pagingData.pagingHandler', () => {
    it('should forward the after cursor value read from paging to handlePageChange', async () => {
      const { result } = await renderAndSettle();

      act(() => {
        result.current.pagingData.pagingHandler({
          cursorType: CursorType.AFTER,
          currentPage: 2,
        });
      });

      expect(mockHandlePageChange).toHaveBeenCalledWith(
        2,
        { cursorType: CursorType.AFTER, cursorValue: 'after-cursor' },
        15
      );
    });

    it('should forward the before cursor value read from paging to handlePageChange', async () => {
      const { result } = await renderAndSettle();

      act(() => {
        result.current.pagingData.pagingHandler({
          cursorType: CursorType.BEFORE,
          currentPage: 1,
        });
      });

      expect(mockHandlePageChange).toHaveBeenCalledWith(
        1,
        { cursorType: CursorType.BEFORE, cursorValue: '' },
        15
      );
    });

    it('should be a no-op when the handler is called without a cursorType', async () => {
      const { result } = await renderAndSettle();

      act(() => {
        result.current.pagingData.pagingHandler({ currentPage: 3 });
      });

      expect(mockHandlePageChange).not.toHaveBeenCalled();
    });
  });

  describe('delete flow', () => {
    it('should open the delete modal with the target definition on handleDeleteClick', async () => {
      const { result } = await renderAndSettle();

      act(() => {
        result.current.handleDeleteClick(MOCK_TEST_DEFINITIONS[0]);
      });

      expect(result.current.isDeleteModalVisible).toBe(true);
      expect(result.current.definitionToDelete).toEqual(
        MOCK_TEST_DEFINITIONS[0]
      );
      expect(deleteTestDefinitionByFqn).not.toHaveBeenCalled();
    });

    it('should delete, close the modal, reset paging and refetch on handleDeleteConfirm', async () => {
      const { result } = await renderAndSettle();

      act(() => {
        result.current.handleDeleteClick(MOCK_TEST_DEFINITIONS[0]);
      });

      (getListTestDefinitions as jest.Mock).mockClear();

      await act(async () => {
        await result.current.handleDeleteConfirm();
      });

      await waitFor(() => {
        expect(mockGetEntityPermissionByFqn).toHaveBeenCalledTimes(4);
        expect(result.current.permissionLoading).toBe(false);
      });

      expect(deleteTestDefinitionByFqn).toHaveBeenCalledWith(
        'columnValuesToBeUnique'
      );
      expect(mockHandlePageChange).toHaveBeenCalledWith(1, {
        cursorType: null,
        cursorValue: undefined,
      });
      expect(getListTestDefinitions).toHaveBeenCalledTimes(1);
      expect(result.current.isDeleteModalVisible).toBe(false);
      expect(result.current.definitionToDelete).toBeUndefined();
    });

    it('should be a no-op when handleDeleteConfirm runs without a target', async () => {
      const { result } = await renderAndSettle();

      await act(async () => {
        await result.current.handleDeleteConfirm();
      });

      expect(deleteTestDefinitionByFqn).not.toHaveBeenCalled();
    });

    it('should close the modal and clear the target without calling the api on handleDeleteCancel', async () => {
      const { result } = await renderAndSettle();

      act(() => {
        result.current.handleDeleteClick(MOCK_TEST_DEFINITIONS[0]);
      });

      act(() => {
        result.current.handleDeleteCancel();
      });

      expect(result.current.isDeleteModalVisible).toBe(false);
      expect(result.current.definitionToDelete).toBeUndefined();
      expect(deleteTestDefinitionByFqn).not.toHaveBeenCalled();
    });
  });

  describe('handleEnableToggle', () => {
    it('should patch the definition and optimistically flip the row enabled state', async () => {
      const { result } = await renderAndSettle();

      await act(async () => {
        await result.current.handleEnableToggle(MOCK_TEST_DEFINITIONS[0], true);
      });

      // The record starts with `enabled: false`, so compare() against
      // `{ ...record, enabled: true }` yields a single replace op.
      expect(patchTestDefinition).toHaveBeenCalledWith('id-1', [
        { op: 'replace', path: '/enabled', value: true },
      ]);
      expect(showSuccessToast).toHaveBeenCalledWith(
        'server.entity-updated-success'
      );

      const updatedRow = result.current.testDefinitions.find(
        (item) => item.id === 'id-1'
      );

      expect(updatedRow?.enabled).toBe(true);
    });
  });

  describe('create/edit form', () => {
    it('should open the form with no selection on openCreateForm', async () => {
      const { result } = await renderAndSettle();

      act(() => {
        result.current.openCreateForm();
      });

      expect(result.current.isFormVisible).toBe(true);
      expect(result.current.selectedDefinition).toBeUndefined();
    });

    it('should open the form with the selected definition on handleEdit', async () => {
      const { result } = await renderAndSettle();

      act(() => {
        result.current.handleEdit(MOCK_TEST_DEFINITIONS[1]);
      });

      expect(result.current.isFormVisible).toBe(true);
      expect(result.current.selectedDefinition).toEqual(
        MOCK_TEST_DEFINITIONS[1]
      );
    });

    it('should close the form and clear the selection on handleFormCancel', async () => {
      const { result } = await renderAndSettle();

      act(() => {
        result.current.handleEdit(MOCK_TEST_DEFINITIONS[1]);
      });

      act(() => {
        result.current.handleFormCancel();
      });

      expect(result.current.isFormVisible).toBe(false);
      expect(result.current.selectedDefinition).toBeUndefined();
    });

    it('should close the form, reset paging and refetch on a create success', async () => {
      const { result } = await renderAndSettle();

      act(() => {
        result.current.openCreateForm();
      });

      (getListTestDefinitions as jest.Mock).mockClear();

      act(() => {
        result.current.handleFormSuccess();
      });

      expect(result.current.isFormVisible).toBe(false);
      expect(mockHandlePageChange).toHaveBeenCalledWith(1, {
        cursorType: null,
        cursorValue: undefined,
      });

      await waitFor(() => {
        expect(getListTestDefinitions).toHaveBeenCalledTimes(1);
        expect(mockGetEntityPermissionByFqn).toHaveBeenCalledTimes(4);
        expect(result.current.permissionLoading).toBe(false);
      });
    });

    it('should update the row in place without refetching on an edit success', async () => {
      const { result } = await renderAndSettle();

      act(() => {
        result.current.handleEdit(MOCK_TEST_DEFINITIONS[1]);
      });

      (getListTestDefinitions as jest.Mock).mockClear();

      const editedRow = {
        ...MOCK_TEST_DEFINITIONS[1],
        displayName: 'Edited Row',
      } as TestDefinition;

      act(() => {
        result.current.handleFormSuccess(editedRow);
      });

      expect(result.current.isFormVisible).toBe(false);
      expect(getListTestDefinitions).not.toHaveBeenCalled();

      const updatedRow = result.current.testDefinitions.find(
        (item) => item.id === 'id-2'
      );

      expect(updatedRow?.displayName).toBe('Edited Row');
    });
  });
});
