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
import {
  EntityReference,
  TestCase,
  TestCaseStatus,
} from '../../../../generated/tests/testCase';
import {
  Severities,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import { DataQualityTest } from '../../../common/DataQualitySection/DataQualitySection.interface';
import DataQualityTab from './DataQualityTab';
import { MockTabItem, TranslationOptions } from './DataQualityTab.interface';

const TEST_ENTITY_FQN = 'test.entity.fqn';
const TEST_CASE_1 = 'test-case-1';
const TEST_CASE_1_2 = 'Test Case 1';
const TEST_ENTITY_FQN_COLUMNS_COLUMN1 = 'test.entity.fqn::columns::column1';
const TEST_DEFINITION_1 = 'test-definition-1';
const TEST_SUITE_1 = 'test-suite-1';
const TEST_CASE_2 = 'Test Case 2';
const TEST_ENTITY_FQN_COLUMNS_COLUMN2 = 'test.entity.fqn::columns::column2';
const INCIDENT_1 = 'incident-1';
const TEST_CASE_3 = 'Test Case 3';
const DATA_QUALITY_SECTION = 'data-quality-section';
const TEST_FAILED = 'test-failed';
const TEST_ABORTED = 'test-aborted';
const TAB_INCIDENTS = 'tab-incidents';
const STAT_COUNT = 'stat-count';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: jest.fn().mockImplementation(({ children, to, ...props }) => (
    <a data-testid="router-link" href={to} {...props}>
      {children}
    </a>
  )),
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string, options?: TranslationOptions) => {
      if (options) {
        return `${key} - ${JSON.stringify(options)}`;
      }

      return key;
    },
  }),
}));

jest.mock(
  '../../../DataQuality/IncidentManager/Severity/Severity.component',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(({ severity }) => (
        <div data-testid="severity-badge">SEVERITY - {severity}</div>
      )),
  })
);

jest.mock('antd', () => {
  const actual = jest.requireActual('antd');

  return {
    ...actual,
    Card: jest.fn().mockImplementation(({ children, className, ...props }) => (
      <div className={className} data-testid="card" {...props}>
        {children}
      </div>
    )),
    Col: jest
      .fn()
      .mockImplementation(({ children, span, className, ...props }) => (
        <div
          className={className}
          data-span={span}
          data-testid="col"
          {...props}>
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
      .mockImplementation(({ items, activeKey, onChange, ...props }) => (
        <div data-active-key={activeKey} data-testid="tabs" {...props}>
          <div data-testid="tab-headers">
            {items.map((item: MockTabItem) => (
              <div data-testid={`tab-${item.key}`} key={item.key}>
                {item.label}
                <button onClick={() => onChange?.(item.key)}>change</button>
              </div>
            ))}
          </div>
          {items.find((item: MockTabItem) => item.key === activeKey)?.children}
        </div>
      )),
    Typography: {
      Text: jest
        .fn()
        .mockImplementation(({ children, className, ellipsis, ...props }) => (
          <span
            className={className}
            data-ellipsis={ellipsis}
            data-testid="typography-text"
            {...props}>
            {children}
          </span>
        )),
      Paragraph: jest
        .fn()
        .mockImplementation(({ children, className, ...props }) => (
          <p
            className={className}
            data-testid="typography-paragraph"
            {...props}>
            {children}
          </p>
        )),
    },
  };
});

// Mock child components
jest.mock('../../../common/DataQualitySection', () => {
  return jest
    .fn()
    .mockImplementation(({ tests, totalTests, onEdit, onFilterChange }) => (
      <div data-testid="data-quality-section">
        <div data-testid="total-tests">{totalTests}</div>
        {tests.map((test: DataQualityTest) => (
          <div
            data-testid={`test-${test.type}`}
            key={test.type}
            role="button"
            tabIndex={0}
            onClick={() => onFilterChange?.(test.type)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onFilterChange?.(test.type);
              }
            }}>
            {test.count}
          </div>
        ))}
        <button data-testid="edit-button" onClick={onEdit}>
          Edit
        </button>
      </div>
    ));
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

// Mock SearchBarComponent
jest.mock('../../../common/SearchBarComponent/SearchBar.component', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ onSearch, placeholder, searchValue }) => (
      <div data-testid="search-bar">
        <input
          aria-label={placeholder}
          data-testid="search-input"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
    )),
}));

