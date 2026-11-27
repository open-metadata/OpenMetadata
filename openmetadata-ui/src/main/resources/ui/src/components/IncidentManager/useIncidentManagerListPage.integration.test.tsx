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
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TestCaseResolutionStatusTypes } from '../../generated/tests/testCaseResolutionStatus';
import { usePersistentStorage } from '../../hooks/currentUserStore/useCurrentUserStore';
import { getListTestCaseIncidentStatusFromSearch } from '../../rest/incidentManagerAPI';
import { useIncidentManagerListPage } from './useIncidentManagerListPage';

// The router, usePaging and the URL-backed filters are REAL here: together they decide how many
// list requests one paging action sends, since the page lands in component state first and in the
// URL in a later render. Only REST calls, providers and the filter-option lookups are mocked.
const mockCurrentUser = { name: 'incident-paging-user' };
const mockPermissionProvider = {
  permissions: { testCase: { ViewAll: true, ViewBasic: true } },
  getEntityPermissionByFqn: jest.fn().mockResolvedValue({}),
};
const mockFilterOptions = {
  assigneeOptionsWithSelected: [],
  selectedAssignees: [],
  setUsers: jest.fn(),
  fetchUserFilterOptions: jest.fn(),
  searchTestCases: jest.fn(),
};

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn((selector) =>
    selector({ currentUser: mockCurrentUser })
  ),
}));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(() => mockPermissionProvider),
}));

jest.mock('./useIncidentFilterOptions', () => ({
  useIncidentFilterOptions: jest.fn(() => mockFilterOptions),
}));

jest.mock('../../rest/incidentManagerAPI', () => ({
  ...jest.requireActual('../../rest/incidentManagerAPI'),
  getListTestCaseIncidentStatusFromSearch: jest.fn(),
}));

const mockGetList = getListTestCaseIncidentStatusFromSearch as jest.Mock;

const rowsAt = (offset: number) => ({
  data: [{ id: `row-${offset}` }],
  paging: { total: 100 },
});

const makeWrapper =
  (search = '') =>
  ({ children }: { children: ReactNode }) =>
    (
      <MemoryRouter initialEntries={[`/incident-manager${search}`]}>
        <Routes>
          <Route element={children} path="/incident-manager" />
        </Routes>
      </MemoryRouter>
    );

const renderLoadedPage = async (search = '') => {
  const rendered = renderHook(() => useIncidentManagerListPage({}), {
    wrapper: makeWrapper(search),
  });

  await waitFor(() =>
    expect(rendered.result.current.testCaseListData.isLoading).toBe(false)
  );

  return rendered;
};

describe('useIncidentManagerListPage (integration)', () => {
  beforeEach(() => {
    usePersistentStorage.getState().clearUserPreference('incident-paging-user');
    mockGetList
      .mockReset()
      .mockImplementation(({ offset }) => Promise.resolve(rowsAt(offset)));
  });

  it('sends one list request for the selected page', async () => {
    const { result } = await renderLoadedPage();
    const { pageSize } = result.current.pagingData;
    mockGetList.mockClear();

    await act(async () => {
      result.current.pagingData.pagingHandler({ currentPage: 3 });
    });
    await waitFor(() =>
      expect(result.current.testCaseListData.isLoading).toBe(false)
    );

    expect(result.current.pagingData.currentPage).toBe(3);
    expect(mockGetList).toHaveBeenCalledTimes(1);
    expect(mockGetList.mock.calls[0][0]).toEqual(
      expect.objectContaining({ offset: 2 * pageSize })
    );
    expect(result.current.testCaseListData.data[0].id).toBe(
      `row-${2 * pageSize}`
    );
  });

  it('fetches the page named in the URL on first load', async () => {
    const { result } = await renderLoadedPage('?currentPage=3');
    const { pageSize } = result.current.pagingData;

    expect(result.current.pagingData.currentPage).toBe(3);
    expect(mockGetList).toHaveBeenCalledTimes(1);
    expect(mockGetList.mock.calls[0][0]).toEqual(
      expect.objectContaining({ offset: 2 * pageSize })
    );
  });

  it('shows the last page asked for when an earlier response arrives later', async () => {
    const { result } = await renderLoadedPage();
    const { pageSize } = result.current.pagingData;
    let resolveSecondPage: () => void = jest.fn();
    mockGetList.mockImplementation(({ offset }) =>
      offset === pageSize
        ? new Promise((resolve) => {
            resolveSecondPage = () => resolve(rowsAt(offset));
          })
        : Promise.resolve(rowsAt(offset))
    );

    await act(async () => {
      result.current.pagingData.pagingHandler({ currentPage: 2 });
    });
    await act(async () => {
      result.current.pagingData.pagingHandler({ currentPage: 3 });
    });
    await waitFor(() =>
      expect(result.current.testCaseListData.isLoading).toBe(false)
    );
    await act(async () => {
      resolveSecondPage();
    });

    expect(result.current.pagingData.currentPage).toBe(3);
    expect(result.current.testCaseListData.data[0].id).toBe(
      `row-${2 * pageSize}`
    );
  });

  it('refetches the first page once when a filter changes on a later page', async () => {
    const { result } = await renderLoadedPage();

    await act(async () => {
      result.current.pagingData.pagingHandler({ currentPage: 3 });
    });
    await waitFor(() =>
      expect(result.current.testCaseListData.isLoading).toBe(false)
    );
    mockGetList.mockClear();

    await act(async () => {
      result.current.updateFilters({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.ACK,
      });
    });
    await waitFor(() =>
      expect(result.current.testCaseListData.isLoading).toBe(false)
    );

    expect(result.current.pagingData.currentPage).toBe(1);
    expect(mockGetList).toHaveBeenCalledTimes(1);
    expect(mockGetList.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        offset: 0,
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.ACK,
      })
    );
  });
});
