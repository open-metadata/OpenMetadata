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
import { TestCaseStatus } from '../../../generated/tests/testCase';
import { usePersistentStorage } from '../../../hooks/currentUserStore/useCurrentUserStore';
import { getListTestCaseBySearch } from '../../../rest/testAPI';
import { useTestCaseListPage } from './useTestCaseListPage';

// The router, usePaging and the URL-backed filters are REAL here: together they decide how many
// list requests one paging action sends, since the page lands in component state first and in the
// URL in a later (transition) render. Only REST calls and context providers are mocked.
// Providers hand out the same objects on every render, as the real ones do; a fresh permission
// object per render would re-run the fetch effect on every render.
const mockCurrentUser = { name: 'dq-paging-user' };
const mockPermissions = {
  testCase: { ViewAll: true, ViewBasic: true },
  testSuite: {},
};
const mockSummary = { isTestCaseSummaryLoading: false, testCaseSummary: {} };
const mockExportModal = { showModal: jest.fn() };

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn((selector) =>
    selector({ currentUser: mockCurrentUser })
  ),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(() => ({ permissions: mockPermissions })),
}));

jest.mock('../../../pages/DataQuality/DataQualityProvider', () => ({
  useDataQualityProvider: jest.fn(() => mockSummary),
}));

jest.mock(
  '../../Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: jest.fn(() => mockExportModal),
  })
);

jest.mock('../../../rest/testAPI', () => ({
  ...jest.requireActual('../../../rest/testAPI'),
  getListTestCaseBySearch: jest.fn(),
}));

jest.mock('../../../rest/searchAPI', () => ({
  ...jest.requireActual('../../../rest/searchAPI'),
  searchQuery: jest
    .fn()
    .mockResolvedValue({ hits: { hits: [], total: { value: 0 } } }),
}));

jest.mock('../../../rest/tagAPI', () => ({
  ...jest.requireActual('../../../rest/tagAPI'),
  getTags: jest.fn().mockResolvedValue({ data: [] }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={['/data-quality/test-cases']}>
    <Routes>
      <Route element={children} path="/data-quality/:tab" />
    </Routes>
  </MemoryRouter>
);

const listRequests = () => (getListTestCaseBySearch as jest.Mock).mock.calls;

const renderLoadedPage = async () => {
  const rendered = renderHook(() => useTestCaseListPage(), { wrapper });

  await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
  (getListTestCaseBySearch as jest.Mock).mockClear();

  return rendered;
};

describe('useTestCaseListPage (integration)', () => {
  beforeEach(() => {
    usePersistentStorage.getState().clearUserPreference('dq-paging-user');
    (getListTestCaseBySearch as jest.Mock).mockReset().mockResolvedValue({
      data: [],
      paging: { total: 100 },
    });
  });

  it('sends one list request when the page changes', async () => {
    const { result } = await renderLoadedPage();
    const { pageSize } = result.current.pagingData;

    await act(async () => {
      result.current.pagingData.pagingHandler({ currentPage: 2 });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.pagingData.currentPage).toBe(2);
    expect(listRequests()).toHaveLength(1);
    expect(listRequests()[0][0]).toEqual(
      expect.objectContaining({ offset: pageSize })
    );
  });

  it('sends one list request when the page size changes', async () => {
    const { result } = await renderLoadedPage();

    await act(async () => {
      result.current.pagingData.onShowSizeChange?.(25);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listRequests()).toHaveLength(1);
    expect(listRequests()[0][0]).toEqual(
      expect.objectContaining({ limit: 25, offset: 0 })
    );
  });

  it('refetches the first page once when a filter changes on a later page', async () => {
    const { result } = await renderLoadedPage();

    await act(async () => {
      result.current.pagingData.pagingHandler({ currentPage: 3 });
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    (getListTestCaseBySearch as jest.Mock).mockClear();

    await act(async () => {
      result.current.handleSearchParam('testCaseStatus', [
        TestCaseStatus.Failed,
      ]);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.pagingData.currentPage).toBe(1);
    expect(listRequests()).toHaveLength(1);
    expect(listRequests()[0][0]).toEqual(
      expect.objectContaining({
        offset: 0,
        testCaseStatus: [TestCaseStatus.Failed],
      })
    );
  });

  it('refreshes the page it is on when asked for the same page', async () => {
    const { result } = await renderLoadedPage();

    await act(async () => {
      result.current.pagingData.pagingHandler({ currentPage: 1 });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listRequests()).toHaveLength(1);
    expect(listRequests()[0][0]).toEqual(
      expect.objectContaining({ offset: 0 })
    );
  });
});
