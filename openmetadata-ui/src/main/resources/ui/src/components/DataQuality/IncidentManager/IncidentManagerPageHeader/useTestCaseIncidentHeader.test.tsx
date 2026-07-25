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
import { act } from 'react';
import { Severities } from '../../../../generated/tests/testCaseResolutionStatus';
import {
  MOCK_TASK_DATA,
  MOCK_TEST_CASE_DATA,
  MOCK_TEST_CASE_INCIDENT,
  MOCK_TEST_CASE_RESOLUTION_STATUS,
} from '../../../../mocks/TestCase.mock';
import {
  getIncidentTaskByStateId,
  getListTestCaseIncidentByStateId,
  transitionIncident,
  updateTestCaseIncidentById,
} from '../../../../rest/incidentManagerAPI';
import { updateTestCaseById } from '../../../../rest/testAPI';
import { useTestCaseIncidentHeader } from './useTestCaseIncidentHeader';

const mockEntityPermissions = {
  Create: true,
  Delete: true,
  ViewAll: true,
  ViewBasic: true,
  EditAll: true,
  EditTags: true,
  EditDescription: true,
  EditDisplayName: true,
  EditCustomFields: true,
};

const mockUseActivityFeedProviderValue = {
  postFeed: jest.fn(),
  testCaseResolutionStatus: MOCK_TEST_CASE_RESOLUTION_STATUS,
  updateTestCaseIncidentStatus: jest.fn(),
};

const mockFetchTaskCount = jest.fn();

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  getIncidentTaskByStateId: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        jest.requireActual('../../../../mocks/TestCase.mock').MOCK_TASK_DATA[1]
      )
    ),
  getListTestCaseIncidentByStateId: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        jest.requireActual('../../../../mocks/TestCase.mock')
          .MOCK_TEST_CASE_INCIDENT
      )
    ),
  updateTestCaseIncidentById: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
  transitionIncident: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../../rest/testAPI', () => ({
  updateTestCaseById: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        jest.requireActual('../../../../mocks/TestCase.mock')
          .MOCK_TEST_CASE_DATA
      )
    ),
}));

jest.mock(
  '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest
      .fn()
      .mockImplementation(() => mockUseActivityFeedProviderValue),
    __esModule: true,
    default: 'ActivityFeedProvider',
  })
);

let mockParams: Record<string, string | undefined> = { fqn: 'fqn' };

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => mockParams),
}));

const mockUseTestCaseStore = {
  testCase: { ...MOCK_TEST_CASE_DATA, incidentId: '123' } as
    | (typeof MOCK_TEST_CASE_DATA & { incidentId?: string })
    | undefined,
  testCasePermission: mockEntityPermissions,
  setTestCase: jest.fn(),
};
jest.mock(
  '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store',
  () => ({
    useTestCaseStore: jest.fn().mockImplementation(() => mockUseTestCaseStore),
  })
);

jest.mock('../../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockImplementation(() => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: false,
    },
  })),
}));

jest.mock('../../../../utils/PermissionsUtils', () => ({
  getPrioritizedEditPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../../utils/TaskNavigationUtils', () => ({
  getTaskDisplayId: jest.fn().mockReturnValue(9),
}));

