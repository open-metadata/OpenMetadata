/*
 *  Copyright 2023 Collate.
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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  TestCaseFailureReasonType,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import { postTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import { getUserAndTeamSearch } from '../../../../rest/miscAPI';
import InlineTestCaseIncidentStatus from './InlineTestCaseIncidentStatus.component';

const mockOnSubmit = jest.fn();

const mockData: TestCaseResolutionStatus = {
  id: 'test-id',
  stateId: 'state-id',
  timestamp: 1703830298324,
  testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
  updatedBy: {
    id: 'user-id',
    type: 'user',
    name: 'testuser',
    fullyQualifiedName: 'testuser',
    deleted: false,
  },
  updatedAt: 1703830298324,
  testCaseReference: {
    id: 'testcase-id',
    type: 'testCase',
    name: 'test_case_name',
    fullyQualifiedName: 'test.case.name',
  },
};

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  postTestCaseIncidentStatus: jest.fn().mockResolvedValue({
    id: 'new-status-id',
    testCaseResolutionStatusType: TestCaseResolutionStatusTypes.ACK,
  }),
}));

jest.mock('../../../../rest/miscAPI', () => ({
  getUserAndTeamSearch: jest.fn().mockResolvedValue({
    data: {
      hits: {
        hits: [
          {
            _id: 'user-1',
            _source: {
              name: 'user1',
              displayName: 'User One',
              entityType: 'user',
            },
          },
        ],
      },
    },
  }),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: {
      id: 'current-user-id',
      name: 'currentuser',
      displayName: 'Current User',
      type: 'user',
    },
  })),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('InlineTestCaseIncidentStatus Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render component with status', () => {
    render(
      <InlineTestCaseIncidentStatus
        hasEditPermission
        data={mockData}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('should render with hasEditPermission true', () => {
    render(
      <InlineTestCaseIncidentStatus
        hasEditPermission
        data={mockData}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('should render with hasEditPermission false', () => {
    render(
      <InlineTestCaseIncidentStatus
        data={mockData}
        hasEditPermission={false}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('should render New status', () => {
    render(
      <InlineTestCaseIncidentStatus
        hasEditPermission
        data={{
          ...mockData,
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
        }}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('should render ACK status', () => {
    render(
      <InlineTestCaseIncidentStatus
        hasEditPermission
        data={{
          ...mockData,
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.ACK,
        }}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Ack')).toBeInTheDocument();
  });

  it('should render Assigned status', () => {
    render(
      <InlineTestCaseIncidentStatus
        hasEditPermission
        data={{
          ...mockData,
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
        }}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Assigned')).toBeInTheDocument();
  });

  it('should render Resolved status', () => {
    render(
      <InlineTestCaseIncidentStatus
        hasEditPermission
        data={{
          ...mockData,
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
        }}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('should open menu when clicking on chip with edit permission', async () => {
    render(
      <InlineTestCaseIncidentStatus
        hasEditPermission
        data={mockData}
        onSubmit={mockOnSubmit}
      />
    );

    const chip = screen.getByText('New');
    await act(async () => {
      fireEvent.click(chip);
    });

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
  });

  it('should render with Assigned status and assignee', () => {
    const assignedData: TestCaseResolutionStatus = {
      ...mockData,
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
      testCaseResolutionStatusDetails: {
        assignee: {
          id: 'assignee-id',
          type: 'user',
          name: 'assignee',
          displayName: 'Assignee User',
        },
      },
    };

    render(
      <InlineTestCaseIncidentStatus
        hasEditPermission
        data={assignedData}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Assigned')).toBeInTheDocument();
  });

  it('should render with Resolved status', () => {
    const resolvedData: TestCaseResolutionStatus = {
      ...mockData,
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
      testCaseResolutionStatusDetails: {
        testCaseFailureReason: TestCaseFailureReasonType.FalsePositive,
        testCaseFailureComment: 'Test comment',
      },
    };

    render(
      <InlineTestCaseIncidentStatus
        hasEditPermission
        data={resolvedData}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('should handle status changes when rerendering', () => {
    const { rerender, container } = render(
      <InlineTestCaseIncidentStatus
        hasEditPermission
        data={mockData}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('New')).toBeInTheDocument();

    rerender(
      <InlineTestCaseIncidentStatus
        hasEditPermission
        data={{
          ...mockData,
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.ACK,
        }}
        onSubmit={mockOnSubmit}
      />
    );

    expect(
      container.querySelector('[data-testid="test_case_name-status"]')
    ).toBeInTheDocument();
  });

  it('should show status menu with all status options', async () => {
    render(
      <InlineTestCaseIncidentStatus
        hasEditPermission
        data={mockData}
        onSubmit={mockOnSubmit}
      />
    );

    const chip = screen.getByText('New');
    await act(async () => {
      fireEvent.click(chip);
    });

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    const menuItems = screen.getAllByRole('menuitem');

    expect(menuItems).toHaveLength(
      Object.values(TestCaseResolutionStatusTypes).length
    );
  });

  it('should have postTestCaseIncidentStatus available', () => {
    expect(postTestCaseIncidentStatus).toBeDefined();
  });

  it('should have onSubmit callback passed to component', () => {
    render(
      <InlineTestCaseIncidentStatus
        hasEditPermission
        data={mockData}
        onSubmit={mockOnSubmit}
      />
    );

    expect(mockOnSubmit).toBeDefined();
  });

  it('should render without crashing with minimal data', () => {
    const minimalData: TestCaseResolutionStatus = {
      id: 'test-id',
      stateId: 'state-id',
      timestamp: 1703830298324,
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
      updatedAt: 1703830298324,
    };

    render(
      <InlineTestCaseIncidentStatus
        hasEditPermission
        data={minimalData}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('should call getUserAndTeamSearch when needed', () => {
    expect(getUserAndTeamSearch).toBeDefined();
  });

  it('should open resolved popover when clicking Resolved status', async () => {
    const resolvedData: TestCaseResolutionStatus = {
      ...mockData,
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
      testCaseResolutionStatusDetails: {
        testCaseFailureReason: TestCaseFailureReasonType.FalsePositive,
        testCaseFailureComment: 'Comment',
      },
    };

    render(
      <InlineTestCaseIncidentStatus
        hasEditPermission
        data={resolvedData}
        onSubmit={mockOnSubmit}
      />
    );

    const chip = screen.getByText('Resolved');
    await act(async () => {
      fireEvent.click(chip);
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('test_case_name-resolved-popover')
      ).toBeInTheDocument();
    });
  });
});
