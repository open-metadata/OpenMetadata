/*
 *  Copyright 2025 Collate.
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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TestCase, TestCaseStatus } from '../../../../generated/tests/testCase';
import {
  Severities,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import DataQualityTab from './DataQualityTab';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string, options?: any) => {
      if (options) {
        return `${key} - ${JSON.stringify(options)}`;
      }

      return key;
    },
  }),
}));

// Mock antd components
jest.mock('antd', () => ({
  Avatar: jest.fn().mockImplementation(({ children, ...props }) => (
    <div data-testid="avatar" {...props}>
      {children}
    </div>
  )),
  Button: jest
    .fn()
    .mockImplementation(({ children, onClick, className, ...props }) => (
      <button
        className={className}
        data-testid="button"
        onClick={onClick}
        {...props}>
        {children}
      </button>
    )),
  Card: jest.fn().mockImplementation(({ children, className, ...props }) => (
    <div className={className} data-testid="card" {...props}>
      {children}
    </div>
  )),
  Col: jest
    .fn()
    .mockImplementation(({ children, span, className, ...props }) => (
      <div className={className} data-span={span} data-testid="col" {...props}>
        {children}
      </div>
    )),
  Row: jest
    .fn()
    .mockImplementation(({ children, className, gutter, ...props }) => (
      <div
        className={className}
        data-gutter={gutter}
        data-testid="row"
        {...props}>
        {children}
      </div>
    )),
  Tabs: jest
    .fn()
    .mockImplementation(
      ({ children, items, activeKey, onChange, ...props }) => (
        <div data-active-key={activeKey} data-testid="tabs" {...props}>
          <div data-testid="tab-headers">
            {items.map((item: any) => (
              <button
                data-testid={`tab-${item.key}`}
                key={item.key}
                onClick={() => onChange?.(item.key)}>
                {item.label}
              </button>
            ))}
          </div>
          <div data-testid="tab-content">
            {items.find((item: any) => item.key === activeKey)?.children}
          </div>
        </div>
      )
    ),
  Typography: {
    Text: jest
      .fn()
      .mockImplementation(
        ({ children, className, ellipsis, strong, ...props }) => (
          <span
            className={className}
            data-ellipsis={ellipsis}
            data-testid="typography-text"
            {...props}>
            {children}
          </span>
        )
      ),
    Title: jest
      .fn()
      .mockImplementation(({ children, level, className, ...props }) => (
        <h1
          className={className}
          data-level={level}
          data-testid="typography-title"
          {...props}>
          {children}
        </h1>
      )),
  },
}));

// Mock child components
jest.mock('../../../common/DataQualitySection', () => {
  return jest
    .fn()
    .mockImplementation(
      ({ tests, totalTests, onEdit, onFilterChange, activeFilter }) => (
        <div data-testid="data-quality-section">
          <div data-testid="total-tests">{totalTests}</div>
          {tests.map((test: any, index: number) => (
            <div
              data-testid={`test-${test.type}`}
              key={index}
              role="button"
              onClick={() => onFilterChange?.(test.type)}>
              {test.count}
            </div>
          ))}
          <button data-testid="edit-button" onClick={onEdit}>
            Edit
          </button>
        </div>
      )
    );
});

jest.mock('../../../common/Loader/Loader', () => {
  return jest.fn().mockImplementation(({ size }) => (
    <div data-size={size} data-testid="loader">
      Loading...
    </div>
  ));
});

jest.mock('../../../common/StatusBadge/StatusBadgeV2.component', () => {
  return jest.fn().mockImplementation(({ label, status }) => (
    <div data-label={label} data-status={status} data-testid="status-badge">
      {label}
    </div>
  ));
});

// Mock Transi18next component
jest.mock('../../../../utils/CommonUtils', () => ({
  Transi18next: jest
    .fn()
    .mockImplementation(({ i18nKey, renderElement, values }) => (
      <div data-testid="trans-component">
        {i18nKey} - {JSON.stringify(values)}
        {renderElement}
      </div>
    )),
}));

// Mock API functions
jest.mock('../../../../rest/testAPI', () => ({
  listTestCases: jest.fn(),
}));

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentStatus: jest.fn(),
}));

// Mock utility functions
jest.mock('../../../../utils/TableUtils', () => ({
  generateEntityLink: jest.fn().mockReturnValue('test-entity-link'),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  getCurrentMillis: jest.fn().mockReturnValue(1234567890),
  getEpochMillisForPastDays: jest.fn().mockReturnValue(1234567890),
}));

const mockEntityFQN = 'test.entity.fqn';
const mockEntityType = 'table';

const mockTestCases: TestCase[] = [
  {
    id: 'test-case-1',
    name: 'Test Case 1',
    fullyQualifiedName: 'test.entity.fqn::columns::column1',
    entityLink: 'test.entity.fqn::columns::column1',
    testCaseResult: {
      testCaseStatus: TestCaseStatus.Success,
      timestamp: 1234567890,
    },
    testDefinition: {} as any,
    testSuite: {} as any,
  },
  {
    id: 'test-case-2',
    name: 'Test Case 2',
    fullyQualifiedName: 'test.entity.fqn::columns::column2',
    entityLink: 'test.entity.fqn::columns::column2',
    testCaseResult: {
      testCaseStatus: TestCaseStatus.Failed,
      timestamp: 1234567890,
    },
    incidentId: 'incident-1',
    testDefinition: {} as any,
    testSuite: {} as any,
  },
  {
    id: 'test-case-3',
    name: 'Test Case 3',
    fullyQualifiedName: 'test.entity.fqn::columns::column3',
    entityLink: 'test.entity.fqn::columns::column3',
    testCaseResult: {
      testCaseStatus: TestCaseStatus.Aborted,
      timestamp: 1234567890,
    },
    testDefinition: {} as any,
    testSuite: {} as any,
  },
];

const mockIncidents: TestCaseResolutionStatus[] = [
  {
    id: 'incident-1',
    testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
    testCaseReference: {
      id: 'test-case-1',
      type: 'testCase',
      displayName: 'Test Case 1',
      name: 'test_case_1',
      fullyQualifiedName: 'test.entity.fqn::columns::column1',
    },
    severity: Severities.Severity1,
    timestamp: 1234567890,
  },
  {
    id: 'incident-2',
    testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
    testCaseReference: {
      id: 'test-case-2',
      type: 'testCase',
      displayName: 'Test Case 2',
      name: 'test_case_2',
      fullyQualifiedName: 'test.entity.fqn::columns::column2',
    },
    testCaseResolutionStatusDetails: {
      assignee: {
        id: 'john.doe',
        type: 'user',
        displayName: 'John Doe',
        name: 'john.doe',
      },
    },
    severity: Severities.Severity2,
    timestamp: 1234567890,
  },
];

const defaultProps = {
  entityFQN: mockEntityFQN,
  entityType: mockEntityType,
};

describe('DataQualityTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should render loader when loading', async () => {
      const { listTestCases } = jest.requireMock('../../../../rest/testAPI');
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      // Mock delayed API responses
      listTestCases.mockImplementation(() => new Promise(() => undefined));
      getListTestCaseIncidentStatus.mockImplementation(
        () => new Promise(() => undefined)
      );

      render(<DataQualityTab {...defaultProps} />);

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('should render with correct CSS classes when loading', async () => {
      const { listTestCases } = jest.requireMock('../../../../rest/testAPI');
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      listTestCases.mockImplementation(() => new Promise(() => undefined));
      getListTestCaseIncidentStatus.mockImplementation(
        () => new Promise(() => undefined)
      );

      const { container } = render(<DataQualityTab {...defaultProps} />);

      expect(
        container.querySelector('.data-quality-tab-container')
      ).toBeInTheDocument();
    });
  });

  describe('No Test Cases', () => {
    it('should render no test cases message when no test cases', async () => {
      const { listTestCases } = jest.requireMock('../../../../rest/testAPI');
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      listTestCases.mockResolvedValue({ data: [] });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: [] });

      render(<DataQualityTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('trans-component')).toBeInTheDocument();
      });
    });

    it('should render documentation link when no test cases', async () => {
      const { listTestCases } = jest.requireMock('../../../../rest/testAPI');
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      listTestCases.mockResolvedValue({ data: [] });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: [] });

      render(<DataQualityTab {...defaultProps} />);

      await waitFor(() => {
        const docLink = screen.getByTitle(
          'Data Quality Profiler Documentation'
        );

        expect(docLink).toBeInTheDocument();
        expect(docLink).toHaveAttribute('target', '_blank');
        expect(docLink).toHaveAttribute('rel', 'noreferrer');
      });
    });
  });

  describe('Test Cases Rendering', () => {
    beforeEach(async () => {
      const { listTestCases } = jest.requireMock('../../../../rest/testAPI');
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      listTestCases.mockResolvedValue({ data: mockTestCases });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: mockIncidents });

      render(<DataQualityTab {...defaultProps} />);
    });

    it('should render data quality section with correct test counts', async () => {
      await waitFor(() => {
        expect(screen.getByTestId('data-quality-section')).toBeInTheDocument();
      });

      expect(screen.getByTestId('total-tests')).toHaveTextContent('3');
      expect(screen.getByTestId('test-success')).toHaveTextContent('1');
      expect(screen.getByTestId('test-failed')).toHaveTextContent('1');
      expect(screen.getByTestId('test-aborted')).toHaveTextContent('1');
    });

    it('should render test case cards', async () => {
      await waitFor(() => {
        expect(screen.getByTestId('data-quality-section')).toBeInTheDocument();
      });

      // By default, only success test cases are shown
      expect(screen.getByText('Test Case 1')).toBeInTheDocument();

      // Click on failed filter to see failed test cases
      const failedButton = screen.getByTestId('test-failed');
      fireEvent.click(failedButton);

      expect(screen.getByText('Test Case 2')).toBeInTheDocument();

      // Click on aborted filter to see aborted test cases
      const abortedButton = screen.getByTestId('test-aborted');
      fireEvent.click(abortedButton);

      expect(screen.getByText('Test Case 3')).toBeInTheDocument();
    });

    it('should render test case status badges', async () => {
      await waitFor(() => {
        expect(screen.getByTestId('data-quality-section')).toBeInTheDocument();
      });

      // By default, only success test cases are shown (filter is 'success')
      // Look for status badges within test case cards specifically
      const statusBadges = screen.getAllByTestId('status-badge');

      // Filter out status badges from the overview section (which show counts)
      // and only count those from actual test case cards
      const testCaseStatusBadges = statusBadges.filter((badge) => {
        const card = badge.closest('.test-case-card');

        return card !== null;
      });

      expect(testCaseStatusBadges).toHaveLength(1); // By default, only success test cases are shown

      // Click on failed filter to see failed test cases
      const failedButton = screen.getByTestId('test-failed');
      fireEvent.click(failedButton);

      // Wait for the filter to apply
      await waitFor(() => {
        const allStatusBadges = screen.getAllByTestId('status-badge');
        const failedStatusBadges = allStatusBadges.filter((badge) => {
          const card = badge.closest('.test-case-card');

          return card !== null;
        });

        expect(failedStatusBadges).toHaveLength(1);
      });
    });

    it('should render column names for test cases', async () => {
      await waitFor(() => {
        expect(screen.getByTestId('data-quality-section')).toBeInTheDocument();
      });

      // By default, only success test cases are shown
      expect(screen.getByText('column1')).toBeInTheDocument();

      // Click on failed filter to see failed test cases
      const failedButton = screen.getByTestId('test-failed');
      fireEvent.click(failedButton);

      expect(screen.getByText('column2')).toBeInTheDocument();

      // Click on aborted filter to see aborted test cases
      const abortedButton = screen.getByTestId('test-aborted');
      fireEvent.click(abortedButton);

      expect(screen.getByText('column3')).toBeInTheDocument();
    });

    it('should render incident status for test cases with incidents', async () => {
      await waitFor(() => {
        expect(screen.getByTestId('data-quality-section')).toBeInTheDocument();
      });

      // Click on failed filter to see failed test cases (which have incidents)
      const failedButton = screen.getByTestId('test-failed');
      fireEvent.click(failedButton);

      expect(screen.getByText('ASSIGNED')).toBeInTheDocument();
    });
  });

  describe('Filter Functionality', () => {
    beforeEach(async () => {
      const { listTestCases } = jest.requireMock('../../../../rest/testAPI');
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      listTestCases.mockResolvedValue({ data: mockTestCases });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: mockIncidents });

      render(<DataQualityTab {...defaultProps} />);
    });

    it('should filter test cases by success status', async () => {
      await waitFor(() => {
        expect(screen.getByTestId('data-quality-section')).toBeInTheDocument();
      });

      // Default filter is 'success', so only success test cases are visible initially
      expect(screen.getByText('Test Case 1')).toBeInTheDocument();
      expect(screen.queryByText('Test Case 2')).not.toBeInTheDocument();
      expect(screen.queryByText('Test Case 3')).not.toBeInTheDocument();

      // Click on success filter to see only success test cases
      const successButton = screen.getByTestId('test-success');
      fireEvent.click(successButton);

      // Wait for the filter to apply and then check results
      await waitFor(() => {
        expect(screen.getByText('Test Case 1')).toBeInTheDocument();
        expect(screen.queryByText('Test Case 2')).not.toBeInTheDocument();
        expect(screen.queryByText('Test Case 3')).not.toBeInTheDocument();
      });
    });

    it('should filter test cases by failed status', async () => {
      await waitFor(() => {
        expect(screen.getByTestId('data-quality-section')).toBeInTheDocument();
      });

      const failedButton = screen.getByTestId('test-failed');
      fireEvent.click(failedButton);

      expect(screen.queryByText('Test Case 1')).not.toBeInTheDocument();
      expect(screen.getByText('Test Case 2')).toBeInTheDocument();
      expect(screen.queryByText('Test Case 3')).not.toBeInTheDocument();
    });

    it('should filter test cases by aborted status', async () => {
      await waitFor(() => {
        expect(screen.getByTestId('data-quality-section')).toBeInTheDocument();
      });

      const abortedButton = screen.getByTestId('test-aborted');
      fireEvent.click(abortedButton);

      expect(screen.queryByText('Test Case 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Test Case 2')).not.toBeInTheDocument();
      expect(screen.getByText('Test Case 3')).toBeInTheDocument();
    });

    it('should show no test cases message when filter has no results', async () => {
      // Clear all mocks to avoid interference from beforeEach
      jest.clearAllMocks();

      // Create test cases with only success status
      const successOnlyTestCases = [
        {
          id: 'test-case-1',
          name: 'Test Case 1',
          fullyQualifiedName: 'test.entity.fqn::columns::column1',
          entityLink: 'test.entity.fqn::columns::column1',
          testCaseResult: {
            testCaseStatus: TestCaseStatus.Success,
            timestamp: 1234567890,
          },
          testDefinition: {} as any,
          testSuite: {} as any,
        },
      ];

      const { listTestCases } = jest.requireMock('../../../../rest/testAPI');
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      listTestCases.mockResolvedValue({ data: successOnlyTestCases });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: [] });

      render(<DataQualityTab {...defaultProps} />);

      // Wait for component to load first
      await waitFor(() => {
        expect(
          screen.getAllByTestId('data-quality-section')[0]
        ).toBeInTheDocument();
      });

      // Click on failed filter - should show no results message
      const failedButtons = screen.getAllByTestId('test-failed');
      const failedButtonWithZeroCount = failedButtons.find(
        (button) => button.textContent === '0'
      );
      fireEvent.click(failedButtonWithZeroCount!);

      // Wait for the component to re-render with the filtered results
      await waitFor(() => {
        expect(screen.getByText(/label.no-entity/)).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    beforeEach(async () => {
      const { listTestCases } = jest.requireMock('../../../../rest/testAPI');
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      listTestCases.mockResolvedValue({ data: mockTestCases });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: mockIncidents });

      render(<DataQualityTab {...defaultProps} />);
    });

    it('should render both data quality and incidents tabs', async () => {
      await waitFor(() => {
        expect(screen.getByTestId('data-quality-section')).toBeInTheDocument();
      });

      expect(screen.getByTestId('tab-data-quality')).toBeInTheDocument();
      expect(screen.getByTestId('tab-incidents')).toBeInTheDocument();
    });

    it('should switch to incidents tab', async () => {
      await waitFor(() => {
        expect(screen.getByTestId('data-quality-section')).toBeInTheDocument();
      });

      const incidentsTab = screen.getByTestId('tab-incidents');
      fireEvent.click(incidentsTab);

      expect(
        screen.getByText('label.new', { selector: '.stat-label.new' })
      ).toBeInTheDocument();
    });

    it('should switch back to data quality tab', async () => {
      await waitFor(() => {
        expect(screen.getByTestId('data-quality-section')).toBeInTheDocument();
      });

      const incidentsTab = screen.getByTestId('tab-incidents');
      fireEvent.click(incidentsTab);

      const dataQualityTab = screen.getByTestId('tab-data-quality');
      fireEvent.click(dataQualityTab);

      expect(screen.getByTestId('data-quality-section')).toBeInTheDocument();
    });
  });

  describe('Incidents Tab', () => {
    beforeEach(async () => {
      const { listTestCases } = jest.requireMock('../../../../rest/testAPI');
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      listTestCases.mockResolvedValue({ data: mockTestCases });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: mockIncidents });

      render(<DataQualityTab {...defaultProps} />);

      // Wait for component to load and then switch to incidents tab
      await waitFor(() => {
        screen.getByTestId('data-quality-section');
      });

      const incidentsTab = screen.getByTestId('tab-incidents');
      fireEvent.click(incidentsTab);
    });

    it('should render incidents summary section', () => {
      expect(screen.getByText('label.new')).toBeInTheDocument();
      expect(screen.getByText('label.acknowledged')).toBeInTheDocument();
      expect(screen.getByText('label.assigned')).toBeInTheDocument();
    });

    it('should render incident status counts', () => {
      // Use getAllByText to get all elements with the same text
      const newIncidentCounts = screen.getAllByText('01');
      const resolvedIncidentCounts = screen.getAllByText('00');

      expect(newIncidentCounts.length).toBeGreaterThan(0); // New incidents
      expect(newIncidentCounts.length).toBeGreaterThan(0); // Assigned incidents
      expect(resolvedIncidentCounts.length).toBeGreaterThan(0); // Resolved incidents
    });

    it('should render incident filter buttons', () => {
      expect(
        screen.getByRole('button', { name: /label.new/ })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /label.acknowledged/ })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /label.assigned/ })
      ).toBeInTheDocument();
      expect(screen.getByText(/label.resolved/)).toBeInTheDocument();
    });

    it('should filter incidents by new status', () => {
      const newButton = screen.getByRole('button', { name: /label.new/ });
      fireEvent.click(newButton);

      expect(screen.getByText('Test Case 1')).toBeInTheDocument();
    });

    it('should filter incidents by assigned status', () => {
      const assignedButton = screen.getByRole('button', {
        name: /label.assigned/,
      });
      fireEvent.click(assignedButton);

      expect(screen.getByText('Test Case 2')).toBeInTheDocument();
    });

    it('should render assignee information for assigned incidents', () => {
      const assignedButton = screen.getByRole('button', {
        name: /label.assigned/,
      });
      fireEvent.click(assignedButton);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByTestId('avatar')).toBeInTheDocument();
    });

    it('should render severity information for incidents', () => {
      const newButton = screen.getByRole('button', { name: /label.new/ });
      fireEvent.click(newButton);

      expect(screen.getByText('SEVERITY - Severity1')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle test cases API error', async () => {
      const { listTestCases } = jest.requireMock('../../../../rest/testAPI');
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );
      const { showErrorToast } = jest.requireMock(
        '../../../../utils/ToastUtils'
      );

      listTestCases.mockRejectedValue(new Error('API Error'));
      getListTestCaseIncidentStatus.mockResolvedValue({ data: [] });

      render(<DataQualityTab {...defaultProps} />);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalled();
      });
    });

    it('should handle incidents API error', async () => {
      const { listTestCases } = jest.requireMock('../../../../rest/testAPI');
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );
      const { showErrorToast } = jest.requireMock(
        '../../../../utils/ToastUtils'
      );

      listTestCases.mockResolvedValue({ data: mockTestCases });
      getListTestCaseIncidentStatus.mockRejectedValue(new Error('API Error'));

      render(<DataQualityTab {...defaultProps} />);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing entityFQN', async () => {
      const { listTestCases } = jest.requireMock('../../../../rest/testAPI');
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      render(<DataQualityTab entityFQN="" entityType={mockEntityType} />);

      await waitFor(() => {
        expect(listTestCases).not.toHaveBeenCalled();
        expect(getListTestCaseIncidentStatus).not.toHaveBeenCalled();
      });
    });

    it('should handle test cases with missing data', async () => {
      const incompleteTestCases = [
        {
          id: 'test-case-1',
          name: 'Test Case 1',
          fullyQualifiedName: 'test.entity.fqn',
          entityLink: 'test.entity.fqn',
          testCaseResult: {
            testCaseStatus: TestCaseStatus.Success,
            timestamp: 1234567890,
          },
          testDefinition: {} as any,
          testSuite: {} as any,
        },
      ];

      const { listTestCases } = jest.requireMock('../../../../rest/testAPI');
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      listTestCases.mockResolvedValue({ data: incompleteTestCases });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: [] });

      render(<DataQualityTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Case 1')).toBeInTheDocument();
      });
    });

    it('should handle incidents with missing assignee', async () => {
      const incidentsWithoutAssignee = [
        {
          id: 'incident-1',
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
          testCaseReference: {
            id: 'test-case-1',
            type: 'testCase',
            displayName: 'Test Case 1',
            name: 'test_case_1',
            fullyQualifiedName: 'test.entity.fqn::columns::column1',
          },
          severity: Severities.Severity1,
          timestamp: 1234567890,
        },
      ];

      const { listTestCases } = jest.requireMock('../../../../rest/testAPI');
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      // Provide at least one test case so tabs are rendered
      listTestCases.mockResolvedValue({ data: [mockTestCases[0]] });
      getListTestCaseIncidentStatus.mockResolvedValue({
        data: incidentsWithoutAssignee,
      });

      render(<DataQualityTab {...defaultProps} />);

      await waitFor(() => {
        const incidentsTab = screen.getByTestId('tab-incidents');
        fireEvent.click(incidentsTab);

        const assignedButton = screen.getByRole('button', {
          name: /label.assigned/,
        });
        fireEvent.click(assignedButton);

        expect(screen.getByText('--')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show incidents loading state', async () => {
      const { listTestCases } = jest.requireMock('../../../../rest/testAPI');
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      listTestCases.mockResolvedValue({ data: mockTestCases });
      getListTestCaseIncidentStatus.mockImplementation(
        () => new Promise(() => undefined)
      );

      render(<DataQualityTab {...defaultProps} />);

      // Wait for component to load first
      await waitFor(() => {
        expect(screen.getByTestId('data-quality-section')).toBeInTheDocument();
      });

      const incidentsTab = screen.getByTestId('tab-incidents');
      fireEvent.click(incidentsTab);

      // Wait for the incidents tab to load and show the loader
      await waitFor(() => {
        expect(screen.getByTestId('loader')).toBeInTheDocument();
      });
    });
  });
});
