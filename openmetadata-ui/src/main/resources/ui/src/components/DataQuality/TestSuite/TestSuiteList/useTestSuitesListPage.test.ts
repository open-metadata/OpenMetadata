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
import { useParams } from 'react-router-dom';
import { EntityReference } from '../../../../generated/entity/type';
import { TestSuite } from '../../../../generated/tests/testCase';
import {
  DataQualityPageTabs,
  DataQualitySubTabs,
} from '../../../../pages/DataQuality/DataQualityPage.interface';
import { useDataQualityProvider } from '../../../../pages/DataQuality/DataQualityProvider';
import { getListTestSuitesBySearch } from '../../../../rest/testAPI';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import { getPrioritizedViewPermission } from '../../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { useTestSuitesListPage } from './useTestSuitesListPage';

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: { testSuite: { ViewAll: true, ViewBasic: true } },
  }),
}));

// Mutable so tests can simulate usePaging emitting a new page / page size on a
// rerender (the real hook stores these in state; here we drive them directly).
const mockUsePaging = {
  currentPage: 1,
  pageSize: 10,
  paging: {},
  showPagination: false,
  handlePageChange: jest.fn(),
  handlePageSizeChange: jest.fn(),
  handlePagingChange: jest.fn(),
};

jest.mock('../../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn(() => mockUsePaging),
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

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
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

// A "basic" suite: the sort must read basicEntityReference.fullyQualifiedName,
// NOT the top-level fullyQualifiedName (deliberately set to a different value).
const basicSuite = (id: string, basicFqn: string): TestSuite =>
  ({
    id,
    name: id,
    basic: true,
    basicEntityReference: { fullyQualifiedName: basicFqn },
    fullyQualifiedName: `top-${basicFqn}`,
  } as unknown as TestSuite);

describe('useTestSuitesListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.search = '';
    mockUsePaging.currentPage = 1;
    mockUsePaging.pageSize = 10;
    mockUsePaging.paging = {};
    mockUsePaging.showPagination = false;
    (useParams as jest.Mock).mockReturnValue({});
    (getPrioritizedViewPermission as jest.Mock).mockReturnValue(true);
    (useDataQualityProvider as jest.Mock).mockReturnValue({
      isTestCaseSummaryLoading: false,
      testCaseSummary: {},
    });
    mockGetListTestSuitesBySearch.mockResolvedValue({
      data: [],
      paging: {},
    } as SuitesResponse);
  });

  it('should expose the documented return shape with the expected value kinds', async () => {
    const { result } = renderHook(() => useTestSuitesListPage());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const value = result.current;

    expect(Array.isArray(value.testSuites)).toBe(true);
    expect(Array.isArray(value.sortedData)).toBe(true);
    expect(Array.isArray(value.columnList)).toBe(true);
    expect(value.columnList).toHaveLength(4);
    expect(value.columnList.map((column) => column.id)).toEqual([
      'name',
      'tests',
      'success',
      'owners',
    ]);
    expect(value.sortDescriptor).toBeUndefined();
    expect(typeof value.setSortDescriptor).toBe('function');
    expect(typeof value.isLoading).toBe('boolean');
    expect(typeof value.testSuitePermission).toBe('object');
    expect(value.testSuitePermission).toEqual({
      ViewAll: true,
      ViewBasic: true,
    });
    expect(value.searchValue).toBeUndefined();
    expect(value.selectedOwner).toBeUndefined();
    expect(value.ownerFilterValue).toBeUndefined();
    expect(typeof value.handleSearchParam).toBe('function');
    expect(typeof value.handleOwnerSelect).toBe('function');
    expect(typeof value.handleSubTabChange).toBe('function');
    expect(typeof value.handlePageSizeChange).toBe('function');
    expect(typeof value.handleTestSuitesPageChange).toBe('function');
    expect(typeof value.isTestCaseSummaryLoading).toBe('boolean');
    expect(typeof value.testCaseSummary).toBe('object');
    // No `pagingData` object is returned; paging is exposed as discrete keys.
    expect(value.paging).toEqual({});
    expect(value.currentPage).toBe(1);
    expect(value.pageSize).toBe(10);
    expect(value.showPagination).toBe(false);
    // tab/subTab default from useParams (mocked to {}) to the enum defaults;
    // params reflects the (empty) parsed query string.
    expect(value.tab).toBe(DataQualityPageTabs.TEST_CASES);
    expect(value.subTab).toBe(DataQualitySubTabs.TABLE_SUITES);
    expect(value.params).toEqual({});
  });

  it('should mark the name column as sortable in the column list', async () => {
    const { result } = renderHook(() => useTestSuitesListPage());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const nameColumn = result.current.columnList.find(
      (column) => column.id === 'name'
    );

    expect(nameColumn?.allowsSorting).toBe(true);
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

  it('should fetch table suites with the default basic-suite params on load', async () => {
    renderHook(() => useTestSuitesListPage());

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    expect(mockGetListTestSuitesBySearch).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        offset: 0,
        fields: ['owners', 'summary'],
        includeEmptyTestSuites: false,
        testSuiteType: 'basic',
        sortField: 'lastResultTimestamp',
        sortType: 'desc',
      })
    );
  });

  it('should not fetch and should stop loading when view permission is absent', async () => {
    (getPrioritizedViewPermission as jest.Mock).mockReturnValue(false);

    const { result } = renderHook(() => useTestSuitesListPage());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetListTestSuitesBySearch).not.toHaveBeenCalled();
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

  it('should return the fetched rows unchanged when no sortDescriptor is set', async () => {
    mockGetListTestSuitesBySearch.mockResolvedValue({
      data: [suite('b'), suite('a'), suite('c')],
      paging: {},
    } as SuitesResponse);

    const { result } = renderHook(() => useTestSuitesListPage());

    await waitFor(() => expect(result.current.testSuites).toHaveLength(3));

    expect(
      result.current.sortedData.map((item) => item.fullyQualifiedName)
    ).toEqual(['b', 'a', 'c']);
  });

  it('should client-side sort already-fetched rows by name via the sortDescriptor', async () => {
    mockGetListTestSuitesBySearch.mockResolvedValue({
      data: [suite('b'), suite('a'), suite('c')],
      paging: {},
    } as SuitesResponse);

    const { result } = renderHook(() => useTestSuitesListPage());

    await waitFor(() => expect(result.current.testSuites).toHaveLength(3));

    act(() => {
      result.current.setSortDescriptor({
        column: 'name',
        direction: 'ascending',
      });
    });

    expect(
      result.current.sortedData.map((item) => item.fullyQualifiedName)
    ).toEqual(['a', 'b', 'c']);

    act(() => {
      result.current.setSortDescriptor({
        column: 'name',
        direction: 'descending',
      });
    });

    expect(
      result.current.sortedData.map((item) => item.fullyQualifiedName)
    ).toEqual(['c', 'b', 'a']);
  });

  it('should format the search query as a wildcard and expose searchValue from the URL', async () => {
    mockLocation.search = QueryString.stringify({ searchValue: 'abc' });

    const { result } = renderHook(() => useTestSuitesListPage());

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    expect(result.current.searchValue).toBe('abc');
    expect(mockGetListTestSuitesBySearch).toHaveBeenCalledWith(
      expect.objectContaining({ q: '*abc*' })
    );
  });

  it('should write the owner to the URL when handleOwnerSelect is called with an owner', () => {
    const { result } = renderHook(() => useTestSuitesListPage());

    act(() => {
      result.current.handleOwnerSelect([
        { id: 'user-1', type: 'user', name: 'user1' } as EntityReference,
      ]);
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('owner='),
      })
    );
  });

  it('should clear the owner from the URL when handleOwnerSelect is called empty', () => {
    mockLocation.search = QueryString.stringify({ owner: 'stale' });

    const { result } = renderHook(() => useTestSuitesListPage());

    act(() => {
      result.current.handleOwnerSelect([]);
    });

    expect(mockNavigate).toHaveBeenCalled();

    const [firstCallArg] = mockNavigate.mock.calls[0];

    expect(firstCallArg.search).not.toContain('owner=stale');
  });

  it('should derive the owner filter from the URL and refetch with the owner key', async () => {
    mockLocation.search = QueryString.stringify({
      owner: JSON.stringify({ name: 'u1', fullyQualifiedName: 'u1' }),
    });

    const { result } = renderHook(() => useTestSuitesListPage());

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    expect(result.current.selectedOwner).toEqual({
      name: 'u1',
      fullyQualifiedName: 'u1',
    });
    expect(result.current.ownerFilterValue).toEqual({
      key: 'u1',
      label: 'Owner',
    });
    expect(mockGetListTestSuitesBySearch).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'u1' })
    );
  });

  it('should keep selectedOwner undefined when the owner URL param is malformed', () => {
    mockLocation.search = QueryString.stringify({ owner: 'not-json' });

    const { result } = renderHook(() => useTestSuitesListPage());

    expect(result.current.selectedOwner).toBeUndefined();
    expect(result.current.ownerFilterValue).toBeUndefined();
  });

  it('should navigate to the resolved sub-tab path when handleSubTabChange is called', () => {
    (
      observabilityRouterClassBase.getDataQualityPagePath as jest.Mock
    ).mockReturnValue('/data-quality/test-cases/bundle-suites');

    const { result } = renderHook(() => useTestSuitesListPage());

    act(() => {
      result.current.handleSubTabChange(new Set(['bundle-suites']));
    });

    expect(
      observabilityRouterClassBase.getDataQualityPagePath
    ).toHaveBeenCalledWith('test-cases', 'bundle-suites');
    expect(mockNavigate).toHaveBeenCalledWith(
      '/data-quality/test-cases/bundle-suites'
    );
  });

  it('should not navigate when handleSubTabChange is called with an empty selection', () => {
    const { result } = renderHook(() => useTestSuitesListPage());

    act(() => {
      result.current.handleSubTabChange(new Set());
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should navigate with the stringified search when handleSearchParam is called', () => {
    const { result } = renderHook(() => useTestSuitesListPage());

    act(() => {
      result.current.handleSearchParam('hello', 'searchValue');
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('searchValue=hello'),
      })
    );
  });

  it('should pass through testCaseSummary and its loading flag from the DQ provider', () => {
    const summary = { healthy: 5 } as unknown as ReturnType<
      typeof useDataQualityProvider
    >['testCaseSummary'];
    (useDataQualityProvider as jest.Mock).mockReturnValue({
      isTestCaseSummaryLoading: true,
      testCaseSummary: summary,
    });

    const { result } = renderHook(() => useTestSuitesListPage());

    expect(result.current.isTestCaseSummaryLoading).toBe(true);
    expect(result.current.testCaseSummary).toBe(summary);
  });

  it('should refetch with the paged offset when the current page changes', async () => {
    const { rerender } = renderHook(() => useTestSuitesListPage());

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    // Page 1 => offset 0.
    expect(mockGetListTestSuitesBySearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 10, offset: 0 })
    );

    mockGetListTestSuitesBySearch.mockClear();
    mockUsePaging.currentPage = 2;
    rerender();

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    // Page 2 => offset (2 - 1) * pageSize = 10.
    expect(mockGetListTestSuitesBySearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 10, offset: 10 })
    );
  });

  it('should delegate handleTestSuitesPageChange to handlePageChange without fetching itself', async () => {
    const { result } = renderHook(() => useTestSuitesListPage());

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    mockGetListTestSuitesBySearch.mockClear();

    act(() => {
      result.current.handleTestSuitesPageChange({
        currentPage: 3,
      } as Parameters<typeof result.current.handleTestSuitesPageChange>[0]);
    });

    expect(mockUsePaging.handlePageChange).toHaveBeenCalledWith(3);
    // The handler only moves the page; the fetch is driven by the currentPage
    // effect dependency, so no direct fetch happens here.
    expect(mockGetListTestSuitesBySearch).not.toHaveBeenCalled();
  });

  it('should expose the usePaging handlePageSizeChange handler unchanged', async () => {
    const { result } = renderHook(() => useTestSuitesListPage());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.handlePageSizeChange).toBe(
      mockUsePaging.handlePageSizeChange
    );

    act(() => {
      result.current.handlePageSizeChange(25);
    });

    expect(mockUsePaging.handlePageSizeChange).toHaveBeenCalledWith(25);
  });

  it('should refetch with the new limit when the page size changes', async () => {
    const { rerender } = renderHook(() => useTestSuitesListPage());

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    expect(mockGetListTestSuitesBySearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 10, offset: 0 })
    );

    mockGetListTestSuitesBySearch.mockClear();
    mockUsePaging.pageSize = 25;
    rerender();

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    expect(mockGetListTestSuitesBySearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 25, offset: 0 })
    );
  });

  it('should fetch logical suites when the sub-tab is the bundle-suites value', async () => {
    (useParams as jest.Mock).mockReturnValue({
      tab: DataQualityPageTabs.TEST_CASES,
      subTab: DataQualitySubTabs.BUNDLE_SUITES,
    });

    const { result } = renderHook(() => useTestSuitesListPage());

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    expect(result.current.subTab).toBe(DataQualitySubTabs.BUNDLE_SUITES);
    expect(mockGetListTestSuitesBySearch).toHaveBeenCalledWith(
      expect.objectContaining({
        includeEmptyTestSuites: true,
        testSuiteType: 'logical',
      })
    );
  });

  it('should refetch with logical params when the sub-tab changes to bundle-suites', async () => {
    const { rerender } = renderHook(() => useTestSuitesListPage());

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    // Default (table-suites) => basic, no empty suites.
    expect(mockGetListTestSuitesBySearch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        includeEmptyTestSuites: false,
        testSuiteType: 'basic',
      })
    );

    mockGetListTestSuitesBySearch.mockClear();
    (useParams as jest.Mock).mockReturnValue({
      tab: DataQualityPageTabs.TEST_CASES,
      subTab: DataQualitySubTabs.BUNDLE_SUITES,
    });
    rerender();

    await waitFor(() =>
      expect(mockGetListTestSuitesBySearch).toHaveBeenCalled()
    );

    expect(mockGetListTestSuitesBySearch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        includeEmptyTestSuites: true,
        testSuiteType: 'logical',
      })
    );
  });

  it('should navigate to the bundle-suites path when handleSubTabChange selects it', () => {
    (
      observabilityRouterClassBase.getDataQualityPagePath as jest.Mock
    ).mockReturnValue('/data-quality/test-cases/bundle-suites');

    const { result } = renderHook(() => useTestSuitesListPage());

    act(() => {
      result.current.handleSubTabChange(
        new Set([DataQualitySubTabs.BUNDLE_SUITES])
      );
    });

    expect(
      observabilityRouterClassBase.getDataQualityPagePath
    ).toHaveBeenCalledWith(
      DataQualityPageTabs.TEST_CASES,
      DataQualitySubTabs.BUNDLE_SUITES
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      '/data-quality/test-cases/bundle-suites'
    );
    // characterization gap: the resulting `subTab` param change is owned by the
    // router (useParams is mocked to {}), so the URL->param binding is not
    // exercised here. The refetch-on-subTab-change behavior is covered by the
    // 'should refetch with logical params...' test above, which drives useParams
    // directly to stand in for that navigation.
  });

  it('should sort a basic suite by its basicEntityReference fqn, not its top-level fqn', async () => {
    mockGetListTestSuitesBySearch.mockResolvedValue({
      // basicEntityReference fqn 'a' sorts before the non-basic 'm'; the basic
      // row's top-level fqn is 'top-a', which would sort AFTER 'm' if the code
      // wrongly used fullyQualifiedName for basic rows.
      data: [suite('m'), basicSuite('basic-row', 'a')],
      paging: {},
    } as SuitesResponse);

    const { result } = renderHook(() => useTestSuitesListPage());

    await waitFor(() => expect(result.current.testSuites).toHaveLength(2));

    act(() => {
      result.current.setSortDescriptor({
        column: 'name',
        direction: 'ascending',
      });
    });

    expect(result.current.sortedData.map((item) => item.id)).toEqual([
      'basic-row',
      'm',
    ]);

    act(() => {
      result.current.setSortDescriptor({
        column: 'name',
        direction: 'descending',
      });
    });

    expect(result.current.sortedData.map((item) => item.id)).toEqual([
      'm',
      'basic-row',
    ]);
  });

  it('should show an error toast and stop loading when the fetch rejects', async () => {
    const error = new Error('boom');
    mockGetListTestSuitesBySearch.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useTestSuitesListPage());

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));

    // The requestId-guarded finally block still runs setIsLoading(false).
    expect(result.current.isLoading).toBe(false);
  });

  it('should not toast for a stale rejection once a newer request has settled', async () => {
    let rejectFirst!: (reason: unknown) => void;
    const firstPromise = new Promise<SuitesResponse>((_, reject) => {
      rejectFirst = reject;
    });
    const second = createDeferred();
    mockGetListTestSuitesBySearch
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(() => useTestSuitesListPage());

    // Start a newer (second) request while the first is still in flight.
    mockLocation.search = QueryString.stringify({ searchValue: 'abc' });
    rerender();

    // The latest request settles first, then the stale first request rejects.
    await act(async () => {
      second.resolve({ data: [suite('latest')], paging: {} } as SuitesResponse);
    });
    await act(async () => {
      rejectFirst(new Error('stale-failure'));
      await Promise.resolve();
    });

    // The stale (first) rejection is dropped by the requestId guard.
    expect(showErrorToast).not.toHaveBeenCalled();
    expect(result.current.testSuites).toEqual([suite('latest')]);
  });
});
