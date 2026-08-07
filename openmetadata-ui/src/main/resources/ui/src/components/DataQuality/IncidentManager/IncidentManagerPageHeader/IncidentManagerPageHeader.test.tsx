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

import { fireEvent, render, screen } from '@testing-library/react';
import React, { act } from 'react';
import * as reactRouterDom from 'react-router-dom';
import {
  TestCaseStatus,
  type TestCase,
  type TestCaseResult,
} from '../../../../generated/tests/testCase';
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
  updateTestCaseIncidentById,
} from '../../../../rest/incidentManagerAPI';
import IncidentManagerPageHeaderView from './IncidentManagerPageHeader.component';
import { IncidentManagerPageHeaderProps } from './IncidentManagerPageHeader.interface';
import TestCaseLastRunBanner from './TestCaseLastRunBanner.component';
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

const mockOnOwnerUpdate = jest.fn();
const mockFetchTaskCount = jest.fn();
const mockNavigate = jest.fn();
const LAST_RUN_BANNER_TEST_ID = 'test-case-last-run-banner';
const LAST_RUN_INCIDENT_TEST_ID = 'test-case-last-run-incident';
const OWNER_COMPONENT_TEST_ID = 'owner-component';
const RESULT_EXPECTED_TEST_ID = 'test-case-result-expected';
const SEVERITY_COMPONENT_TEXT = 'Severity.component';
const STATUS_COMPONENT_TEXT = 'TestCaseIncidentManagerStatus.component';

type IncidentManagerPageHeaderHarnessProps = Omit<
  IncidentManagerPageHeaderProps,
  'incidentHeaderData'
> & {
  fetchTaskCount: () => void;
  testCaseData?: TestCase;
};

const mockProps: IncidentManagerPageHeaderHarnessProps = {
  onOwnerUpdate: mockOnOwnerUpdate,
  fetchTaskCount: mockFetchTaskCount,
};

const IncidentManagerPageHeader = ({
  fetchTaskCount,
  isVersionPage = false,
  onOwnerUpdate,
}: IncidentManagerPageHeaderHarnessProps) => {
  const incidentHeaderData = useTestCaseIncidentHeader({
    fetchTaskCount,
    isVersionPage,
  });

  return (
    <>
      <IncidentManagerPageHeaderView
        incidentHeaderData={incidentHeaderData}
        isVersionPage={isVersionPage}
        onOwnerUpdate={onOwnerUpdate}
      />
      {!isVersionPage && !incidentHeaderData.dimensionKey && (
        <TestCaseLastRunBanner
          incidentTask={incidentHeaderData.incidentTask}
          parameterValues={incidentHeaderData.testCaseData?.parameterValues}
          taskLinkInfo={incidentHeaderData.taskLinkInfo}
          testCaseResult={incidentHeaderData.testCaseData?.testCaseResult}
          testCaseStatus={incidentHeaderData.testCaseData?.testCaseStatus}
          testCaseStatusData={incidentHeaderData.testCaseStatusData}
        />
      )}
    </>
  );
};

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  getIncidentTaskByStateId: jest.fn().mockResolvedValue({
    ...MOCK_TASK_DATA[1],
    description: 'New incident for test case: generic description',
    payload: {
      testCaseResolutionStatusId: '65f7a1d2-ee28-4b43-b504-4be90c689f4d',
    },
  }),
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
  useNavigate: jest.fn(),
}));

jest.mock('.../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermission: jest
      .fn()
      .mockImplementation(() => mockEntityPermissions),
  })),
}));

jest.mock('../../../../utils/FqnUtils', () => ({
  ...jest.requireActual('../../../../utils/FqnUtils'),
  getNameFromFQN: jest.fn().mockReturnValue('getNameFromFQN'),
}));

jest.mock('../../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('getEntityName'),
}));
jest.mock('../../../../utils/EntityPureUtils', () => ({
  getColumnNameFromEntityLink: jest
    .fn()
    .mockReturnValue('getColumnNameFromEntityLink'),
}));

jest.mock('../../../../utils/FeedUtilsPure', () => ({
  getEntityFQN: jest.fn().mockReturnValue('entityFQN'),
}));

jest.mock('../../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../../utils/TaskNavigationUtils', () => ({
  getTaskDisplayId: jest.fn().mockReturnValue(9),
  getTaskDetailPath: jest.fn().mockReturnValue('/'),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest
    .fn()
    .mockImplementation(({ children, onUpdate, placeHolder, ...rest }) => (
      <button
        {...rest}
        data-testid={OWNER_COMPONENT_TEST_ID}
        type="button"
        onClick={onUpdate}>
        <span data-testid="placeholder">{placeHolder}</span>
        {children}
      </button>
    )),
}));

