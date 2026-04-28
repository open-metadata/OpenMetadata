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
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  ContractExecutionStatus,
  DataContractResult,
} from '../../../generated/entity/datacontract/dataContractResult';
import { TestCase, TestCaseStatus } from '../../../generated/tests/testCase';
import { MOCK_DATA_CONTRACT } from '../../../mocks/DataContract.mock';
import { getListTestCaseBySearch } from '../../../rest/testAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import ContractQualityCard from './ContractQualityCard.component';

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({
    fqn: 'fqn',
  })),
}));

jest.mock('../../../rest/testAPI', () => ({
  getListTestCaseBySearch: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options) {
        return `${key}_${JSON.stringify(options)}`;
      }

      return key;
    },
  }),
}));

jest.mock('../../common/Loader/Loader', () => {
  return jest.fn(() => <div data-testid="loader">Loader</div>);
});

jest.mock('../../common/StatusBadge/StatusBadgeV2.component', () => {
  return jest.fn(({ label, status, dataTestId }) => (
    <div data-testid={dataTestId}>
      {label} - {status}
    </div>
  ));
});

jest.mock('../../../utils/DataContract/DataContractUtils', () => ({
  getContractStatusType: jest.fn((status) => status),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getTestCaseDetailPagePath: jest.fn((fqn) => `/test-case/${fqn}`),
}));

const mockLatestContractResults: DataContractResult = {
  id: '0cdc53d6-0711-4776-b005-444100c76b4d',
  dataContractFQN:
    'Configure.default.openmetadata_db.ACT_EVT_LOG.dataContract_Banking Sectors',
  timestamp: 1758865987530,
  contractExecutionStatus: ContractExecutionStatus.Success,
  qualityValidation: {
    passed: 70,
    failed: 20,
    total: 100,
    qualityScore: 100,
  },
};

const commonCaseMock = {
  entityLink: '<#E::table::my_sql_service.default.openmetadata_db.ACT_EVT_LOG>',
  testDefinition: {
    id: '0f53f2f9-9071-41ad-9ca4-c8c5256c49ce',
    type: 'testDefinition',
    name: 'tableColumnNameToExist',
    fullyQualifiedName: 'tableColumnNameToExist',
    description:
      'This test defines the test TableColumnNameToExist. Test the table columns exists in the table.',
    displayName: 'Table Column Name To Exist',
    deleted: false,
  },
  testSuite: {
    type: 'table',
    id: '51a7d744-3cc6-4fea-a0cf-1c09f28f3e2d',
    name: '075242ff-ed95-4dd5-a707-04a7bbbacc46',
    displayName: 'Data Contract - Banking Sectors',
    fullyQualifiedName: '075242ff-ed95-4dd5-a707-04a7bbbacc46',
    description: 'Logical test suite for Data Contract: Banking Sectors',
    deleted: false,
    inherited: true,
  },
};

const mockTestCases: TestCase[] = [
  {
    id: 'test-case-1',
    name: 'CLV Must be Positive',
    fullyQualifiedName: 'table.test_case_1',
    testCaseResult: {
      testCaseStatus: TestCaseStatus.Success,
      timestamp: 1234567890,
      testResultValue: [],
      result: '',
      sampleData: '',
      testCaseFailureStatus: undefined,
    },
    ...commonCaseMock,
  },
  {
    id: 'test-case-2',
    name: 'Customer ID To Be Unique',
    fullyQualifiedName: 'table.test_case_2',
    testCaseResult: {
      testCaseStatus: TestCaseStatus.Failed,
      timestamp: 1234567890,
      testResultValue: [],
      result: '',
      sampleData: '',
      testCaseFailureStatus: undefined,
    },
    ...commonCaseMock,
  },
  {
    id: 'test-case-3',
    name: 'Table Row Count To Equal',
    fullyQualifiedName: 'table.test_case_3',
    testCaseResult: {
      testCaseStatus: TestCaseStatus.Aborted,
      timestamp: 1234567890,
      testResultValue: [],
      result: '',
      sampleData: '',
      testCaseFailureStatus: undefined,
    },
    ...commonCaseMock,
  },
];

