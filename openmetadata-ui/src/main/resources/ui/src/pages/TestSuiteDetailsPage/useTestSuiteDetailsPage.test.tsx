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
import { EntityTabs } from '../../enums/entity.enum';
import { getIngestionPipelines } from '../../rest/ingestionPipelineAPI';
import {
  addTestCasesToLogicalTestSuiteBulk,
  getListTestCaseBySearch,
  getTestSuiteByName,
  updateTestSuiteById,
} from '../../rest/testAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { useTestSuiteDetailsPage } from './useTestSuiteDetailsPage';

const mockTestSuite = {
  id: 'suite-id',
  name: 'bundle_suite',
  displayName: 'Bundle Suite',
  fullyQualifiedName: 'bundle_suite_fqn',
  description: 'suite description',
  owners: [{ id: 'owner-1', type: 'user' }],
  domains: [{ id: 'domain-1', type: 'domain' }],
  tests: [],
  deleted: false,
};

const mockPermissions = {
  ViewAll: true,
  ViewBasic: true,
  EditAll: true,
  EditOwners: true,
  EditDescription: true,
  EditDisplayName: true,
  EditTests: true,
  Delete: true,
};

const mockGetEntityPermissionByFqn = jest
  .fn()
  .mockImplementation(() => Promise.resolve(mockPermissions));
let mockTestSuiteFQN = 'bundle_suite_fqn';

const runTimeoutsImmediately = () => {
  const originalSetTimeout = window.setTimeout;

  return jest
    .spyOn(window, 'setTimeout')
    .mockImplementation((callback, delay, ...args) => {
      if (delay === 500 && typeof callback === 'function') {
        callback();

        return 0;
      }

      return originalSetTimeout(callback, delay, ...args);
    });
};

jest.mock('../../rest/testAPI');
jest.mock('../../rest/ingestionPipelineAPI');

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
    permissions: {},
  }),
}));

jest.mock('../../hooks/useChangeSummary', () => ({
  useChangeSummary: () => ({
    changeSummary: {},
    refetch: jest.fn(),
  }),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: mockTestSuiteFQN }),
}));

jest.mock('../../hooks/useEntityRules', () => ({
  useEntityRules: () => ({
    entityRules: {
      canAddMultipleDomains: true,
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: false,
    },
  }),
}));

jest.mock(
  '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: () => ({ showModal: jest.fn() }),
  })
);

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: () => ({ pathname: '/test-suites/bundle_suite_fqn', search: '' }),
}));