// Mock API functions
// eslint-disable-next-line sonarjs/no-duplicate-string
jest.mock('../../../../rest/testAPI', () => ({
  getListTestCaseBySearch: jest.fn(),
}));

// eslint-disable-next-line sonarjs/no-duplicate-string
jest.mock('../../../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentStatus: jest.fn(),
}));

jest.mock('../../../../utils/i18next/LocalUtil', () => ({
  default: { t: jest.fn().mockReturnValue('') },
  t: jest.fn().mockReturnValue(''),
  translateWithNestedKeys: jest.fn().mockReturnValue(''),
  Transi18next: jest
    .fn()
    .mockImplementation(({ i18nKey }) => (
      <span data-testid="trans-i18next">{i18nKey}</span>
    )),
}));

jest.mock('../../../../utils/FqnUtils', () => ({
  getTableFQNFromColumnFQN: jest.fn().mockImplementation((fqn) => {
    // eslint-disable-next-line sonarjs/no-duplicate-string
    if (fqn?.includes('::columns::')) {
      return fqn.split('::columns::')[0];
    }

    return fqn;
  }),
}));

// Mock utility functions
jest.mock('../../../../utils/TableUtils', () => ({
  generateEntityLink: jest.fn().mockReturnValue('test-entity-link'),
}));

// eslint-disable-next-line sonarjs/no-duplicate-string
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  getCurrentMillis: jest.fn().mockReturnValue(1234567890),
  getEpochMillisForPastDays: jest.fn().mockReturnValue(1234567890),
  getStartOfDayInMillis: jest.fn().mockImplementation((val) => val),
  getEndOfDayInMillis: jest.fn().mockImplementation((val) => val),
}));

jest.mock('../../../../utils/EntityPureUtils', () => ({
  getColumnNameFromEntityLink: jest
    .fn()
    .mockImplementation((entityLink: string) => {
      if (entityLink.includes('::columns::')) {
        const parts = entityLink.split('::columns::');

        return parts.at(-1);
      }

      return null;
    }),
}));

jest.mock('../../../../utils/RouterUtils', () => ({
  getTestCaseDetailPagePath: jest.fn().mockReturnValue('/test-case-path'),
}));

jest.mock('../../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockImplementation(({ owners, placeHolder }) => {
    if (owners && owners.length > 0) {
      const owner = owners[0];

      return (
        <div data-testid="owner-label">
          <div data-testid="avatar">{owner.displayName?.charAt(0) || 'U'}</div>
          <span>{owner.displayName || owner.name || 'Unknown'}</span>
        </div>
      );
    }

    return <span data-testid="owner-placeholder">{placeHolder || '--'}</span>;
  }),
}));

const mockEntityFQN = TEST_ENTITY_FQN;

const mockTestCases: TestCase[] = [
  {
    id: TEST_CASE_1,
    name: TEST_CASE_1_2,
    fullyQualifiedName: TEST_ENTITY_FQN_COLUMNS_COLUMN1,
    entityLink: TEST_ENTITY_FQN_COLUMNS_COLUMN1,
    testCaseResult: {
      testCaseStatus: TestCaseStatus.Success,
      timestamp: 1234567890,
    },
    testDefinition: { id: TEST_DEFINITION_1 } as EntityReference,
    testSuite: { id: TEST_SUITE_1 } as EntityReference,
  },
  {
    id: 'test-case-2',
    name: TEST_CASE_2,
    fullyQualifiedName: TEST_ENTITY_FQN_COLUMNS_COLUMN2,
    entityLink: TEST_ENTITY_FQN_COLUMNS_COLUMN2,
    testCaseResult: {
      testCaseStatus: TestCaseStatus.Failed,
      timestamp: 1234567890,
    },
    incidentId: INCIDENT_1,
    testDefinition: { id: TEST_DEFINITION_1 } as EntityReference,
    testSuite: { id: TEST_SUITE_1 } as EntityReference,
  },
  {
    id: 'test-case-3',
    name: TEST_CASE_3,
    fullyQualifiedName: 'test.entity.fqn::columns::column3',
    entityLink: 'test.entity.fqn::columns::column3',
    testCaseResult: {
      testCaseStatus: TestCaseStatus.Aborted,
      timestamp: 1234567890,
    },
    testDefinition: { id: TEST_DEFINITION_1 } as EntityReference,
    testSuite: { id: TEST_SUITE_1 } as EntityReference,
  },
];

