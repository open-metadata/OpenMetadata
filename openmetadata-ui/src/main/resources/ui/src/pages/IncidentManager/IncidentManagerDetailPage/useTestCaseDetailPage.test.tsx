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
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { MOCK_PERMISSIONS } from '../../../mocks/Glossary.mock';
import { MOCK_TEST_CASE_DATA } from '../../../mocks/TestCase.mock';
import {
  getTestCaseVersionDetails,
  getTestCaseVersionList,
  updateTestCaseById,
} from '../../../rest/testAPI';
import {
  fetchEntityTaskCountsInto,
  getFeedCounts,
} from '../../../utils/FeedUtilsPure';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
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
}));

const mockNavigate = jest.fn();
const mockGetEntityPermissionByFqn = jest
  .fn()
  .mockImplementation(() => Promise.resolve(MOCK_PERMISSIONS));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
  })),
}));

jest.mock('../../../utils/FeedUtilsPure', () => ({
  fetchEntityTaskCountsInto: jest.fn(),
  getFeedCounts: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

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
    mockUseTestCase.testCasePermission = MOCK_PERMISSIONS;
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
  });

  it('should fetch test case permission and task counts on mount', async () => {
    renderDetailPageHook();

    await waitFor(() =>
      expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
        'testCase',
        mockTestCaseFqn
      )
    );

    expect(fetchEntityTaskCountsInto).toHaveBeenCalledWith(
      mockTestCaseFqn,
      expect.any(Function)
    );
  });

  it('should derive no view permission from the store permission', async () => {
    mockUseTestCase.testCasePermission = DEFAULT_ENTITY_PERMISSION;

    const { result } = renderDetailPageHook();

    await waitFor(() => expect(result.current.hasViewPermission).toBeFalsy());
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

    expect(mockNavigate).toHaveBeenCalledTimes(1);
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

    expect(mockNavigate).toHaveBeenCalledTimes(1);
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
