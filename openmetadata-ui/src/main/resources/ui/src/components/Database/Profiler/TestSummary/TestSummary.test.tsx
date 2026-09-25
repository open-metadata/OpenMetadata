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
import { act, render, screen, waitFor } from '@testing-library/react';
import { get } from 'lodash';
import { TestCase } from '../../../../generated/tests/testCase';
import enUS from '../../../../locale/languages/en-us.json';
import {
  MOCK_SQL_TEST_CASE,
  MOCK_TEST_CASE,
} from '../../../../mocks/TestSuite.mock';
import { getPastDaysRange } from '../../../observability/DataQuality/Dashboard/calendarDate.utils';
import { TestSummaryProps } from '../ProfilerDashboard/profilerDashboard.interface';
import TestSummary from './TestSummary';

const mockProps: TestSummaryProps = {
  data: MOCK_TEST_CASE[1],
};

const mockGetListTestCaseResults = jest.fn();
const mockGetTestCaseDimensionResultsByFqn = jest.fn();

jest.mock('../../../../rest/testAPI', () => ({
  getListTestCaseResults: (...args: unknown[]) =>
    mockGetListTestCaseResults(...args),
  getTestCaseDimensionResultsByFqn: (...args: unknown[]) =>
    mockGetTestCaseDimensionResultsByFqn(...args),
}));

jest.mock('../../../../constants/profiler.constant', () => ({
  PROFILER_FILTER_RANGE: {
    last30days: {
      days: 30,
      title: 'last 30 days',
    },
  },
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockUseRequiredParams = jest.fn().mockReturnValue({});

jest.mock('../../../../utils/useRequiredParams', () => ({
  useRequiredParams: () => mockUseRequiredParams(),
}));

// Renders the caption in English so each shape is checked against the mock's
// own wording, not against translation keys.
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      String(get(enUS, key, key)).replace(
        /{{(\w+)}}/g,
        (_, name: string) => values?.[name] ?? ''
      ),
  }),
}));

interface DateRangeFilterProps {
  startTs?: number;
  endTs?: number;
  onApply: (range: { startTs: number; endTs: number }) => void;
}

const mockDateRangeFilter = jest.fn();

jest.mock(
  '../../../observability/DataQuality/Dashboard/DqDateRangeFilter',
  () => (props: DateRangeFilterProps) => {
    mockDateRangeFilter(props);

    return <div>DqDateRangeFilter</div>;
  }
);

const applyRange = async (range: { startTs: number; endTs: number }) => {
  const { onApply } = mockDateRangeFilter.mock.calls.at(-1)[0];

  await act(async () => {
    onApply(range);
  });
};
jest.mock('../../../common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader.component</div>);
});
jest.mock('./TestSummaryGraph', () => {
  return jest.fn().mockImplementation(() => <div>TestSummaryGraph</div>);
});
jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  formatDate: jest.fn().mockImplementation((val) => `date-${val}`),
}));
jest.mock(
  '../../../observability/DataQuality/Dashboard/calendarDate.utils',
  () => ({
    getPastDaysRange: jest
      .fn()
      .mockReturnValue({ startTs: 1633948800000, endTs: 1633948800000 }),
  })
);