jest.mock('../Severity/Severity.component', () => {
  return jest.fn().mockImplementation(({ headerName, onSubmit }) => (
    <div>
      <div data-testid="severity-header">{headerName}</div>
      <div>{SEVERITY_COMPONENT_TEXT}</div>
      <button
        aria-label={SEVERITY_COMPONENT_TEXT}
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
      <div>{STATUS_COMPONENT_TEXT}</div>
      <button
        aria-label={STATUS_COMPONENT_TEXT}
        data-testid="test-case-incident-manager-status"
        onClick={() => onSubmit(MOCK_TEST_CASE_RESOLUTION_STATUS[1])}
      />
    </div>
  ));
});

const mockUseTestCaseStore: { testCase: TestCase } = {
  testCase: { ...MOCK_TEST_CASE_DATA, incidentId: '123' } as TestCase,
};
jest.mock(
  '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store',
  () => ({
    useTestCaseStore: jest.fn().mockImplementation(() => mockUseTestCaseStore),
  })
);

jest.mock(
  '../../../../context/RuleEnforcementProvider/RuleEnforcementProvider',
  () => ({
    useRuleEnforcementProvider: jest.fn().mockImplementation(() => ({
      fetchRulesForEntity: jest.fn(),
      getRulesForEntity: jest.fn(),
      getEntityRuleValidation: jest.fn(),
    })),
  })
);

jest.mock('../../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockImplementation(() => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
    },
  })),
}));