jest.mock('../../utils/TestCaseUtils', () => ({
  ExtraTestCaseDropdownOptions: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('useTestSuiteDetailsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTestSuiteFQN = 'bundle_suite_fqn';
    (getTestSuiteByName as jest.Mock).mockResolvedValue(mockTestSuite);
    (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
      data: [{ id: 'tc-1', name: 'tc_1' }],
      paging: { total: 1 },
    });
    (getIngestionPipelines as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 2 },
    });
    (updateTestSuiteById as jest.Mock).mockResolvedValue(mockTestSuite);
    (addTestCasesToLogicalTestSuiteBulk as jest.Mock).mockResolvedValue({});
  });

  it('should fetch permissions, the suite and its test cases on mount', async () => {
    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.testSuite).toEqual(mockTestSuite);
    });

    expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
      'testSuite',
      'bundle_suite_fqn'
    );
    expect(getTestSuiteByName).toHaveBeenCalledWith(
      'bundle_suite_fqn',
      expect.objectContaining({ include: 'all' })
    );

    await waitFor(() => {
      expect(result.current.testCaseResult).toHaveLength(1);
    });

    expect(result.current.ingestionPipelineCount).toBe(2);
  });

  it('should search the current suite from the first page', async () => {
    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.testSuite).toEqual(mockTestSuite);
    });

    (getListTestCaseBySearch as jest.Mock).mockClear();
    (getIngestionPipelines as jest.Mock).mockClear();

    await act(async () => {
      await result.current.handleTestCaseSearch('tc_9');
    });

    expect(result.current.testCaseSearchQuery).toBe('tc_9');
    expect(result.current.pagingData.currentPage).toBe(1);
    expect(getListTestCaseBySearch).toHaveBeenCalledWith(
      expect.objectContaining({
        offset: 0,
        q: 'tc_9',
        testSuiteId: 'suite-id',
      })
    );
    expect(getIngestionPipelines).not.toHaveBeenCalled();
  });

  it('should preserve the search query when changing pages', async () => {
    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.testSuite).toEqual(mockTestSuite);
    });

    await act(async () => {
      await result.current.handleTestCaseSearch('tc_9');
    });
    (getListTestCaseBySearch as jest.Mock).mockClear();

    act(() => {
      result.current.pagingData.pagingHandler({ currentPage: 2 });
    });

    await waitFor(() => {
      expect(getListTestCaseBySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          offset: result.current.pagingData.pageSize,
          q: 'tc_9',
        })
      );
    });
  });

  it('should preserve the search query when sorting', async () => {
    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.testSuite).toEqual(mockTestSuite);
    });

    await act(async () => {
      await result.current.handleTestCaseSearch('tc_9');
    });
    (getListTestCaseBySearch as jest.Mock).mockClear();

    await act(async () => {
      await result.current.handleSortTestCase();
    });

    expect(getListTestCaseBySearch).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'tc_9' })
    );
  });

  it('should clear the search and reload the first page', async () => {
    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.testSuite).toEqual(mockTestSuite);
    });

    await act(async () => {
      await result.current.handleTestCaseSearch('tc_9');
    });
    (getListTestCaseBySearch as jest.Mock).mockClear();

    await act(async () => {
      await result.current.handleTestCaseSearch('');
    });

    expect(result.current.testCaseSearchQuery).toBe('');
    expect(result.current.pagingData.currentPage).toBe(1);
    expect(getListTestCaseBySearch).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 0, q: undefined })
    );
  });

  it('should clear the search when navigating to another suite', async () => {
    const { result, rerender } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.testSuite).toEqual(mockTestSuite);
    });

    await act(async () => {
      await result.current.handleTestCaseSearch('tc_9');
    });

    mockTestSuiteFQN = 'another_suite_fqn';
    rerender();

    expect(result.current.testCaseSearchQuery).toBe('');
  });

  it('should default to the test cases tab and switch tabs', async () => {
    const { result } = renderHook(() => useTestSuiteDetailsPage());

    expect(result.current.activeTab).toBe(EntityTabs.TEST_CASES);

    act(() => {
      result.current.setActiveTab(EntityTabs.PIPELINE);
    });

    expect(result.current.activeTab).toBe(EntityTabs.PIPELINE);
  });

  it('should derive permission flags from the entity permissions', async () => {
    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.permissions.hasViewPermission).toBe(true);
    });

    expect(result.current.permissions.hasEditOwnerPermission).toBe(true);
    expect(result.current.permissions.hasDeletePermission).toBe(true);
    expect(result.current.canAddMultipleDomains).toBe(true);
    expect(result.current.canAddMultipleTeamOwner).toBe(false);
  });

  it('should not fetch the suite without view permission', async () => {
    mockGetEntityPermissionByFqn.mockResolvedValueOnce({
      ViewAll: false,
      ViewBasic: false,
    });

    renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(mockGetEntityPermissionByFqn).toHaveBeenCalled();
    });

    expect(getTestSuiteByName).not.toHaveBeenCalled();
  });

  it('should patch the suite on owner update', async () => {
    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.testSuite).toEqual(mockTestSuite);
    });

    await act(async () => {
      await result.current.onUpdateOwner([{ id: 'owner-2', type: 'user' }]);
    });

    expect(updateTestSuiteById).toHaveBeenCalledWith(
      'suite-id',
      expect.arrayContaining([
        expect.objectContaining({ path: expect.stringContaining('/owners') }),
      ])
    );
  });

  it('should normalize single domain updates into an array patch', async () => {
    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.testSuite).toEqual(mockTestSuite);
    });

    await act(async () => {
      await result.current.handleDomainUpdate({
        id: 'domain-2',
        type: 'domain',
      });
    });

    expect(updateTestSuiteById).toHaveBeenCalledWith(
      'suite-id',
      expect.arrayContaining([
        expect.objectContaining({ path: expect.stringContaining('/domains') }),
      ])
    );
  });

  it('should skip description update when unchanged', async () => {
    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.testSuite).toEqual(mockTestSuite);
    });

    await act(async () => {
      await result.current.onDescriptionUpdate('suite description');
    });

    expect(updateTestSuiteById).not.toHaveBeenCalled();
  });

  it('should retry stale rows until the authoritative count is indexed', async () => {
    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.testSuite).toEqual(mockTestSuite);
      expect(result.current.testCaseResult).toHaveLength(1);
    });

    (getTestSuiteByName as jest.Mock).mockResolvedValue({
      ...mockTestSuite,
      tests: [
        { id: 'tc-1', type: 'testCase' },
        { id: 'tc-9', type: 'testCase' },
      ],
    });

    let resolveIndexedSearch!: (value: {
      data: Array<{ id: string; name: string }>;
      paging: { total: number };
    }) => void;
    const indexedSearch = new Promise<{
      data: Array<{ id: string; name: string }>;
      paging: { total: number };
    }>((resolve) => {
      resolveIndexedSearch = resolve;
    });
    let resolveSecondFetchStarted!: () => void;
    const secondFetchStarted = new Promise<void>((resolve) => {
      resolveSecondFetchStarted = resolve;
    });

    (getListTestCaseBySearch as jest.Mock).mockClear();
    (getListTestCaseBySearch as jest.Mock)
      .mockResolvedValueOnce({
        data: [{ id: 'tc-1', name: 'tc_1' }],
        paging: { total: 1 },
      })
      .mockImplementationOnce(() => {
        resolveSecondFetchStarted();

        return indexedSearch;
      })
      .mockResolvedValueOnce({
        data: [
          { id: 'tc-1', name: 'tc_1' },
          { id: 'tc-9', name: 'tc_9' },
        ],
        paging: { total: 2 },
      });

    const setTimeoutSpy = runTimeoutsImmediately();
    let addRequest!: Promise<void>;

    try {
      act(() => {
        addRequest = result.current.handleAddTestCaseSubmit({
          selectAll: false,
          includeIds: ['tc-9'],
          excludeIds: [],
        });
      });

      await act(async () => {
        await Promise.race([secondFetchStarted, addRequest]);
      });

      expect(getListTestCaseBySearch).toHaveBeenCalledTimes(2);
      expect(result.current.isTestCaseLoading).toBe(true);

      await act(async () => {
        resolveIndexedSearch({
          data: [
            { id: 'tc-1', name: 'tc_1' },
            { id: 'tc-9', name: 'tc_9' },
          ],
          paging: { total: 2 },
        });
        await addRequest;
      });

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 500);
    } finally {
      setTimeoutSpy.mockRestore();
      (getListTestCaseBySearch as jest.Mock).mockReset();
    }

    expect(result.current.testCaseResult).toEqual([
      expect.objectContaining({ id: 'tc-1' }),
      expect.objectContaining({ id: 'tc-9' }),
    ]);
    expect(result.current.pagingData.paging.total).toBe(2);
    expect(result.current.isTestCaseLoading).toBe(false);
  });

  it('should stop retrying stale rows after five attempts', async () => {
    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.testSuite).toEqual(mockTestSuite);
      expect(result.current.testCaseResult).toHaveLength(1);
    });

    (getTestSuiteByName as jest.Mock).mockResolvedValue({
      ...mockTestSuite,
      tests: [
        { id: 'tc-1', type: 'testCase' },
        { id: 'tc-9', type: 'testCase' },
      ],
    });
    (getListTestCaseBySearch as jest.Mock).mockClear();
    (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
      data: [{ id: 'tc-1', name: 'tc_1' }],
      paging: { total: 1 },
    });

    const setTimeoutSpy = runTimeoutsImmediately();

    try {
      await act(async () => {
        await result.current.handleAddTestCaseSubmit({
          selectAll: false,
          includeIds: ['tc-9'],
          excludeIds: [],
        });
      });

      expect(setTimeoutSpy).toHaveBeenCalledTimes(4);
    } finally {
      setTimeoutSpy.mockRestore();
    }

    expect(getListTestCaseBySearch).toHaveBeenCalledTimes(6);
    expect(result.current.pagingData.paging.total).toBe(2);
    expect(result.current.isTestCaseLoading).toBe(false);
  });

  it('should use the suite relationship count when search paging is stale after bulk add', async () => {
    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.pagingData.paging.total).toBe(1);
    });

    let resolveOlderSearch!: (value: {
      data: Array<{ id: string; name: string }>;
      paging: { total: number };
    }) => void;
    const olderSearch = new Promise<{
      data: Array<{ id: string; name: string }>;
      paging: { total: number };
    }>((resolve) => {
      resolveOlderSearch = resolve;
    });
    let resolveRefreshedSearch!: (value: {
      data: Array<{ id: string; name: string }>;
      paging: { total: number };
    }) => void;
    const refreshedSearch = new Promise<{
      data: Array<{ id: string; name: string }>;
      paging: { total: number };
    }>((resolve) => {
      resolveRefreshedSearch = resolve;
    });

    (getListTestCaseBySearch as jest.Mock).mockClear();
    (getListTestCaseBySearch as jest.Mock)
      .mockImplementationOnce(() => olderSearch)
      .mockImplementationOnce(() => refreshedSearch)
      .mockResolvedValueOnce({
        data: [{ id: 'tc-9', name: 'tc_9' }],
        paging: { total: 2 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'tc-9', name: 'tc_9' }],
        paging: { total: 2 },
      });

    (getTestSuiteByName as jest.Mock).mockResolvedValue({
      ...mockTestSuite,
      tests: [
        { id: 'tc-1', type: 'testCase' },
        { id: 'tc-9', type: 'testCase' },
      ],
    });

    let olderRequest!: Promise<void>;
    await act(async () => {
      olderRequest = result.current.fetchTestCases();
      await Promise.resolve();
    });

    const setTimeoutSpy = runTimeoutsImmediately();

    try {
      let addRequest!: Promise<void>;
      act(() => {
        addRequest = result.current.handleAddTestCaseSubmit({
          selectAll: false,
          includeIds: ['tc-9'],
          excludeIds: [],
        });
      });

      await waitFor(
        () => {
          expect(getListTestCaseBySearch).toHaveBeenCalledTimes(2);
        },
        { timeout: 2000 }
      );

      expect(result.current.pagingData.paging.total).toBe(2);

      await act(async () => {
        resolveRefreshedSearch({
          data: [{ id: 'tc-9', name: 'tc_9' }],
          paging: { total: 1 },
        });
        await addRequest;
      });
    } finally {
      setTimeoutSpy.mockRestore();
    }

    expect(result.current.testCaseResult).toEqual([
      expect.objectContaining({ id: 'tc-9' }),
    ]);
    expect(result.current.pagingData.paging.total).toBe(2);

    await act(async () => {
      resolveOlderSearch({
        data: [{ id: 'tc-stale', name: 'tc_stale' }],
        paging: { total: 0 },
      });
      await olderRequest;
    });

    expect(result.current.testCaseResult).toEqual([
      expect.objectContaining({ id: 'tc-9' }),
    ]);
    expect(result.current.pagingData.paging.total).toBe(2);
  });

  it('should preserve a filtered search total after bulk add', async () => {
    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.testSuite).toEqual(mockTestSuite);
      expect(result.current.pagingData.paging.total).toBe(1);
    });

    await act(async () => {
      await result.current.handleTestCaseSearch('tc_9');
    });

    (getTestSuiteByName as jest.Mock).mockResolvedValue({
      ...mockTestSuite,
      tests: [
        { id: 'tc-1', type: 'testCase' },
        { id: 'tc-9', type: 'testCase' },
      ],
    });
    (getListTestCaseBySearch as jest.Mock).mockClear();
    (getListTestCaseBySearch as jest.Mock)
      .mockResolvedValueOnce({
        data: [
          { id: 'tc-1', name: 'tc_1' },
          { id: 'tc-9', name: 'tc_9' },
        ],
        paging: { total: 2 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'tc-9', name: 'tc_9' }],
        paging: { total: 1 },
      });

    const setTimeoutSpy = runTimeoutsImmediately();

    try {
      await act(async () => {
        await result.current.handleAddTestCaseSubmit({
          selectAll: false,
          includeIds: ['tc-9'],
          excludeIds: [],
        });
      });
    } finally {
      setTimeoutSpy.mockRestore();
    }

    expect(result.current.pagingData.paging.total).toBe(1);
    expect(result.current.testCaseResult).toEqual([
      expect.objectContaining({ id: 'tc-9' }),
    ]);
    expect(getListTestCaseBySearch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ q: 'tc_9' })
    );
  });

  it('should refresh the latest query after bulk indexing completes', async () => {
    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.testSuite).toEqual(mockTestSuite);
    });

    await act(async () => {
      await result.current.handleTestCaseSearch('old_query');
    });

    (getTestSuiteByName as jest.Mock).mockResolvedValue({
      ...mockTestSuite,
      tests: [
        { id: 'tc-1', type: 'testCase' },
        { id: 'tc-9', type: 'testCase' },
      ],
    });

    let resolveBulkRefresh!: (value: {
      data: Array<{ id: string; name: string }>;
      paging: { total: number };
    }) => void;
    const bulkRefresh = new Promise<{
      data: Array<{ id: string; name: string }>;
      paging: { total: number };
    }>((resolve) => {
      resolveBulkRefresh = resolve;
    });

    (getListTestCaseBySearch as jest.Mock).mockClear();
    (getListTestCaseBySearch as jest.Mock)
      .mockReturnValueOnce(bulkRefresh)
      .mockResolvedValueOnce({
        data: [],
        paging: { total: 0 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'tc-new', name: 'new_query' }],
        paging: { total: 1 },
      });

    let addRequest!: Promise<void>;
    act(() => {
      addRequest = result.current.handleAddTestCaseSubmit({
        selectAll: false,
        includeIds: ['tc-9'],
        excludeIds: [],
      });
    });

    await waitFor(() => {
      expect(getListTestCaseBySearch).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.handleTestCaseSearch('new_query');
    });

    expect(result.current.testCaseResult).toEqual([]);

    await act(async () => {
      resolveBulkRefresh({
        data: [
          { id: 'tc-1', name: 'tc_1' },
          { id: 'tc-9', name: 'tc_9' },
        ],
        paging: { total: 2 },
      });
      await addRequest;
    });

    expect(getListTestCaseBySearch).toHaveBeenCalledTimes(3);
    expect(result.current.testCaseSearchQuery).toBe('new_query');
    expect(result.current.testCaseResult).toEqual([
      expect.objectContaining({ id: 'tc-new' }),
    ]);
    expect(result.current.pagingData.paging.total).toBe(1);
    expect(result.current.isTestCaseLoading).toBe(false);
  });

  it('should ignore a bulk add that finishes after navigating to another suite', async () => {
    let resolveBulkAdd!: () => void;
    const bulkAdd = new Promise<void>((resolve) => {
      resolveBulkAdd = resolve;
    });
    (addTestCasesToLogicalTestSuiteBulk as jest.Mock).mockReturnValueOnce(
      bulkAdd
    );
    (getTestSuiteByName as jest.Mock).mockImplementation((fqn: string) =>
      Promise.resolve({
        ...mockTestSuite,
        id: `${fqn}-id`,
        fullyQualifiedName: fqn,
      })
    );

    const { result, rerender } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.testSuite?.fullyQualifiedName).toBe(
        'bundle_suite_fqn'
      );
    });

    let addRequest!: Promise<void>;
    act(() => {
      addRequest = result.current.handleAddTestCaseSubmit({
        selectAll: false,
        includeIds: ['tc-9'],
        excludeIds: [],
      });
    });

    mockTestSuiteFQN = 'another_suite_fqn';
    rerender();

    await waitFor(() => {
      expect(result.current.testSuite?.fullyQualifiedName).toBe(
        'another_suite_fqn'
      );
    });
    (getTestSuiteByName as jest.Mock).mockClear();
    (getListTestCaseBySearch as jest.Mock).mockClear();

    await act(async () => {
      resolveBulkAdd();
      await addRequest;
    });

    expect(getTestSuiteByName).not.toHaveBeenCalled();
    expect(getListTestCaseBySearch).not.toHaveBeenCalled();
    expect(result.current.testSuite?.fullyQualifiedName).toBe(
      'another_suite_fqn'
    );
  });

  it('should surface suite fetch errors via toast', async () => {
    (getTestSuiteByName as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalled();
    });

    expect(result.current.testSuite).toBeUndefined();
  });

  it('should update a test case in place via handleTestSuiteUpdate', async () => {
    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.testCaseResult).toHaveLength(1);
    });

    act(() => {
      result.current.handleTestSuiteUpdate({
        id: 'tc-1',
        name: 'tc_1_renamed',
      } as never);
    });

    expect(result.current.testCaseResult[0].name).toBe('tc_1_renamed');
  });
});
