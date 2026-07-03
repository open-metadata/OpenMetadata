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
import QueryString from 'qs';
import { act } from 'react';
import { TestSuite } from '../../../../generated/tests/testCase';
import { getListTestSuitesBySearch } from '../../../../rest/testAPI';
import { useTestSuitesListPage } from './useTestSuitesListPage';

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: { testSuite: { ViewAll: true, ViewBasic: true } },
  }),
}));

jest.mock('../../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    currentPage: 1,
    pageSize: 10,
    paging: {},
    showPagination: false,
    handlePageChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
    handlePagingChange: jest.fn(),
  }),
}));

jest.mock('../../../../pages/DataQuality/DataQualityProvider', () => ({
  useDataQualityProvider: jest.fn().mockReturnValue({
    isTestCaseSummaryLoading: false,
    testCaseSummary: {},
  }),
}));

jest.mock('../../../../rest/testAPI', () => ({
  getListTestSuitesBySearch: jest.fn(),
}));

jest.mock('../../../../utils/PermissionsUtils', () => ({
  getPrioritizedViewPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Owner'),
}));

jest.mock('../../../../utils/ObservabilityRouterClassBase', () => ({
  __esModule: true,
  default: { getDataQualityPagePath: jest.fn() },
}));

const mockLocation = { search: '' };

jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () =>
  jest.fn().mockImplementation(() => mockLocation)
);

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
  useParams: jest.fn().mockReturnValue({}),
}));

const mockGetListTestSuitesBySearch =
  getListTestSuitesBySearch as jest.MockedFunction<
    typeof getListTestSuitesBySearch
  >;

type SuitesResponse = Awaited<ReturnType<typeof getListTestSuitesBySearch>>;

const createDeferred = () => {
  let resolve!: (value: SuitesResponse) => void;
  const promise = new Promise<SuitesResponse>((res) => {
    resolve = res;
  });

  return { promise, resolve };
};

const suite = (name: string): TestSuite =>
  ({ id: name, name, fullyQualifiedName: name } as unknown as TestSuite);

describe('useTestSuitesListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.search = '';
  });

  it('should apply the fetched test suites on load', async () => {
    mockGetListTestSuitesBySearch.mockResolvedValue({
      data: [suite('suite_a')],
      paging: {},
    } as SuitesResponse);

    const { result } = renderHook(() => useTestSuitesListPage());

    await waitFor(() =>
      expect(result.current.testSuites).toEqual([suite('suite_a')])
    );

    expect(result.current.isLoading).toBe(false);
  });

  it('should ignore a stale out-of-order response and keep only the latest request data', async () => {
    const first = createDeferred();
    const second = createDeferred();
    mockGetListTestSuitesBySearch
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(() => useTestSuitesListPage());

    // Trigger a second request (search change) while the first is in flight.
    mockLocation.search = QueryString.stringify({ searchValue: 'abc' });
    rerender();

    // Resolve the latest (second) request first, then the stale first request.
    await act(async () => {
      second.resolve({ data: [suite('latest')], paging: {} } as SuitesResponse);
    });
    await act(async () => {
      first.resolve({ data: [suite('stale')], paging: {} } as SuitesResponse);
    });

    expect(result.current.testSuites).toEqual([suite('latest')]);
  });
});