describe('Incident Manager Page Header component', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    jest.mocked(reactRouterDom.useNavigate).mockReturnValue(mockNavigate);
    mockUseTestCaseStore.testCase = {
      ...MOCK_TEST_CASE_DATA,
      incidentId: '123',
    } as TestCase;
  });

  it('getIncidentTaskByStateId should be call on mount', async () => {
    render(<IncidentManagerPageHeader {...mockProps} />);

    expect(getIncidentTaskByStateId).toHaveBeenCalledWith('123');
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

    fireEvent.click(screen.getByTestId(OWNER_COMPONENT_TEST_ID));

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

    expect(screen.getByTestId(OWNER_COMPONENT_TEST_ID)).toBeInTheDocument();
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

    expect(screen.getAllByTestId(OWNER_COMPONENT_TEST_ID)).toHaveLength(2);
    // Incident
    expect(screen.getByText('label.incident')).toBeInTheDocument();
    expect(screen.getByText('#9')).toBeInTheDocument();
    // Incident
    expect(screen.getByText('label.incident-status')).toBeInTheDocument();
    expect(screen.getByText(STATUS_COMPONENT_TEXT)).toBeInTheDocument();
    // Assignee
    expect(screen.getByTestId('assignee')).toBeInTheDocument();
    // Severity
    expect(screen.getByText('label.severity')).toBeInTheDocument();
    expect(screen.getByText(SEVERITY_COMPONENT_TEXT)).toBeInTheDocument();
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

  it('should handle FQN from URL params without double decoding', async () => {
    const mockUseParamsWithSpecialChars = jest.fn().mockReturnValue({
      fqn: 'database.schema.table%test',
    });

    jest
      .spyOn(reactRouterDom, 'useParams')
      .mockImplementation(mockUseParamsWithSpecialChars);

    render(<IncidentManagerPageHeader {...mockProps} />);

    expect(getIncidentTaskByStateId).toHaveBeenCalledWith('123');
  });

  it.each<[TestCaseStatus, string]>([
    [TestCaseStatus.Failed, 'Query execution failed'],
    [TestCaseStatus.Aborted, 'Connection timed out'],
    [TestCaseStatus.Success, 'All rows passed'],
  ])(
    'should show the latest %s run status and result',
    async (testCaseStatus, result) => {
      const testCaseResult: TestCaseResult = {
        testCaseStatus,
        result,
        testResultValue: [
          { name: 'rowCount', predictedValue: '1000', value: '5' },
        ],
        timestamp: 1_786_001_601_000,
      };
      mockUseTestCaseStore.testCase = {
        ...mockUseTestCaseStore.testCase,
        testCaseResult,
      };

      render(<IncidentManagerPageHeader {...mockProps} />);

      expect(await screen.findByText(result)).toBeInTheDocument();
      expect(screen.getAllByTestId(LAST_RUN_BANNER_TEST_ID)).toHaveLength(1);
      expect(screen.getByTestId(LAST_RUN_BANNER_TEST_ID)).toHaveClass(
        'tw:font-sans'
      );
      expect(screen.getByTestId(LAST_RUN_BANNER_TEST_ID)).toHaveTextContent(
        `label.last-run label.${testCaseStatus.toLowerCase()}`
      );
      expect(screen.getByTestId('test-case-last-run-status')).toHaveClass(
        {
          [TestCaseStatus.Aborted]: 'tw:text-warning-primary',
          [TestCaseStatus.Failed]: 'tw:text-error-primary',
          [TestCaseStatus.Queued]: 'tw:text-brand-primary',
          [TestCaseStatus.Success]: 'tw:text-success-primary',
        }[testCaseStatus]
      );
      expect(screen.getByTestId('test-case-last-run-prefix')).toHaveClass(
        'tw:text-primary',
        'tw:text-sm'
      );
      expect(screen.getByTestId('test-case-last-run-icon')).toHaveClass(
        'tw:size-8',
        'tw:rounded-lg'
      );
      expect(screen.getByTestId('test-case-last-run-summary')).toHaveClass(
        'tw:py-3.5',
        {
          [TestCaseStatus.Aborted]: 'tw:bg-yellow-50',
          [TestCaseStatus.Failed]: 'tw:bg-error-50',
          [TestCaseStatus.Queued]: 'tw:bg-brand-primary',
          [TestCaseStatus.Success]: 'tw:bg-success-primary',
        }[testCaseStatus]
      );
      expect(screen.getByText(result)).toHaveClass('tw:text-xs');
      expect(
        screen.getByTestId('test-case-run-description')
      ).toBeInTheDocument();
      expect(screen.getByTestId('test-case-last-run-time')).toBeInTheDocument();
      expect(screen.getByTestId('test-case-last-run-time')).toHaveClass(
        'tw:text-xs',
        'tw:font-normal'
      );
      expect(screen.getByTestId('test-case-next-run')).toHaveTextContent(
        'label.next · label.not-scheduled'
      );

      if (testCaseStatus === TestCaseStatus.Aborted) {
        expect(
          screen.queryByTestId(RESULT_EXPECTED_TEST_ID)
        ).not.toBeInTheDocument();
      } else {
        expect(screen.getByTestId(RESULT_EXPECTED_TEST_ID)).toHaveTextContent(
          'label.result / label.expected'
        );
        expect(screen.getByText('label.result / label.expected')).toHaveClass(
          'tw:text-secondary'
        );
        expect(screen.getByTestId('test-case-result-value')).toHaveTextContent(
          '5 / 1,000'
        );
        expect(screen.getByText('/ 1,000')).toHaveClass('tw:text-secondary');
      }

      if (
        testCaseStatus === TestCaseStatus.Failed ||
        testCaseStatus === TestCaseStatus.Aborted
      ) {
        const incidentRow = await screen.findByTestId(
          LAST_RUN_INCIDENT_TEST_ID
        );

        expect(incidentRow).toHaveClass(
          {
            [TestCaseStatus.Aborted]: 'tw:bg-yellow-50',
            [TestCaseStatus.Failed]: 'tw:bg-error-50',
          }[testCaseStatus]
        );
        expect(incidentRow).toHaveTextContent('INC–9');
        expect(incidentRow).toHaveTextContent(
          'message.request-test-case-failure-resolution-message getNameFromFQN (testCase)'
        );
        expect(incidentRow).not.toHaveTextContent(
          'New incident for test case: generic description'
        );
        expect(incidentRow).toHaveTextContent('label.acknowledged');
        expect(
          screen.getByTestId('test-case-incident-description')
        ).toBeInTheDocument();

        const viewIncidentButton = screen.getByTestId('view-incident-button');

        expect(viewIncidentButton).toHaveTextContent('label.view-entity');
        expect(viewIncidentButton).toHaveClass('tw:text-xs');
        expect(viewIncidentButton).not.toHaveAttribute('href');

        fireEvent.click(viewIncidentButton);

        expect(mockNavigate).toHaveBeenCalledWith(
          '/test-case/sample_data.ecommerce_db.shopify.dim_address.table_column_count_between/issues'
        );
      } else {
        expect(
          screen.queryByTestId(LAST_RUN_INCIDENT_TEST_ID)
        ).not.toBeInTheDocument();
      }
    }
  );

  it('should use the authoritative test case status when the embedded result is stale', async () => {
    mockUseTestCaseStore.testCase = {
      ...mockUseTestCaseStore.testCase,
      testCaseResult: {
        result: 'Query execution failed',
        testCaseStatus: TestCaseStatus.Failed,
        timestamp: 1_786_001_601_000,
      },
      testCaseStatus: TestCaseStatus.Aborted,
    };

    render(<IncidentManagerPageHeader {...mockProps} />);

    expect(
      await screen.findByTestId('test-case-last-run-status')
    ).toHaveTextContent('label.aborted');
    expect(screen.getByTestId('test-case-last-run-status')).toHaveClass(
      'tw:text-warning-primary'
    );
    expect(screen.getByTestId(LAST_RUN_BANNER_TEST_ID)).not.toHaveTextContent(
      'label.failed'
    );
  });

  it('should use the matching test parameter when the result omits its predicted value', async () => {
    mockUseTestCaseStore.testCase = {
      ...mockUseTestCaseStore.testCase,
      parameterValues: [
        { name: 'rowCount', value: '10000' },
        { name: 'columnName', value: 'customer_id' },
      ],
      testCaseResult: {
        result: 'Found 110 rows vs. the expected 10,000',
        testCaseStatus: TestCaseStatus.Failed,
        testResultValue: [{ name: 'rowCount', value: '110' }],
        timestamp: 1_786_001_601_000,
      },
    };

    render(<IncidentManagerPageHeader {...mockProps} />);

    expect(
      await screen.findByTestId(RESULT_EXPECTED_TEST_ID)
    ).toHaveTextContent('110 / 10,000');
  });

  it('should not pair a result with an unrelated test parameter', async () => {
    const result = 'Found 5 rows';

    mockUseTestCaseStore.testCase = {
      ...mockUseTestCaseStore.testCase,
      parameterValues: [{ name: 'columnName', value: 'customer_id' }],
      testCaseResult: {
        result,
        testCaseStatus: TestCaseStatus.Failed,
        testResultValue: [{ name: 'rowCount', value: '5' }],
        timestamp: 1_786_001_601_000,
      },
    };

    render(<IncidentManagerPageHeader {...mockProps} />);

    expect(await screen.findByText(result)).toBeInTheDocument();
    expect(
      screen.queryByTestId(RESULT_EXPECTED_TEST_ID)
    ).not.toBeInTheDocument();
  });

  it('should explain when the latest run is queued without a result', async () => {
    mockUseTestCaseStore.testCase = {
      ...mockUseTestCaseStore.testCase,
      testCaseResult: {
        testCaseStatus: TestCaseStatus.Queued,
        timestamp: 1_786_001_601_000,
      },
    };

    render(<IncidentManagerPageHeader {...mockProps} />);

    expect(
      await screen.findByText('message.test-case-run-queued')
    ).toBeInTheDocument();
    expect(screen.getAllByTestId(LAST_RUN_BANNER_TEST_ID)).toHaveLength(1);
    expect(screen.getByTestId(LAST_RUN_BANNER_TEST_ID)).toHaveTextContent(
      'label.last-run label.queued'
    );
    expect(
      screen.queryByTestId(RESULT_EXPECTED_TEST_ID)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(LAST_RUN_INCIDENT_TEST_ID)
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('test-case-next-run')).toHaveTextContent(
      'label.next · label.running-now'
    );
  });

  it('should show one not-run-yet banner when no latest result exists', async () => {
    mockUseTestCaseStore.testCase = {
      ...mockUseTestCaseStore.testCase,
      testCaseResult: undefined,
    };

    render(<IncidentManagerPageHeader {...mockProps} />);

    const banner = await screen.findByTestId(LAST_RUN_BANNER_TEST_ID);

    expect(screen.getAllByTestId(LAST_RUN_BANNER_TEST_ID)).toHaveLength(1);
    expect(banner).toHaveTextContent('label.last-run label.not-run-yet');
    expect(banner).toHaveTextContent('message.test-case-not-run-yet');
    expect(banner).toHaveTextContent('label.next · label.not-scheduled');
    expect(
      screen.queryByTestId(RESULT_EXPECTED_TEST_ID)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(LAST_RUN_INCIDENT_TEST_ID)
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('test-case-last-run-prefix')).toHaveClass(
      'tw:text-sm'
    );
    expect(screen.getByTestId('test-case-last-run-icon')).toHaveClass(
      'tw:size-8',
      'tw:rounded-lg'
    );
    expect(screen.getByTestId('test-case-last-run-summary')).toHaveClass(
      'tw:py-3.5'
    );
    expect(screen.getByText('message.test-case-not-run-yet')).toHaveClass(
      'tw:text-xs'
    );
  });

  it('should not show a negative duration when a cached next run has passed', () => {
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(2_000);

    render(<TestCaseLastRunBanner nextRunTimestamp={1_000} />);

    const nextRun = screen.getByTestId('test-case-next-run');

    expect(nextRun).toHaveTextContent('label.not-scheduled');
    expect(nextRun).not.toHaveTextContent('label.in-lowercase');

    dateNowSpy.mockRestore();
  });
});
