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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Include } from '../../../generated/type/include';
import { MOCK_PERMISSIONS } from '../../../mocks/Glossary.mock';
import { MOCK_TEST_CASE_DATA } from '../../../mocks/TestCase.mock';
import {
  getTestCaseByFqn,
  getTestCaseVersionDetails,
  getTestCaseVersionList,
  restoreTestCase,
  updateTestCaseById,
} from '../../../rest/testAPI';
import {
  fetchEntityTaskCountsInto,
  getFeedCounts,
} from '../../../utils/FeedUtilsPure';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { TestCasePageTabs } from '../IncidentManager.interface';
import { UseTestCaseStoreInterface } from './useTestCase.store';
import { useTestCaseDetailPage } from './useTestCaseDetailPage';

const mockTestCaseFqn =
  'sample_data.ecommerce_db.shopify.dim_address.table_column_count_equals';

const mockUseTestCase: UseTestCaseStoreInterface = {
  testCase: MOCK_TEST_CASE_DATA,
  setTestCase: jest.fn(),
  isLoading: false,
  setIsLoading: jest.fn(),
  reset: jest.fn(),
  showAILearningBanner: false,
  setShowAILearningBanner: jest.fn(),
  dqLineageData: undefined,
  setDqLineageData: jest.fn(),
  isPermissionLoading: false,
  testCasePermission: MOCK_PERMISSIONS,
  setTestCasePermission: jest.fn(),
  setIsPermissionLoading: jest.fn(),
  isTabExpanded: false,
  setIsTabExpanded: jest.fn(),
};

jest.mock('./useTestCase.store', () => ({
  useTestCaseStore: jest.fn().mockImplementation(() => mockUseTestCase),
}));

// Permissions now come from useEntityPermissions (Task 8 Batch 9) rather than an
// imperative usePermissionProvider().getEntityPermissionByFqn call — mock the hook
// directly, mirroring MetricDetailsPage.test.tsx's approach: deriving flags isn't this
// hook's own concern to re-verify, only that it wires the right (resource, fqn) pair
// and threads the named flags through.
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

jest.mock('../../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
}));

jest.mock('../../../rest/testAPI', () => ({
  getTestCaseByFqn: jest.fn().mockImplementation(() =>
    Promise.resolve({
      ...jest.requireActual('../../../mocks/TestCase.mock').MOCK_TEST_CASE_DATA,
    })
  ),
  updateTestCaseById: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        jest.requireActual('../../../mocks/TestCase.mock').MOCK_TEST_CASE_DATA
      )
    ),
  getTestCaseVersionList: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ entityType: 'testCase', versions: [] })
    ),
  getTestCaseVersionDetails: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        jest.requireActual('../../../mocks/TestCase.mock').MOCK_TEST_CASE_DATA
      )
    ),
  restoreTestCase: jest.fn().mockImplementation(() =>
    Promise.resolve({
      ...jest.requireActual('../../../mocks/TestCase.mock').MOCK_TEST_CASE_DATA,
      deleted: false,
    })
  ),
}));

