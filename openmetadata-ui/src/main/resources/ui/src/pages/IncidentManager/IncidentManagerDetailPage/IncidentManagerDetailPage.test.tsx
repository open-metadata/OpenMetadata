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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter, useParams } from 'react-router-dom';
import { useTestCaseIncidentHeader } from '../../../components/DataQuality/IncidentManager/IncidentManagerPageHeader/useTestCaseIncidentHeader';
import { TestCase } from '../../../generated/tests/testCase';
import { MOCK_PERMISSIONS } from '../../../mocks/Glossary.mock';
import { getIngestionPipelines } from '../../../rest/ingestionPipelineAPI';
import { getTestCaseByFqn } from '../../../rest/testAPI';
import { getNextCronRunTimestamp } from '../../../utils/CronUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { TestCasePageTabs } from '../IncidentManager.interface';
import IncidentManagerDetailPage from './IncidentManagerDetailPage';
import { UseTestCaseStoreInterface } from './useTestCase.store';

const TEST_CASE_FQN =
  'sample_data.ecommerce_db.shopify.dim_address.table_column_count_equals';
const TEST_SUITE_FQN = 'sample_data.ecommerce_db.shopify.dim_address.testSuite';
const ERROR_PLACEHOLDER_TEST_ID = 'error-placeholder';
const HEADER_BREADCRUMB_TEST_ID = 'header-breadcrumb';
const INCIDENT_MANAGER_HEADER_TEST_ID = 'incident-manager-page-header';
const LAST_RUN_SUCCESS_BANNER_TEST_ID = 'test-case-last-run-banner-success';

const mockTestCaseData = {
  id: '1b748634-d24b-4879-9791-289f2f90fc3c',
  name: 'table_column_count_equals',
  fullyQualifiedName: TEST_CASE_FQN,
  description: 'test the number of column in table',
  testDefinition: {
    id: '48063740-ac35-4854-9ab3-b1b542c820fe',
    type: 'testDefinition',
    name: 'tableColumnCountToEqual',
    fullyQualifiedName: 'tableColumnCountToEqual',
    description:
      'This test defines the test TableColumnCountToEqual. Test the number of columns equal to a value.',
    displayName: 'Table Column Count To Equal',
    deleted: false,
    href: 'http://localhost:8585/api/v1/dataQuality/testDefinitions/48063740-ac35-4854-9ab3-b1b542c820fe',
  },
  entityLink: '<#E::table::sample_data.ecommerce_db.shopify.dim_address>',
  entityFQN: 'sample_data.ecommerce_db.shopify.dim_address',
  testSuite: {
    id: 'fe44ef1a-1b83-4872-bef6-fbd1885986b8',
    type: 'testSuite',
    name: TEST_SUITE_FQN,
    fullyQualifiedName: TEST_SUITE_FQN,
    description: 'This is an basic test suite linked to an entity',
    deleted: false,
    href: 'http://localhost:8585/api/v1/dataQuality/testSuites/fe44ef1a-1b83-4872-bef6-fbd1885986b8',
  },
  parameterValues: [
    {
      name: 'columnCount',
      value: '10',
    },
  ],
  testCaseResult: {
    timestamp: 1703570591595,
    testCaseStatus: 'Success',
    result: 'Found 10 columns vs. the expected 10',
    testResultValue: [
      {
        name: 'columnCount',
        value: '10',
      },
    ],
  },
  version: 0.1,
  updatedAt: 1703570589915,
  updatedBy: 'admin',
} as TestCase;
const mockUseTestCase: UseTestCaseStoreInterface = {
  testCase: mockTestCaseData,
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
  getTestCaseByFqn: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockTestCaseData })),
  updateTestCaseById: jest.fn(),
  TestCaseType: {
    all: 'all',
    table: 'table',
    column: 'column',
  },
}));

jest.mock('../../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelines: jest.fn().mockResolvedValue({
    data: [
      {
        airflowConfig: {
          pausePipeline: false,
          pipelineTimezone: 'UTC',
          scheduleInterval: '10 * * * *',
        },
        enabled: true,
      },
    ],
    paging: { total: 1 },
  }),
}));