jest.mock('../../../../utils/ObservabilityRouterClassBase', () => ({
  __esModule: true,
  default: {
    getIncidentTaskPath: jest.fn().mockReturnValue('/task/9'),
  },
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const renderIncidentHeaderHook = (isVersionPage = false) =>
  renderHook(() =>
    useTestCaseIncidentHeader({
      fetchTaskCount: mockFetchTaskCount,
      isVersionPage,
    })
  );

describe('useTestCaseIncidentHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { fqn: 'fqn' };
    mockUseTestCaseStore.testCase = {
      ...MOCK_TEST_CASE_DATA,
      incidentId: '123',
    };
  });

  it('should fetch the incident task and resolution status on mount', async () => {
    const { result } = renderIncidentHeaderHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getIncidentTaskByStateId).toHaveBeenCalledWith('123');
    expect(getListTestCaseIncidentByStateId).toHaveBeenCalledWith('123');
    expect(result.current.testCaseStatusData).toEqual(
      MOCK_TEST_CASE_INCIDENT.data[0]
    );
    expect(result.current.incidentTask).toEqual(MOCK_TASK_DATA[1]);
  });

  it('should skip incident fetches when there is no incident id', async () => {
    mockUseTestCaseStore.testCase = { ...MOCK_TEST_CASE_DATA };

    const { result } = renderIncidentHeaderHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getIncidentTaskByStateId).not.toHaveBeenCalled();
    expect(getListTestCaseIncidentByStateId).not.toHaveBeenCalled();
    expect(result.current.testCaseStatusData).toBeUndefined();
  });

  it('should expose the owner version diff only on the version page', async () => {
    const { result: liveResult } = renderIncidentHeaderHook();

    await waitFor(() => expect(liveResult.current.isLoading).toBe(false));

    expect(liveResult.current.ownerDisplayName).toBeUndefined();
    expect(liveResult.current.ownerRef).toBeUndefined();

    const { result: versionResult } = renderIncidentHeaderHook(true);

    await waitFor(() => expect(versionResult.current.isLoading).toBe(false));

    expect(versionResult.current.ownerDisplayName).not.toBeUndefined();
  });

  it('should build the task link info from the incident task', async () => {
    const { result } = renderIncidentHeaderHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.taskLinkInfo).toEqual({
      path: '/task/9',
      label: '#9',
    });
  });

  it('handleSeverityUpdate should patch the incident and update the provider', async () => {
    const { result } = renderIncidentHeaderHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleSeverityUpdate(Severities.Severity1);
    });

    expect(updateTestCaseIncidentById).toHaveBeenCalledWith(
      MOCK_TEST_CASE_INCIDENT.data[0].id,
      expect.arrayContaining([expect.objectContaining({ path: '/severity' })])
    );
    expect(
      mockUseActivityFeedProviderValue.updateTestCaseIncidentStatus
    ).toHaveBeenCalled();
    expect(result.current.testCaseStatusData?.severity).toBe(
      Severities.Severity1
    );
  });

  it('handleAssigneeUpdate should transition the incident and refresh the status', async () => {
    const { result } = renderIncidentHeaderHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleAssigneeUpdate([
        { id: 'assignee-id', type: 'user', name: 'assignee' },
      ]);
    });

    expect(transitionIncident).toHaveBeenCalledWith(
      MOCK_TEST_CASE_INCIDENT.data[0].stateId,
      expect.objectContaining({ transitionId: 'assign' })
    );
    expect(
      mockUseActivityFeedProviderValue.updateTestCaseIncidentStatus
    ).toHaveBeenCalled();
  });

  it('handleDomainUpdate should patch the test case domains', async () => {
    const { result } = renderIncidentHeaderHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleDomainUpdate({
        id: 'domain-id',
        type: 'domain',
      });
    });

    expect(updateTestCaseById).toHaveBeenCalledWith(
      MOCK_TEST_CASE_DATA.id,
      expect.arrayContaining([expect.objectContaining({ path: '/domains' })])
    );
    expect(mockUseTestCaseStore.setTestCase).toHaveBeenCalled();
  });

  it('should expose edit permissions from the test case permission', async () => {
    const { result } = renderIncidentHeaderHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasEditStatusPermission).toBe(true);
    expect(result.current.hasEditOwnerPermission).toBe(true);
    expect(result.current.hasEditDomainPermission).toBe(true);
    expect(result.current.canAddMultipleUserOwners).toBe(true);
    expect(result.current.canAddMultipleTeamOwner).toBe(false);
  });

  it('should disable edit permissions on version pages', async () => {
    const { result } = renderIncidentHeaderHook(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasEditStatusPermission).toBe(false);
    expect(result.current.hasEditOwnerPermission).toBe(false);
    expect(result.current.hasEditDomainPermission).toBe(false);
  });

  it('should expose the table fqn and dimension key', async () => {
    mockParams = { fqn: 'fqn', dimensionKey: 'completeness' };

    const { result } = renderIncidentHeaderHook();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tableFqn).toBe(
      'sample_data.ecommerce_db.shopify.dim_address'
    );
    expect(result.current.dimensionKey).toBe('completeness');
  });
});
