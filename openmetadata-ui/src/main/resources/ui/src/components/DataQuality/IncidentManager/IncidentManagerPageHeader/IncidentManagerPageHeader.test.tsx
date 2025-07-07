/*
 *  Copyright 2024 Collate.
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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Severities } from '../../../../generated/tests/testCaseResolutionStatus';
import {
  MOCK_TEST_CASE_DATA,
  MOCK_TEST_CASE_INCIDENT,
  MOCK_TEST_CASE_RESOLUTION_STATUS,
  MOCK_THREAD_DATA,
} from '../../../../mocks/TestCase.mock';
import {
  getListTestCaseIncidentByStateId,
  updateTestCaseIncidentById,
} from '../../../../rest/incidentManagerAPI';
import IncidentManagerPageHeader from './IncidentManagerPageHeader.component';
import { IncidentManagerPageHeaderProps } from './IncidentManagerPageHeader.interface';

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
  entityThread: MOCK_THREAD_DATA,
  getFeedData: jest.fn().mockImplementation(() => Promise.resolve()),
  setActiveThread: jest.fn(),
  postFeed: jest.fn(),
  testCaseResolutionStatus: MOCK_TEST_CASE_RESOLUTION_STATUS,
  updateTestCaseIncidentStatus: jest.fn(),
};

const mockOnOwnerUpdate = jest.fn();
const mockFetchTaskCount = jest.fn();

const mockProps: IncidentManagerPageHeaderProps = {
  onOwnerUpdate: mockOnOwnerUpdate,
  fetchTaskCount: mockFetchTaskCount,
};

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentByStateId: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_TEST_CASE_INCIDENT)),
  updateTestCaseIncidentById: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
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

jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p data-testid="link">{children}</p>
    )),
  useParams: jest.fn().mockImplementation(() => ({
    fqn: 'fqn',
  })),
}));

jest.mock('.../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermission: jest
      .fn()
      .mockImplementation(() => mockEntityPermissions),
  })),
}));

jest.mock('../../../../utils/CommonUtils', () => ({
  getNameFromFQN: jest.fn().mockReturnValue('getNameFromFQN'),
}));

jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('getEntityName'),
  getColumnNameFromEntityLink: jest
    .fn()
    .mockReturnValue('getColumnNameFromEntityLink'),
}));

jest.mock('../../../../utils/FeedUtils', () => ({
  getEntityFQN: jest.fn().mockReturnValue('entityFQN'),
}));

jest.mock('../../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../../utils/TasksUtils', () => ({
  getTaskDetailPath: jest.fn().mockReturnValue('/'),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest
    .fn()
    .mockImplementation(({ children, onUpdate, placeHolder, ...rest }) => (
      <div {...rest} data-testid="owner-component" onClick={onUpdate}>
        <div data-testid="placeholder">{placeHolder}</div>
        {children}
      </div>
    )),
}));

jest.mock('../Severity/Severity.component', () => {
  return jest.fn().mockImplementation(({ headerName, onSubmit }) => (
    <div>
      <div data-testid="severity-header">{headerName}</div>
      <div>Severity.component</div>
      <button
        data-testid="update-severity"
        onClick={() => onSubmit(Severities.Severity4)}
      />
    </div>
  ));
});

jest.mock('../TestCaseStatus/TestCaseIncidentManagerStatus.component', () => {
  return jest.fn().mockImplementation(({ headerName, onSubmit }) => (
    <div>
      <div data-testid="status-header">{headerName}</div>
      <div>TestCaseIncidentManagerStatus.component</div>
      <button
        data-testid="test-case-incident-manager-status"
        onClick={() => onSubmit(MOCK_TEST_CASE_RESOLUTION_STATUS[1])}
      />
    </div>
  ));
});

const mockUseTestCaseStore = {
  testCase: { ...MOCK_TEST_CASE_DATA, incidentId: '123' },
};
jest.mock(
  '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store',
  () => ({
    useTestCaseStore: jest.fn().mockImplementation(() => mockUseTestCaseStore),
  })
);

describe('Incident Manager Page Header component', () => {
  it('getFeedData should be call on mount', async () => {
    render(<IncidentManagerPageHeader {...mockProps} />);

    expect(mockUseActivityFeedProviderValue.getFeedData).toHaveBeenCalledWith(
      undefined,
      undefined,
      'Task',
      'testCase',
      'fqn'
    );
  });

  it('getListTestCaseIncidentByStateId should be call on mount', async () => {
    render(
      <IncidentManagerPageHeader
        {...mockProps}
        testCaseData={{ ...MOCK_TEST_CASE_DATA, incidentId: '123' }}
      />
    );

    expect(getListTestCaseIncidentByStateId).toHaveBeenCalledWith('123');
  });

  it('should trigger onOwnerUpdate', async () => {
    render(<IncidentManagerPageHeader {...mockProps} />);

    fireEvent.click(screen.getByTestId('owner-component'));

    expect(mockOnOwnerUpdate).toHaveBeenCalled();
  });

  it('should call updateTestCaseIncidentById & updateTestCaseIncidentStatus', async () => {
    await act(async () => {
      render(
        <IncidentManagerPageHeader
          {...mockProps}
          testCaseData={{ ...MOCK_TEST_CASE_DATA, incidentId: '123' }}
        />
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('update-severity'));
    });

    expect(updateTestCaseIncidentById).toHaveBeenCalled();

    expect(
      mockUseActivityFeedProviderValue.updateTestCaseIncidentStatus
    ).toHaveBeenCalled();
  });

  it('should call updateTestCaseIncidentStatus onClick of onIncidentStatusUpdate', async () => {
    await act(async () => {
      render(
        <IncidentManagerPageHeader
          {...mockProps}
          testCaseData={{ ...MOCK_TEST_CASE_DATA, incidentId: '123' }}
        />
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-case-incident-manager-status'));
    });

    expect(
      mockUseActivityFeedProviderValue.updateTestCaseIncidentStatus
    ).toHaveBeenCalled();
  });

  it('Component should render without status details', async () => {
    render(<IncidentManagerPageHeader {...mockProps} />);

    expect(screen.getByTestId('owner-component')).toBeInTheDocument();
    // If Table FQN is present
    expect(screen.getByText('label.table')).toBeInTheDocument();
    expect(screen.getByText('getNameFromFQN')).toBeInTheDocument();
    // Test Type
    expect(screen.getByText('label.test-type')).toBeInTheDocument();
    expect(screen.getByText('getEntityName')).toBeInTheDocument();
  });

  it('Component should render with status details', async () => {
    await act(async () => {
      render(
        <IncidentManagerPageHeader
          {...mockProps}
          testCaseData={{
            ...MOCK_TEST_CASE_DATA,
            incidentId: '123',
          }}
        />
      );
    });

    expect(screen.getAllByTestId('owner-component')).toHaveLength(2);
    // Incident
    expect(screen.getByText('label.incident')).toBeInTheDocument();
    expect(screen.getByText('#9')).toBeInTheDocument();
    // Incident
    expect(screen.getByText('label.incident-status')).toBeInTheDocument();
    expect(
      screen.getByText('TestCaseIncidentManagerStatus.component')
    ).toBeInTheDocument();
    // Assignee
    expect(screen.getByTestId('assignee')).toBeInTheDocument();
    // Severity
    expect(screen.getByText('label.severity')).toBeInTheDocument();
    expect(screen.getByText('Severity.component')).toBeInTheDocument();
    // If Table FQN is present
    expect(screen.getByText('label.table')).toBeInTheDocument();
    expect(screen.getByText('getNameFromFQN')).toBeInTheDocument();
    // Test Type
    expect(screen.getByText('label.test-type')).toBeInTheDocument();
    expect(screen.getByText('getEntityName')).toBeInTheDocument();
    // If Column is present
    expect(screen.getByText('label.column')).toBeInTheDocument();
    expect(screen.getByText('getColumnNameFromEntityLink')).toBeInTheDocument();
  });
});