const mockIncidents: TestCaseResolutionStatus[] = [
  {
    id: INCIDENT_1,
    testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
    testCaseReference: {
      id: TEST_CASE_1,
      type: 'testCase',
      displayName: TEST_CASE_1_2,
      name: 'test_case_1',
      fullyQualifiedName: TEST_ENTITY_FQN_COLUMNS_COLUMN1,
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
      displayName: TEST_CASE_2,
      name: 'test_case_2',
      fullyQualifiedName: TEST_ENTITY_FQN_COLUMNS_COLUMN2,
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
};

describe('DataQualityTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should render loader when loading', async () => {
      const { getListTestCaseBySearch } = jest.requireMock(
        '../../../../rest/testAPI'
      );
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      // Mock delayed API responses
      getListTestCaseBySearch.mockImplementation(
        () => new Promise(() => undefined)
      );
      getListTestCaseIncidentStatus.mockImplementation(
        () => new Promise(() => undefined)
      );

      render(<DataQualityTab {...defaultProps} />);

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('should render with correct CSS classes when loading', async () => {
      const { getListTestCaseBySearch } = jest.requireMock(
        '../../../../rest/testAPI'
      );
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      getListTestCaseBySearch.mockImplementation(
        () => new Promise(() => undefined)
      );
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
      const { getListTestCaseBySearch } = jest.requireMock(
        '../../../../rest/testAPI'
      );
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      getListTestCaseBySearch.mockResolvedValue({ data: [] });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: [] });

      render(<DataQualityTab {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText('message.no-data-quality-test-message')
        ).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(getListTestCaseBySearch).toHaveBeenCalled();
        expect(getListTestCaseIncidentStatus).toHaveBeenCalled();
      });
    });
  });

  describe('Test Cases Rendering', () => {
    beforeEach(async () => {
      const { getListTestCaseBySearch } = jest.requireMock(
        '../../../../rest/testAPI'
      );
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      getListTestCaseBySearch.mockResolvedValue({ data: mockTestCases });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: mockIncidents });

      render(<DataQualityTab {...defaultProps} />);
    });

    it('should render data quality section with correct test counts', async () => {
      await waitFor(() => {
        expect(screen.getByTestId(DATA_QUALITY_SECTION)).toBeInTheDocument();
      });

      expect(screen.getByTestId('total-tests')).toHaveTextContent('3');
      expect(screen.getByTestId('test-success')).toHaveTextContent('1');
      expect(screen.getByTestId(TEST_FAILED)).toHaveTextContent('1');
      expect(screen.getByTestId(TEST_ABORTED)).toHaveTextContent('1');
    });

    it('should render test case cards', async () => {
      await waitFor(() => {
        expect(screen.getByTestId(DATA_QUALITY_SECTION)).toBeInTheDocument();
      });

      // By default, only success test cases are shown
      expect(screen.getByText(TEST_CASE_1_2)).toBeInTheDocument();

      // Click on failed filter to see failed test cases
      const failedButton = screen.getByTestId(TEST_FAILED);
      fireEvent.click(failedButton);

      expect(screen.getByText(TEST_CASE_2)).toBeInTheDocument();

      // Click on aborted filter to see aborted test cases
      const abortedButton = screen.getByTestId(TEST_ABORTED);
      fireEvent.click(abortedButton);

      expect(screen.getByText(TEST_CASE_3)).toBeInTheDocument();
    });

    it('should render test case status badges', async () => {
      await waitFor(() => {
        expect(screen.getByTestId(DATA_QUALITY_SECTION)).toBeInTheDocument();
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
      const failedButton = screen.getByTestId(TEST_FAILED);
      fireEvent.click(failedButton);

      // Wait for the filter to apply
      await waitFor(() => {
        const allStatusBadges = screen.getAllByTestId('status-badge');
        const failedStatusBadges = allStatusBadges.filter((badge) => {
          const card = badge.closest('.test-case-card');

          return card !== null;
        });

        expect(failedStatusBadges).toHaveLength(2); // Failed test case with incidentId has 2 badges (Failed + Assigned)
      });
    });

    it('should render column names for test cases', async () => {
      await waitFor(() => {
        expect(screen.getByTestId(DATA_QUALITY_SECTION)).toBeInTheDocument();
      });

      // By default, only success test cases are shown
      expect(screen.getByText('column1')).toBeInTheDocument();

      // Click on failed filter to see failed test cases
      const failedButton = screen.getByTestId(TEST_FAILED);
      fireEvent.click(failedButton);

      expect(screen.getByText('column2')).toBeInTheDocument();

      // Click on aborted filter to see aborted test cases
      const abortedButton = screen.getByTestId(TEST_ABORTED);
      fireEvent.click(abortedButton);

      expect(screen.getByText('column3')).toBeInTheDocument();
    });

    it('should render incident status for test cases with incidents', async () => {
      await waitFor(() => {
        expect(screen.getByTestId(DATA_QUALITY_SECTION)).toBeInTheDocument();
      });

      // Click on failed filter to see failed test cases (which have incidents)
      const failedButton = screen.getByTestId(TEST_FAILED);
      fireEvent.click(failedButton);

      expect(screen.getByText('Assigned')).toBeInTheDocument();
    });
  });

  describe('Filter Functionality', () => {
    beforeEach(async () => {
      const { getListTestCaseBySearch } = jest.requireMock(
        '../../../../rest/testAPI'
      );
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      getListTestCaseBySearch.mockResolvedValue({ data: mockTestCases });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: mockIncidents });

      render(<DataQualityTab {...defaultProps} />);
    });

    it('should filter test cases by success status', async () => {
      await waitFor(() => {
        expect(screen.getByTestId(DATA_QUALITY_SECTION)).toBeInTheDocument();
      });

      // Default filter is 'success', so only success test cases are visible initially
      expect(screen.getByText(TEST_CASE_1_2)).toBeInTheDocument();
      expect(screen.queryByText(TEST_CASE_2)).not.toBeInTheDocument();
      expect(screen.queryByText(TEST_CASE_3)).not.toBeInTheDocument();

      // Click on success filter to see only success test cases
      const successButton = screen.getByTestId('test-success');
      fireEvent.click(successButton);

      // Wait for the filter to apply and then check results
      await waitFor(() => {
        expect(screen.getByText(TEST_CASE_1_2)).toBeInTheDocument();
        expect(screen.queryByText(TEST_CASE_2)).not.toBeInTheDocument();
        expect(screen.queryByText(TEST_CASE_3)).not.toBeInTheDocument();
      });
    });

    it('should filter test cases by failed status', async () => {
      await waitFor(() => {
        expect(screen.getByTestId(DATA_QUALITY_SECTION)).toBeInTheDocument();
      });

      const failedButton = screen.getByTestId(TEST_FAILED);
      fireEvent.click(failedButton);

      expect(screen.queryByText(TEST_CASE_1_2)).not.toBeInTheDocument();
      expect(screen.getByText(TEST_CASE_2)).toBeInTheDocument();
      expect(screen.queryByText(TEST_CASE_3)).not.toBeInTheDocument();
    });

    it('should filter test cases by aborted status', async () => {
      await waitFor(() => {
        expect(screen.getByTestId(DATA_QUALITY_SECTION)).toBeInTheDocument();
      });

      const abortedButton = screen.getByTestId(TEST_ABORTED);
      fireEvent.click(abortedButton);

      expect(screen.queryByText(TEST_CASE_1_2)).not.toBeInTheDocument();
      expect(screen.queryByText(TEST_CASE_2)).not.toBeInTheDocument();
      expect(screen.getByText(TEST_CASE_3)).toBeInTheDocument();
    });

    it('should show no test cases message when filter has no results', async () => {
      // Clear all mocks to avoid interference from beforeEach
      jest.clearAllMocks();

      // Create test cases with only success status
      const successOnlyTestCases = [
        {
          id: TEST_CASE_1,
          name: TEST_CASE_1_2,
          fullyQualifiedName: TEST_ENTITY_FQN_COLUMNS_COLUMN1,
          entityLink: TEST_ENTITY_FQN_COLUMNS_COLUMN1,
          testCaseResult: {
            testCaseStatus: TestCaseStatus.Success,
            timestamp: 1234567890,
          },
          testDefinition: { id: TEST_DEFINITION_1 } as EntityReference,
          testSuite: { id: TEST_SUITE_1 } as EntityReference,
        },
      ];

      const { getListTestCaseBySearch } = jest.requireMock(
        '../../../../rest/testAPI'
      );
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      getListTestCaseBySearch.mockResolvedValue({ data: successOnlyTestCases });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: [] });

      render(<DataQualityTab {...defaultProps} />);

      // Wait for component to load first
      await waitFor(() => {
        expect(
          screen.getAllByTestId(DATA_QUALITY_SECTION)[0]
        ).toBeInTheDocument();
      });

      // Click on failed filter - should show no results message
      const failedButtons = screen.getAllByTestId(TEST_FAILED);
      const failedButtonWithZeroCount = failedButtons.find(
        (button) => button.textContent === '0'
      );
      fireEvent.click(failedButtonWithZeroCount as HTMLElement);

      // Wait for the component to re-render with the filtered results
      await waitFor(() => {
        expect(screen.getByText(/label.no-entity/)).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    beforeEach(async () => {
      const { getListTestCaseBySearch } = jest.requireMock(
        '../../../../rest/testAPI'
      );
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      getListTestCaseBySearch.mockResolvedValue({ data: mockTestCases });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: mockIncidents });

      render(<DataQualityTab {...defaultProps} />);
    });

    it('should render both data quality and incidents tabs', async () => {
      await waitFor(() => {
        expect(screen.getByTestId(DATA_QUALITY_SECTION)).toBeInTheDocument();
      });

      expect(screen.getByTestId('tab-data-quality')).toBeInTheDocument();
      expect(screen.getByTestId(TAB_INCIDENTS)).toBeInTheDocument();
    });

    it('should switch to incidents tab', async () => {
      await waitFor(() => {
        expect(screen.getByTestId(DATA_QUALITY_SECTION)).toBeInTheDocument();
      });

      const incidentsTab = screen
        .getByTestId(TAB_INCIDENTS)
        .querySelector('button') as HTMLElement;
      fireEvent.click(incidentsTab);

      expect(
        screen.getByText('label.new', { selector: '.stat-label.new' })
      ).toBeInTheDocument();
    });

    it('should switch back to data quality tab', async () => {
      await waitFor(() => {
        expect(screen.getByTestId(DATA_QUALITY_SECTION)).toBeInTheDocument();
      });

      const incidentsTab = screen
        .getByTestId(TAB_INCIDENTS)
        .querySelector('button') as HTMLElement;
      fireEvent.click(incidentsTab);

      const dataQualityTab = screen
        .getByTestId('tab-data-quality')
        .querySelector('button') as HTMLElement;
      fireEvent.click(dataQualityTab);

      expect(screen.getByTestId(DATA_QUALITY_SECTION)).toBeInTheDocument();
    });
  });

  describe('Incidents Tab', () => {
    beforeEach(async () => {
      const { getListTestCaseBySearch } = jest.requireMock(
        '../../../../rest/testAPI'
      );
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      getListTestCaseBySearch.mockResolvedValue({ data: mockTestCases });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: mockIncidents });

      render(<DataQualityTab {...defaultProps} />);

      // Wait for component to load and then switch to incidents tab
      await waitFor(() => {
        screen.getByTestId(DATA_QUALITY_SECTION);
      });

      const incidentsTab = screen
        .getByTestId(TAB_INCIDENTS)
        .querySelector('button') as HTMLElement;
      fireEvent.click(incidentsTab);
    });

    it('should render incidents summary section', () => {
      expect(screen.getByText('label.new')).toBeInTheDocument();
      expect(screen.getByText('label.acknowledged')).toBeInTheDocument();
      expect(screen.getByText('label.assigned')).toBeInTheDocument();
    });

    it('should render incident status counts', () => {
      // Check for new count (should be 1 based on mock data)
      const newCount = screen.getByText((content, element) => {
        const className = element?.getAttribute('class') || '';

        return (
          content === '1' &&
          className.includes(STAT_COUNT) &&
          className.includes('new')
        );
      });

      expect(newCount).toBeInTheDocument();

      // Check for assigned count (should be 1 based on mock data)
      const assignedCount = screen.getByText((content, element) => {
        const className = element?.getAttribute('class') || '';

        return (
          content === '1' &&
          className.includes(STAT_COUNT) &&
          className.includes('assigned')
        );
      });

      expect(assignedCount).toBeInTheDocument();

      // Check for acknowledged count (should be 0 based on mock data)
      const ackCount = screen.getByText((content, element) => {
        const className = element?.getAttribute('class') || '';

        return (
          content === '0' &&
          className.includes(STAT_COUNT) &&
          className.includes('ack')
        );
      });

      expect(ackCount).toBeInTheDocument();

      // Check for resolved count (should be 0 based on mock data)
      const resolvedCount = screen.getByText((content, element) => {
        const className = element?.getAttribute('class') || '';

        return content === '0' && className.includes('resolved-value');
      });

      expect(resolvedCount).toBeInTheDocument();
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

      expect(screen.getByText(TEST_CASE_1_2)).toBeInTheDocument();
    });

    it('should filter incidents by assigned status', () => {
      const assignedButton = screen.getByRole('button', {
        name: /label.assigned/,
      });
      fireEvent.click(assignedButton);

      expect(screen.getByText(TEST_CASE_2)).toBeInTheDocument();
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
      const { getListTestCaseBySearch } = jest.requireMock(
        '../../../../rest/testAPI'
      );
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );
      const { showErrorToast } = jest.requireMock(
        '../../../../utils/ToastUtils'
      );

      getListTestCaseBySearch.mockRejectedValue(new Error('API Error'));
      getListTestCaseIncidentStatus.mockResolvedValue({ data: [] });

      render(<DataQualityTab {...defaultProps} />);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalled();
        expect(
          screen.getAllByTestId('no-data-placeholder').length
        ).toBeGreaterThan(0);
      });
    });

    it('should handle incidents API error', async () => {
      const { getListTestCaseBySearch } = jest.requireMock(
        '../../../../rest/testAPI'
      );
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );
      const { showErrorToast } = jest.requireMock(
        '../../../../utils/ToastUtils'
      );

      getListTestCaseBySearch.mockResolvedValue({ data: mockTestCases });
      getListTestCaseIncidentStatus.mockRejectedValue(new Error('API Error'));

      render(<DataQualityTab {...defaultProps} />);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing entityFQN', async () => {
      const { getListTestCaseBySearch } = jest.requireMock(
        '../../../../rest/testAPI'
      );
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      render(<DataQualityTab entityFQN="" />);

      await waitFor(() => {
        expect(getListTestCaseBySearch).not.toHaveBeenCalled();
        expect(getListTestCaseIncidentStatus).not.toHaveBeenCalled();
      });
    });

    it('should handle test cases with missing data', async () => {
      const incompleteTestCases = [
        {
          id: TEST_CASE_1,
          name: TEST_CASE_1_2,
          fullyQualifiedName: TEST_ENTITY_FQN,
          entityLink: TEST_ENTITY_FQN,
          testCaseResult: {
            testCaseStatus: TestCaseStatus.Success,
            timestamp: 1234567890,
          },
          testDefinition: { id: TEST_DEFINITION_1 } as EntityReference,
          testSuite: { id: TEST_SUITE_1 } as EntityReference,
        },
      ];

      const { getListTestCaseBySearch } = jest.requireMock(
        '../../../../rest/testAPI'
      );
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      getListTestCaseBySearch.mockResolvedValue({ data: incompleteTestCases });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: [] });

      render(<DataQualityTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(TEST_CASE_1_2)).toBeInTheDocument();
      });
    });

    it('should handle incidents with missing assignee', async () => {
      const incidentsWithoutAssignee = [
        {
          id: INCIDENT_1,
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
          testCaseReference: {
            id: TEST_CASE_1,
            type: 'testCase',
            displayName: TEST_CASE_1_2,
            name: 'test_case_1',
            fullyQualifiedName: TEST_ENTITY_FQN_COLUMNS_COLUMN1,
          },
          severity: Severities.Severity1,
          timestamp: 1234567890,
        },
      ];

      const { getListTestCaseBySearch } = jest.requireMock(
        '../../../../rest/testAPI'
      );
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      // Provide at least one test case so tabs are rendered
      getListTestCaseBySearch.mockResolvedValue({ data: [mockTestCases[0]] });
      getListTestCaseIncidentStatus.mockResolvedValue({
        data: incidentsWithoutAssignee,
      });

      render(<DataQualityTab {...defaultProps} />);

      await waitFor(() => {
        const incidentsTab = screen
          .getByTestId(TAB_INCIDENTS)
          .querySelector('button') as HTMLElement;
        fireEvent.click(incidentsTab);

        const assignedButton = screen.getByRole('button', {
          name: /label.assigned/,
        });
        fireEvent.click(assignedButton);

        expect(
          screen.getByText('label.no-entity - {"entity":"label.assignee"}')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show incidents loading state', async () => {
      const { getListTestCaseBySearch } = jest.requireMock(
        '../../../../rest/testAPI'
      );
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      getListTestCaseBySearch.mockResolvedValue({ data: mockTestCases });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: mockIncidents });

      render(<DataQualityTab {...defaultProps} />);

      // Wait for component to load first
      await waitFor(() => {
        expect(screen.getByTestId(DATA_QUALITY_SECTION)).toBeInTheDocument();
      });

      const incidentsTab = screen
        .getByTestId(TAB_INCIDENTS)
        .querySelector('button') as HTMLElement;
      fireEvent.click(incidentsTab);

      // Verify incidents tab content is displayed
      await waitFor(() => {
        expect(screen.getByText('label.new')).toBeInTheDocument();
      });
    });
  });

  describe('Permissions', () => {
    it('should render permission placeholder when hasViewTests is false', async () => {
      const { getListTestCaseBySearch } = jest.requireMock(
        '../../../../rest/testAPI'
      );
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      render(<DataQualityTab {...defaultProps} hasViewTests={false} />);

      await waitFor(() => {
        expect(
          screen.getByText('message.no-access-placeholder')
        ).toBeInTheDocument();
      });

      // API calls should NOT be made when permission is denied
      expect(getListTestCaseBySearch).not.toHaveBeenCalled();
      expect(getListTestCaseIncidentStatus).not.toHaveBeenCalled();
    });

    it('should fetch data when hasViewTests is true', async () => {
      const { getListTestCaseBySearch } = jest.requireMock(
        '../../../../rest/testAPI'
      );
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      getListTestCaseBySearch.mockResolvedValue({ data: [] });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: [] });

      render(<DataQualityTab {...defaultProps} hasViewTests />);

      await waitFor(() => {
        expect(getListTestCaseBySearch).toHaveBeenCalled();
        expect(getListTestCaseIncidentStatus).toHaveBeenCalled();
      });
    });

    it('should default to hasViewTests=true for backward compatibility', async () => {
      const { getListTestCaseBySearch } = jest.requireMock(
        '../../../../rest/testAPI'
      );
      const { getListTestCaseIncidentStatus } = jest.requireMock(
        '../../../../rest/incidentManagerAPI'
      );

      getListTestCaseBySearch.mockResolvedValue({ data: [] });
      getListTestCaseIncidentStatus.mockResolvedValue({ data: [] });

      // render without hasViewTests prop
      render(<DataQualityTab {...defaultProps} />);

      await waitFor(() => {
        expect(getListTestCaseBySearch).toHaveBeenCalled();
        expect(getListTestCaseIncidentStatus).toHaveBeenCalled();
      });
    });
  });
});