const mockNavigate = jest.fn();
const mockNavigationState = {
  breadcrumbData: [
    {
      name: 'Data Quality',
      url: '/data-quality/test-cases',
    },
  ],
};
jest.mock('../../../utils/FeedUtilsPure', () => ({
  fetchEntityTaskCountsInto: jest.fn(),
  getFeedCounts: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () =>
  jest.fn().mockImplementation(() => ({ state: mockNavigationState }))
);

let mockParams: Record<string, string | undefined> = {
  fqn: mockTestCaseFqn,
  tab: TestCasePageTabs.TEST_CASE_RESULTS,
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => mockParams,
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
};

const renderDetailPageHook = (isVersionPage = false) =>
  renderHook(() => useTestCaseDetailPage({ isVersionPage }), {
    wrapper: Wrapper,
  });

describe('useTestCaseDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {
      fqn: mockTestCaseFqn,
      tab: TestCasePageTabs.TEST_CASE_RESULTS,
    };
    mockUseTestCase.testCase = MOCK_TEST_CASE_DATA;
    setMockPermissions(MOCK_PERMISSIONS);
  });

  it('should return test case data with derived permissions', async () => {
    const { result } = renderDetailPageHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.testCase).toEqual(MOCK_TEST_CASE_DATA);
    expect(result.current.testCaseFQN).toBe(mockTestCaseFqn);
    expect(result.current.hasViewPermission).toBe(true);
    expect(result.current.hasEditPermission).toBe(true);
    expect(result.current.hasDeletePermission).toBe(true);
    expect(result.current.editDisplayNamePermission).toBe(true);
    expect(result.current.canRestorePermission).toBe(true);
  });

  it('should request active and deleted test cases for direct detail links', async () => {
    renderDetailPageHook();

    await waitFor(() => expect(getTestCaseByFqn).toHaveBeenCalled());

    expect(getTestCaseByFqn).toHaveBeenCalledWith(
      mockTestCaseFqn,
      expect.objectContaining({ include: Include.All })
    );
  });

  it('should make a deleted test case read-only while retaining restore permission', async () => {
    mockUseTestCase.testCase = { ...MOCK_TEST_CASE_DATA, deleted: true };

    const { result } = renderDetailPageHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasEditPermission).toBe(false);
    expect(result.current.hasDeletePermission).toBe(false);
    expect(result.current.editDisplayNamePermission).toBe(false);
    expect(result.current.canRestorePermission).toBe(true);
    expect(result.current.extraDropdownContent).toEqual([]);
  });

  it('should call useEntityPermissions with the TEST_CASE resource and fetch task counts on mount', async () => {
    renderDetailPageHook();

    await waitFor(() =>
      expect(mockUseEntityPermissions).toHaveBeenCalledWith(
        ResourceEntity.TEST_CASE,
        mockTestCaseFqn,
        expect.objectContaining({ enabled: true })
      )
    );

    expect(fetchEntityTaskCountsInto).toHaveBeenCalledWith(
      mockTestCaseFqn,
      expect.any(Function)
    );
  });

  it('should derive no view permission when the hook reports no view access', async () => {
    setMockPermissions({});

    const { result } = renderDetailPageHook();

    await waitFor(() => expect(result.current.hasViewPermission).toBeFalsy());
  });

  it('should map each named flag to its own distinct field (not collapse onto EditAll)', async () => {
    // EditAll true but EditDisplayName explicitly false, Delete false — distinguishes
    // hasEditPermission/editDisplayNamePermission/hasDeletePermission from each other so a
    // mis-mapping (e.g. aliasing editDisplayNamePermission to canEditAll instead of
    // canEditDisplayName) would fail this test even though it passes MOCK_PERMISSIONS
    // (all-true) fixtures elsewhere in this suite.
    setMockPermissions({
      ViewBasic: true,
      EditAll: true,
      EditDisplayName: false,
      Delete: false,
    });

    const { result } = renderDetailPageHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasViewPermission).toBe(true);
    expect(result.current.hasEditPermission).toBe(true);
    expect(result.current.editDisplayNamePermission).toBe(false);
    expect(result.current.hasDeletePermission).toBe(false);
  });

  it('should build tabs from testCaseClassBase', async () => {
    const { result } = renderDetailPageHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const tabKeys = result.current.tabs.map((tab) => tab.key);

    expect(tabKeys).toContain(TestCasePageTabs.TEST_CASE_RESULTS);
    expect(tabKeys).toContain(TestCasePageTabs.ISSUES);
    expect(result.current.activeTab).toBe(TestCasePageTabs.TEST_CASE_RESULTS);
  });

  it('should not include the incident tab on version pages', async () => {
    const { result } = renderDetailPageHook(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const tabKeys = result.current.tabs.map((tab) => tab.key);

    expect(tabKeys).not.toContain(TestCasePageTabs.ISSUES);
  });

  it('handleTabChange should not navigate for the active tab', async () => {
    const { result } = renderDetailPageHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleTabChange(TestCasePageTabs.TEST_CASE_RESULTS);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('handleTabChange should navigate for a different tab', async () => {
    const { result } = renderDetailPageHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleTabChange(TestCasePageTabs.ISSUES);
    });

    expect(mockNavigate).toHaveBeenCalledWith(expect.any(String), {
      state: mockNavigationState,
    });
  });

  it('handleOwnerChange should patch the test case owners', async () => {
    const { result } = renderDetailPageHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleOwnerChange([
        { id: 'owner-id', type: 'user' },
      ]);
    });

    expect(updateTestCaseById).toHaveBeenCalledWith(
      MOCK_TEST_CASE_DATA.id,
      expect.arrayContaining([expect.objectContaining({ path: '/owners' })])
    );
  });

  it('handleDisplayNameChange should patch the test case', async () => {
    const { result } = renderDetailPageHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleDisplayNameChange({
        name: MOCK_TEST_CASE_DATA.name,
        displayName: 'Updated Display Name',
      });
    });

    expect(updateTestCaseById).toHaveBeenCalledWith(
      MOCK_TEST_CASE_DATA.id,
      expect.arrayContaining([
        expect.objectContaining({ path: '/displayName' }),
      ])
    );
  });

  it('onVersionClick should navigate to the version page from details', async () => {
    const { result } = renderDetailPageHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onVersionClick();
    });

    expect(mockNavigate).toHaveBeenCalledWith(expect.any(String), {
      state: mockNavigationState,
    });
  });

  it('should fetch the version list and version details on version pages', async () => {
    mockParams = {
      fqn: mockTestCaseFqn,
      tab: TestCasePageTabs.TEST_CASE_RESULTS,
      version: '0.2',
    };

    const { result } = renderDetailPageHook(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await waitFor(() =>
      expect(getTestCaseVersionList).toHaveBeenCalledWith(
        MOCK_TEST_CASE_DATA.id
      )
    );
    await waitFor(() =>
      expect(getTestCaseVersionDetails).toHaveBeenCalledWith(
        MOCK_TEST_CASE_DATA.id,
        '0.2'
      )
    );

    expect(result.current.version).toBe('0.2');
  });

  it('should expose dimension state from the route params', async () => {
    mockParams = {
      fqn: mockTestCaseFqn,
      tab: TestCasePageTabs.TEST_CASE_RESULTS,
      dimensionKey: 'completeness',
    };

    const { result } = renderDetailPageHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isDimensionPage).toBe(true);
    expect(result.current.dimensionKey).toBe('completeness');
  });

  it('should toggle dimension edit state', async () => {
    const { result } = renderDetailPageHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isDimensionEdit).toBe(false);

    act(() => {
      result.current.setIsDimensionEdit(true);
    });

    expect(result.current.isDimensionEdit).toBe(true);

    act(() => {
      result.current.handleCancelDimension();
    });

    expect(result.current.isDimensionEdit).toBe(false);
  });

  it('extraDropdownContent should be empty for table-level test cases', async () => {
    mockUseTestCase.testCase = {
      ...MOCK_TEST_CASE_DATA,
      entityLink: '<#E::table::sample_data.ecommerce_db.shopify.dim_address>',
    };

    const { result } = renderDetailPageHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.extraDropdownContent).toEqual([]);
  });

  it('extraDropdownContent should expose the dimension action for column-level test cases', async () => {
    const { result } = renderDetailPageHook();

    await waitFor(() =>
      expect(result.current.extraDropdownContent).toHaveLength(1)
    );

    expect(result.current.extraDropdownContent[0].key).toBe('edit-dimensions');
  });

  it('should restore the test case and update the detail query', async () => {
    mockUseTestCase.testCase = { ...MOCK_TEST_CASE_DATA, deleted: true };
    const { result } = renderDetailPageHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleRestore();
    });

    expect(restoreTestCase).toHaveBeenCalledWith(MOCK_TEST_CASE_DATA.id);
    expect(showSuccessToast).toHaveBeenCalled();
  });

  it('should report restore failures without showing a success toast', async () => {
    const error = new Error('Restore failed');
    (restoreTestCase as jest.Mock).mockRejectedValueOnce(error);
    mockUseTestCase.testCase = { ...MOCK_TEST_CASE_DATA, deleted: true };
    const { result } = renderDetailPageHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let isRestored: boolean | undefined;
    await act(async () => {
      isRestored = await result.current.handleRestore();
    });

    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(showSuccessToast).not.toHaveBeenCalled();
    expect(isRestored).toBe(false);
  });

  it('getEntityFeedCount should fetch feed counts', async () => {
    const { result } = renderDetailPageHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.getEntityFeedCount();
    });

    expect(getFeedCounts).toHaveBeenCalledWith(
      'testCase',
      mockTestCaseFqn,
      expect.any(Function)
    );
  });
});
