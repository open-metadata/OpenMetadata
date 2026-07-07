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
  useFqn: () => ({ fqn: 'bundle_suite_fqn' }),
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

  it('should add test cases in bulk and refetch', async () => {
    const { result } = renderHook(() => useTestSuiteDetailsPage());

    await waitFor(() => {
      expect(result.current.testSuite).toEqual(mockTestSuite);
    });
    (getTestSuiteByName as jest.Mock).mockClear();

    await act(async () => {
      await result.current.handleAddTestCaseSubmit({
        selectAll: false,
        includeIds: ['tc-9'],
        excludeIds: [],
      });
    });

    expect(addTestCasesToLogicalTestSuiteBulk).toHaveBeenCalledWith(
      'suite-id',
      {
        selectAll: false,
        includeIds: ['tc-9'],
        excludeIds: [],
      }
    );
    expect(getTestSuiteByName).toHaveBeenCalled();
    expect(result.current.isTestCaseModalOpen).toBe(false);
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