describe('TestSummary component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetListTestCaseResults.mockResolvedValue({ data: [] });
    mockGetTestCaseDimensionResultsByFqn.mockResolvedValue({ data: [] });
    mockUseRequiredParams.mockReturnValue({});
  });

  it('Component should render', async () => {
    render(<TestSummary {...mockProps} />);

    const graphContainer = await screen.findByTestId('graph-container');
    const graph = await screen.findByText('TestSummaryGraph');

    expect(
      await screen.findByTestId('test-summary-container')
    ).toBeInTheDocument();
    expect(graphContainer).toBeInTheDocument();
    expect(graph).toBeInTheDocument();
    expect(await screen.findByText('DqDateRangeFilter')).toBeInTheDocument();
    expect(screen.getByText('Result history')).toBeInTheDocument();
    expect(screen.getByTestId('run-summary-tiles')).toBeInTheDocument();
  });

  it('default time range should be 30 days', async () => {
    render(<TestSummary data={MOCK_SQL_TEST_CASE} />);

    expect(getPastDaysRange).toHaveBeenCalledWith(30);
  });

  it('should call getListTestCaseResults when dimensionKey is not present', async () => {
    mockUseRequiredParams.mockReturnValue({});
    render(<TestSummary {...mockProps} />);

    await waitFor(() => {
      expect(mockGetListTestCaseResults).toHaveBeenCalledWith(
        mockProps.data.fullyQualifiedName,
        expect.objectContaining({
          startTs: expect.any(Number),
          endTs: expect.any(Number),
        })
      );
      expect(mockGetTestCaseDimensionResultsByFqn).not.toHaveBeenCalled();
    });
  });

  it('should call getTestCaseDimensionResultsByFqn when dimensionKey is present', async () => {
    const dimensionKey = 'test-dimension-key';
    mockUseRequiredParams.mockReturnValue({ dimensionKey });
    render(<TestSummary {...mockProps} />);

    await waitFor(() => {
      expect(mockGetTestCaseDimensionResultsByFqn).toHaveBeenCalledWith(
        mockProps.data.fullyQualifiedName,
        expect.objectContaining({
          dimensionalityKey: dimensionKey,
          startTs: expect.any(Number),
          endTs: expect.any(Number),
        })
      );
      expect(mockGetListTestCaseResults).not.toHaveBeenCalled();
    });
  });

  it('should refetch data when dimensionKey changes', async () => {
    mockUseRequiredParams.mockReturnValue({});
    const { rerender } = render(<TestSummary {...mockProps} />);

    await waitFor(() => {
      expect(mockGetListTestCaseResults).toHaveBeenCalled();
    });

    jest.clearAllMocks();
    mockUseRequiredParams.mockReturnValue({ dimensionKey: 'new-key' });
    rerender(<TestSummary {...mockProps} />);

    await waitFor(() => {
      expect(mockGetTestCaseDimensionResultsByFqn).toHaveBeenCalled();
    });
  });

  it('should handle error when fetching test results', async () => {
    const error = new Error('API Error');
    mockGetListTestCaseResults.mockRejectedValueOnce(error);

    render(<TestSummary {...mockProps} />);

    await waitFor(() => {
      expect(mockGetListTestCaseResults).toHaveBeenCalled();
    });
  });

  it('should not fetch data when data prop is empty', async () => {
    render(<TestSummary data={{} as TestSummaryProps['data']} />);

    await waitFor(() => {
      expect(mockGetListTestCaseResults).not.toHaveBeenCalled();
      expect(mockGetTestCaseDimensionResultsByFqn).not.toHaveBeenCalled();
    });
  });

  it('should show loader initially and then display graph', async () => {
    render(<TestSummary {...mockProps} />);

    expect(screen.getByText('Loader.component')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('TestSummaryGraph')).toBeInTheDocument();
    });
  });

  it('should open the range picker on the last 30 days', async () => {
    render(<TestSummary {...mockProps} />);

    await screen.findByText('DqDateRangeFilter');

    expect(mockDateRangeFilter).toHaveBeenLastCalledWith(
      expect.objectContaining({ startTs: 1633948800000, endTs: 1633948800000 })
    );
  });

  it('should refetch exactly once when the range changes', async () => {
    render(<TestSummary {...mockProps} />);

    await screen.findByText('DqDateRangeFilter');
    mockGetListTestCaseResults.mockClear();

    const newDateRange = { startTs: 1234567890, endTs: 1234567899 };
    await applyRange(newDateRange);

    await waitFor(() => {
      expect(mockGetListTestCaseResults).toHaveBeenCalledTimes(1);
    });

    expect(mockGetListTestCaseResults).toHaveBeenCalledWith(
      mockProps.data.fullyQualifiedName,
      newDateRange
    );
  });

  it('should not refetch when the same range is applied again', async () => {
    render(<TestSummary {...mockProps} />);

    await screen.findByText('DqDateRangeFilter');
    mockGetListTestCaseResults.mockClear();

    await applyRange({ startTs: 1633948800000, endTs: 1633948800000 });

    expect(mockGetListTestCaseResults).not.toHaveBeenCalled();
  });

  it('should recount the tiles for the new range', async () => {
    mockGetListTestCaseResults.mockResolvedValueOnce({
      data: [{ timestamp: 1, testCaseStatus: 'Success' }],
    });
    render(<TestSummary {...mockProps} />);

    await screen.findByText('DqDateRangeFilter');

    expect(screen.getByTestId('run-summary-runs')).toHaveTextContent('1');

    mockGetListTestCaseResults.mockResolvedValueOnce({
      data: [
        { timestamp: 1, testCaseStatus: 'Success' },
        { timestamp: 2, testCaseStatus: 'Failed' },
        { timestamp: 3, testCaseStatus: 'Failed' },
      ],
    });
    await applyRange({ startTs: 1, endTs: 2 });

    await waitFor(() => {
      expect(screen.getByTestId('run-summary-runs')).toHaveTextContent('3');
    });

    expect(screen.getByTestId('run-summary-failed')).toHaveTextContent('2');
  });

  const shape = (
    definition: string,
    parameters: Record<string, string>,
    overrides: Partial<TestCase> = {}
  ) =>
    ({
      ...MOCK_TEST_CASE[1],
      testDefinition: { id: 'id', type: 'testDefinition', name: definition },
      parameterValues: Object.entries(parameters).map(([name, value]) => ({
        name,
        value,
      })),
      useDynamicAssertion: false,
      ...overrides,
    } as TestCase);

  it.each([
    [
      'Row count vs. expected 10,000 · ±5% tolerance',
      shape('tableRowCountToEqual', {
        value: '10000',
        threshold: '5',
        thresholdUnit: 'PERCENTAGE',
      }),
    ],
    [
      'customer_id max vs. allowed range 1–3,489',
      shape(
        'columnValueMaxToBeBetween',
        { minValueForMaxInCol: '1', maxValueForMaxInCol: '3489' },
        {
          entityLink: '<#E::table::svc.db.schema.orders::columns::customer_id>',
        }
      ),
    ],
    [
      'Values vs. learned range (auto)',
      shape('columnValuesToBeBetween', {}, { useDynamicAssertion: true }),
    ],
    [
      'Query result vs. threshold 0',
      shape('tableCustomSQLQuery', {
        sqlExpression: 'SELECT 1',
        threshold: '0',
      }),
    ],
    ['Duplicate count vs. expected 0', shape('columnValuesToBeUnique', {})],
  ])('should caption the chart "%s"', async (caption, testCase) => {
    render(<TestSummary data={testCase} />);

    expect(
      await screen.findByTestId('result-history-caption')
    ).toHaveTextContent(caption);
  });
});