describe('ContractQualityCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loader when data is loading', async () => {
    render(
      <MemoryRouter>
        <ContractQualityCard contract={MOCK_DATA_CONTRACT} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });
  });

  it('should fetch and display test case summary and test cases', async () => {
    (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
      data: mockTestCases,
    });

    render(
      <MemoryRouter>
        <ContractQualityCard
          contract={MOCK_DATA_CONTRACT}
          latestContractResults={mockLatestContractResults}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('CLV Must be Positive')).toBeInTheDocument();
      expect(screen.getByText('Customer ID To Be Unique')).toBeInTheDocument();
      expect(screen.getByText('Table Row Count To Equal')).toBeInTheDocument();
    });

    expect(getListTestCaseBySearch).toHaveBeenCalledWith(
      expect.objectContaining({
        entityLink: '<#E::table::fqn>',
        include: 'non-deleted',
        includeAllTests: true,
        limit: 10000,
        sortField: 'testCaseResult.timestamp',
        sortType: 'desc',
      })
    );
  });

  it('should display test summary chart when data is available', async () => {
    (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
      data: mockTestCases,
    });

    render(
      <MemoryRouter>
        <ContractQualityCard
          contract={MOCK_DATA_CONTRACT}
          latestContractResults={mockLatestContractResults}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/label.success/)).toBeInTheDocument();
      expect(screen.getByText(/label.failed/)).toBeInTheDocument();
      expect(screen.getByText(/label.aborted/)).toBeInTheDocument();
      expect(screen.getByText('70')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('should display contract status when provided', async () => {
    (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
      data: mockTestCases,
    });

    render(
      <MemoryRouter>
        <ContractQualityCard
          contract={MOCK_DATA_CONTRACT}
          contractStatus="Passed"
          latestContractResults={mockLatestContractResults}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('contract-status-card-item-quality-status')
      ).toBeInTheDocument();
      expect(screen.getByText('Passed - Passed')).toBeInTheDocument();
    });
  });

  it('should show error toast when test cases fetch fails', async () => {
    (getListTestCaseBySearch as jest.Mock).mockRejectedValue(
      new Error('API Error')
    );

    render(
      <MemoryRouter>
        <ContractQualityCard contract={MOCK_DATA_CONTRACT} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(
        'server.entity-fetch-error_{"entity":"label.test-case-plural"}'
      );
    });
  });

  it('should render test case links correctly', async () => {
    (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
      data: mockTestCases,
    });

    render(
      <MemoryRouter>
        <ContractQualityCard contract={MOCK_DATA_CONTRACT} />
      </MemoryRouter>
    );

    await waitFor(() => {
      const links = screen.getAllByRole('link');

      expect(links[0]).toHaveAttribute(
        'href',
        '/test-case/fqn.CLV Must be Positive'
      );
      expect(links[1]).toHaveAttribute(
        'href',
        '/test-case/fqn.Customer ID To Be Unique'
      );
      expect(links[2]).toHaveAttribute(
        'href',
        '/test-case/fqn.Table Row Count To Equal'
      );
    });
  });

  it('should calculate segment widths correctly', async () => {
    (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
      data: mockTestCases,
    });

    const { container } = render(
      <MemoryRouter>
        <ContractQualityCard
          contract={MOCK_DATA_CONTRACT}
          latestContractResults={mockLatestContractResults}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      const successSegment = container.querySelector(
        '.data-quality-line-chart-item.success'
      ) as HTMLElement;
      const failedSegment = container.querySelector(
        '.data-quality-line-chart-item.failed'
      ) as HTMLElement;
      const abortedSegment = container.querySelector(
        '.data-quality-line-chart-item.aborted'
      ) as HTMLElement;

      expect(successSegment.style.width).toBe('70%');
      expect(failedSegment.style.width).toBe('20%');
      expect(abortedSegment.style.width).toBe('10%');
    });
  });

  it('should not show test summary chart when total is 0', async () => {
    (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
      data: [],
    });

    const { container } = render(
      <MemoryRouter>
        <ContractQualityCard
          contract={MOCK_DATA_CONTRACT}
          latestContractResults={{
            ...mockLatestContractResults,
            qualityValidation: {
              passed: 0,
              failed: 0,
              total: 0,
              qualityScore: 0,
            },
          }}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      const chartContainer = container.querySelector(
        '.data-quality-line-chart-container'
      );

      expect(chartContainer).not.toBeInTheDocument();
    });
  });
});
