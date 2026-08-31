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
import { EntityTabs } from '../../enums/entity.enum';
import { getIngestionPipelines } from '../../rest/ingestionPipelineAPI';
import {
  addTestCasesToLogicalTestSuiteBulk,
  getListTestCaseBySearch,
  getTestSuiteByName,
  updateTestSuiteById,
} from '../../rest/testAPI';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
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

// The hook now reads its own permissions via useEntityPermissions rather than the raw
// PermissionProvider context, so mocking that hook (instead of the old
// getEntityPermissionByFqn REST boundary) drives its permission-derived behavior in these
// tests — same approach as TableDetailsPageV1.test.tsx.
const mockUseEntityPermissions = jest.fn();

const setMockPermissions = (
  overrides: Partial<OperationPermission> = {},
  {
    isLoading = false,
    error = null as unknown,
  }: { isLoading?: boolean; error?: unknown } = {}
) => {
  const permissions = overrides as OperationPermission;
  mockUseEntityPermissions.mockReturnValue({
    permissions,
    isLoading,
    error,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, false),
  });
};

jest.mock('../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
}));

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
    setMockPermissions(mockPermissions);
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

    expect(mockUseEntityPermissions).toHaveBeenCalledWith(
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

  it('denies owner/description edit when explicitly false, even with EditAll true', async () => {
    // Explicit-deny-wins: an explicit `false` on the field-level permission must win over
    // a `true` EditAll, not be overridden by it (Task 6 Finding 1).
    setMockPermissions({
      ViewAll: true,
      ViewBasic: true,
      EditAll: true,
      EditOwners: false,
      EditDescription: false,
    });

    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.permissions.hasViewPermission).toBe(true);
    });

    expect(result.current.permissions.hasEditOwnerPermission).toBe(false);
    expect(result.current.permissions.hasEditDescriptionPermission).toBe(
      false
    );
    // The bare-EditAll flag is unaffected by the field-specific denies.
    expect(result.current.permissions.hasEditPermission).toBe(true);
  });

  it('should not fetch the suite without view permission', async () => {
    setMockPermissions({ ViewAll: false, ViewBasic: false });

    renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(mockUseEntityPermissions).toHaveBeenCalled();
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

    expect(getListTestCaseBySearch).toHaveBeenCalledTimes(5);
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
        data: [{ id: 'tc-9', name: 'tc_9' }],
        paging: { total: 1 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'tc-9', name: 'tc_9' }],
        paging: { total: 1 },
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

    expect(result.current.pagingData.paging.total).toBe(2);

    await act(async () => {
      await result.current.fetchTestCases({ q: 'tc_9' });
    });

    expect(result.current.pagingData.paging.total).toBe(1);

    await act(async () => {
      await result.current.fetchTestCases();
    });

    expect(result.current.pagingData.paging.total).toBe(2);
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
