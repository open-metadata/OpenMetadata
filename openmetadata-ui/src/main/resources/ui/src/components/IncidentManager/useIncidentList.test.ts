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
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { Table } from '../../generated/entity/data/table';
import { Include } from '../../generated/type/include';
import { useDomainStore } from '../../hooks/useDomainStore';
import { getListTestCaseIncidentStatusFromSearch } from '../../rest/incidentManagerAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { useIncidentList, UseIncidentListProps } from './useIncidentList';

const mockHandlePageChange = jest.fn();
const mockHandlePagingChange = jest.fn();
const mockHandlePageSizeChange = jest.fn();
const mockSetUsers = jest.fn();

jest.mock('../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockImplementation(() => ({
    currentPage: 1,
    paging: { after: '', before: '', total: 25 },
    showPagination: true,
    pageSize: 10,
    handlePageChange: mockHandlePageChange,
    handlePagingChange: mockHandlePagingChange,
    handlePageSizeChange: mockHandlePageSizeChange,
  })),
}));

jest.mock('../../hooks/useDomainStore', () => ({
  useDomainStore: jest.fn(),
}));

jest.mock('../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentStatusFromSearch: jest.fn(),
}));

jest.mock('../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation(
      (entity?: { displayName?: string; name?: string }) =>
        entity?.displayName ?? entity?.name ?? 'EntityName'
    ),
}));

const mockGetList = getListTestCaseIncidentStatusFromSearch as jest.Mock;
const mockUseDomainStore = useDomainStore as unknown as jest.Mock;

const makeProps = (
  over: Partial<UseIncidentListProps> = {}
): UseIncidentListProps => ({
  filters: {},
  setUsers: mockSetUsers,
  commonTestCasePermission: {
    ViewBasic: true,
  } as unknown as OperationPermission,
  ...over,
});

describe('useIncidentList', () => {
  beforeEach(() => {
    mockGetList.mockResolvedValue({ data: [], paging: {} });
    mockUseDomainStore.mockReturnValue({ activeDomain: 'All Domains' });
  });

  it('should expose the list state, paging bag and handlers', async () => {
    const props = makeProps();
    const { result } = renderHook(() => useIncidentList(props));

    await waitFor(() =>
      expect(result.current.testCaseListData.isLoading).toBe(false)
    );

    expect(result.current.showPagination).toBe(true);
    expect(typeof result.current.setTestCaseListData).toBe('function');
    expect(typeof result.current.fetchTestCaseIncidents).toBe('function');
    expect(typeof result.current.handlePagingClick).toBe('function');
    expect(result.current.pagingData).toEqual(
      expect.objectContaining({
        paging: { after: '', before: '', total: 25 },
        currentPage: 1,
        pageSize: 10,
        isNumberBased: true,
        onShowSizeChange: mockHandlePageSizeChange,
        pagingHandler: result.current.handlePagingClick,
      })
    );
  });

  it('should fetch incidents on mount with the injected filters and paging', async () => {
    const props = makeProps({ filters: { testCaseFQN: 'svc.db.tc' } });
    renderHook(() => useIncidentList(props));

    await waitFor(() => expect(mockGetList).toHaveBeenCalled());

    const callArg = mockGetList.mock.calls[0][0];

    expect(callArg).toEqual(
      expect.objectContaining({
        limit: 10,
        offset: 0,
        latest: true,
        include: Include.NonDeleted,
        testCaseFQN: 'svc.db.tc',
      })
    );
    expect(callArg.domain).toBeUndefined();
    expect(callArg.originEntityFQN).toBeUndefined();
  });

  it('should derive deduped assignee options from the response into setUsers', async () => {
    const assignee = {
      name: 'ua',
      type: 'user',
      fullyQualifiedName: 'ua',
      displayName: 'UA',
    };
    mockGetList.mockResolvedValueOnce({
      data: [
        { testCaseResolutionStatusDetails: { assignee } },
        { testCaseResolutionStatusDetails: { assignee } },
      ],
      paging: {},
    });
    const props = makeProps();
    renderHook(() => useIncidentList(props));

    await waitFor(() => expect(mockSetUsers).toHaveBeenCalled());

    const calls = mockSetUsers.mock.calls;
    const updater = calls[calls.length - 1][0] as (prev: {
      options: unknown[];
    }) => { options: unknown[] };

    expect(updater({ options: [] }).options).toEqual([
      { label: 'UA', value: 'ua', type: 'user', name: 'ua' },
    ]);
  });

  it('should not fetch and should stop loading without view permission', async () => {
    const props = makeProps({ commonTestCasePermission: undefined });
    const { result } = renderHook(() => useIncidentList(props));

    await waitFor(() =>
      expect(result.current.testCaseListData.isLoading).toBe(false)
    );

    expect(mockGetList).not.toHaveBeenCalled();
  });

  it('should refetch with the paged offset and advance the page on handlePagingClick', async () => {
    const props = makeProps({
      commonTestCasePermission: undefined,
      filters: { testCaseFQN: 'x' },
    });
    const { result } = renderHook(() => useIncidentList(props));

    act(() => {
      result.current.handlePagingClick({ currentPage: 3 });
    });

    await waitFor(() => expect(mockGetList).toHaveBeenCalled());

    const callArg = mockGetList.mock.calls[0][0];

    expect(callArg.offset).toBe(20);
    expect(callArg.testCaseFQN).toBe('x');
    expect(mockHandlePageChange).toHaveBeenCalledWith(3);
  });

  it('should request deleted incidents scoped to the origin table when tableDetails is deleted', async () => {
    const tableDetails = {
      deleted: true,
      fullyQualifiedName: 'svc.db.tbl',
    } as unknown as Table;
    const props = makeProps({ tableDetails });
    renderHook(() => useIncidentList(props));

    await waitFor(() => expect(mockGetList).toHaveBeenCalled());

    const callArg = mockGetList.mock.calls[0][0];

    expect(callArg.include).toBe(Include.Deleted);
    expect(callArg.originEntityFQN).toBe('svc.db.tbl');
  });

  it('should pass a non-default active domain through to the request', async () => {
    mockUseDomainStore.mockReturnValue({ activeDomain: 'my.domain' });
    const props = makeProps();
    renderHook(() => useIncidentList(props));

    await waitFor(() => expect(mockGetList).toHaveBeenCalled());

    expect(mockGetList.mock.calls[0][0].domain).toBe('my.domain');
  });

  it('should surface an error toast and stop loading when the fetch rejects', async () => {
    mockGetList.mockRejectedValueOnce(new Error('boom'));
    const props = makeProps();
    const { result } = renderHook(() => useIncidentList(props));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(result.current.testCaseListData.isLoading).toBe(false);
  });
});