const mockLocation = {
  state: { breadcrumbData: [] as { name: string; url: string }[] },
};

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => mockLocation);
});

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));
jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () =>
  jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="page-layout-v1">{children}</div>
    ))
);
jest.mock('../../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <div data-testid="loader" />),
  PageLoader: jest.fn().mockImplementation(() => <div data-testid="loader" />),
}));
jest.mock(
  '../../../components/DataQuality/IncidentManager/IncidentManagerPageHeader/IncidentManagerPageHeader.component',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(() => (
        <div data-testid={INCIDENT_MANAGER_HEADER_TEST_ID} />
      )),
    IncidentManagerPageHeaderView: jest
      .fn()
      .mockImplementation(() => (
        <div data-testid={INCIDENT_MANAGER_HEADER_TEST_ID} />
      )),
  })
);
jest.mock(
  '../../../components/DataQuality/IncidentManager/IncidentManagerPageHeader/useTestCaseIncidentHeader',
  () => ({
    useTestCaseIncidentHeader: jest.fn(),
  })
);
jest.mock(
  '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () =>
    jest
      .fn()
      .mockImplementation(({ type }) => (
        <div data-testid={ERROR_PLACEHOLDER_TEST_ID} data-type={type} />
      ))
);
jest.mock(
  '../../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component',
  () =>
    jest
      .fn()
      .mockImplementation(
        ({ items }: { items: { href?: string; label: string }[] }) => (
          <nav data-testid={HEADER_BREADCRUMB_TEST_ID}>
            {items.map((item) => (
              <a href={item.href} key={`${item.href}-${item.label}`}>
                {item.label}
              </a>
            ))}
          </nav>
        )
      )
);
jest.mock(
  '../../../components/DataQuality/IncidentManager/TestCaseResultTab/TestCaseResultTab.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => <div data-testid="test-case-result-tab" />)
);
jest.mock(
  '../../../components/DataQuality/IncidentManager/TestCaseIncidentTab/TestCaseIncidentTab.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => <div data-testid="test-case-incident-tab" />)
);
jest.mock(
  '../../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);
jest.mock('@openmetadata/ui-core-components', () => {
  const actual = jest.requireActual('@openmetadata/ui-core-components');

  return {
    ...actual,
    Owner: jest
      .fn()
      .mockImplementation(() => <div data-testid="owner-label" />),
  };
});
jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  convertMillisecondsToHumanReadableFormat: jest.fn().mockReturnValue('23m'),
  customFormatDateTime: jest.fn().mockReturnValue('Jan 01, 2024'),
  formatDateTime: jest.fn().mockReturnValue('Jan 01, 2024'),
  getCurrentMillis: jest.fn().mockReturnValue(1711583974000),
  getEpochMillisForPastDays: jest.fn().mockReturnValue(1709424034000),
  getStartOfDayInMillis: jest.fn().mockImplementation((val) => val),
  getEndOfDayInMillis: jest.fn().mockImplementation((val) => val),
}));
jest.mock('../../../utils/CronUtils', () => ({
  getNextCronRunTimestamp: jest.fn().mockResolvedValue(1_786_002_200_000),
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

describe('IncidentManagerDetailPage', () => {
  beforeEach(() => {
    mockLocation.state = { breadcrumbData: [] };
    mockUseTestCase.testCase = mockTestCaseData;
    jest.mocked(useParams).mockReturnValue({
      fqn: TEST_CASE_FQN,
      tab: TestCasePageTabs.TEST_CASE_RESULTS,
    });
    jest.mocked(useTestCaseIncidentHeader).mockReturnValue({
      testCaseData: mockTestCaseData,
      incidentTask: null,
      testCaseStatusData: undefined,
      isLoading: false,
      taskLinkInfo: null,
      ownerDisplayName: undefined,
      ownerRef: undefined,
      columnName: null,
      tableFqn: 'sample_data.ecommerce_db.shopify.dim_address',
      dimensionKey: undefined,
      hasEditStatusPermission: true,
      hasEditOwnerPermission: true,
      hasEditDomainPermission: true,
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
      handleSeverityUpdate: jest.fn(),
      handleAssigneeUpdate: jest.fn(),
      handleDomainUpdate: jest.fn(),
      onIncidentStatusUpdate: jest.fn(),
    });
  });

  it('should render component', async () => {
    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: Wrapper });
    });

    expect(
      await screen.findByTestId('incident-manager-details-page-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('tabs')).toBeInTheDocument();
    expect(
      await screen.findByTestId(HEADER_BREADCRUMB_TEST_ID)
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('entity-header-title')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId(INCIDENT_MANAGER_HEADER_TEST_ID)
    ).toBeInTheDocument();
  });

  it('should render the Data Quality origin breadcrumb', async () => {
    mockLocation.state = {
      breadcrumbData: [
        {
          name: 'Data Quality',
          url: '/data-quality/test-cases',
        },
      ],
    };

    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: Wrapper });
    });

    expect(
      await screen.findByRole('link', { name: 'Data Quality' })
    ).toHaveAttribute('href', '/data-quality/test-cases');
  });

  it('should render the test suite origin breadcrumb', async () => {
    mockLocation.state = {
      breadcrumbData: [
        {
          name: 'Test Suites',
          url: '/data-quality/test-suites/bundle-suites',
        },
        {
          name: 'Orders Bundle Suite',
          url: '/test-suites/Orders.Bundle',
        },
      ],
    };

    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: Wrapper });
    });

    expect(
      await screen.findByRole('link', { name: 'Test Suites' })
    ).toHaveAttribute('href', '/data-quality/test-suites/bundle-suites');
    expect(
      await screen.findByRole('link', { name: 'Orders Bundle Suite' })
    ).toHaveAttribute('href', '/test-suites/Orders.Bundle');
  });

  it('onClick of same tab, should not call navigate', async () => {
    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: Wrapper });
    });

    const testCaseResult = await screen.findByTestId('test-case-result');
    await act(async () => {
      fireEvent.click(testCaseResult);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should render the last run banner inside the test case results tab', async () => {
    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: Wrapper });
    });

    expect(await screen.findByTestId('tabs')).toContainElement(
      await screen.findByTestId(LAST_RUN_SUCCESS_BANNER_TEST_ID)
    );
  });

  it('should show the next run from the enabled test suite schedule', async () => {
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(1_786_000_820_000);
    mockUseTestCase.testCase = {
      ...mockTestCaseData,
      testCaseResult: undefined,
    };

    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: Wrapper });
    });

    expect(getIngestionPipelines).toHaveBeenCalledWith({
      arrQueryFields: ['airflowConfig'],
      limit: 100,
      pipelineType: ['TestSuite'],
      testSuite: TEST_SUITE_FQN,
    });
    expect(getNextCronRunTimestamp).toHaveBeenCalledWith('10 * * * *', 'UTC');
    expect(await screen.findByTestId('test-case-next-run')).toHaveTextContent(
      'label.next · label.in-lowercase 23m'
    );
    expect(
      await screen.findByTestId('test-case-last-run-status')
    ).toHaveTextContent('label.not-run-yet');

    dateNowSpy.mockRestore();
  });

  it('should not render the last run banner inside the incident tab', async () => {
    jest.mocked(useParams).mockReturnValue({
      fqn: TEST_CASE_FQN,
      tab: TestCasePageTabs.ISSUES,
    });

    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: Wrapper });
    });

    expect(
      screen.queryByTestId(LAST_RUN_SUCCESS_BANNER_TEST_ID)
    ).not.toBeInTheDocument();
  });

  it("should render no permission message if user doesn't have permission", async () => {
    mockUseTestCase.testCasePermission = DEFAULT_ENTITY_PERMISSION;
    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: Wrapper });
    });

    expect(
      await screen.findByTestId(ERROR_PLACEHOLDER_TEST_ID)
    ).toHaveAttribute('data-type', 'PERMISSION');

    mockUseTestCase.testCasePermission = MOCK_PERMISSIONS;
  });

  it('should render no data placeholder message if there is no data', async () => {
    mockUseTestCase.testCase = undefined;
    (getTestCaseByFqn as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );

    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: Wrapper });
    });

    expect(
      await screen.findByTestId(ERROR_PLACEHOLDER_TEST_ID)
    ).toBeInTheDocument();

    mockUseTestCase.testCase = mockTestCaseData;
  });
});
