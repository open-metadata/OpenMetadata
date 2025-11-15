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
import { render, screen, waitFor } from '@testing-library/react';
import {
  MOCK_SQL_TEST_CASE,
  MOCK_TEST_CASE,
} from '../../../../mocks/TestSuite.mock';
import { getEpochMillisForPastDays } from '../../../../utils/date-time/DateTimeUtils';
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

const mockDatePickerMenu = jest.fn();

jest.mock('../../../common/DatePickerMenu/DatePickerMenu.component', () => {
  return (props: unknown) => {
    mockDatePickerMenu(props);

    return <div>DatePickerMenu.component</div>;
  };
});
jest.mock('../../../common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader.component</div>);
});
jest.mock('./TestSummaryGraph', () => {
  return jest.fn().mockImplementation(() => <div>TestSummaryGraph</div>);
});
jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  getCurrentMillis: jest.fn().mockImplementation(() => 1633948800000),
  getEpochMillisForPastDays: jest.fn().mockImplementation(() => 1633948800000),
  getStartOfDayInMillis: jest.fn().mockImplementation((val) => val),
  getEndOfDayInMillis: jest.fn().mockImplementation((val) => val),
}));

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
    expect(
      await screen.findByText('DatePickerMenu.component')
    ).toBeInTheDocument();
  });

  it('default time range should be 30 days', async () => {
    const MockGetEpochMillisForPastDays =
      getEpochMillisForPastDays as jest.Mock;
    render(<TestSummary data={MOCK_SQL_TEST_CASE} />);

    expect(MockGetEpochMillisForPastDays).toHaveBeenCalledWith(30);
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

  it('should pass correct props to DatePickerMenu', async () => {
    render(<TestSummary {...mockProps} />);

    await waitFor(() => {
      expect(mockDatePickerMenu).toHaveBeenCalledWith(
        expect.objectContaining({
          showSelectedCustomRange: true,
          defaultDateRange: expect.objectContaining({
            key: 'last30days',
            title: 'last 30 days',
          }),
          handleDateRangeChange: expect.any(Function),
          handleSelectedTimeRange: expect.any(Function),
        })
      );
    });
  });

  it('should handle date range change', async () => {
    render(<TestSummary {...mockProps} />);

    await waitFor(() => {
      expect(mockDatePickerMenu).toHaveBeenCalled();
    });

    const datePickerProps = mockDatePickerMenu.mock.calls[0][0] as {
      handleDateRangeChange: (value: {
        startTs: number;
        endTs: number;
      }) => void;
    };
    const newDateRange = { startTs: 1234567890, endTs: 1234567899 };

    jest.clearAllMocks();
    datePickerProps.handleDateRangeChange(newDateRange);

    await waitFor(() => {
      expect(mockGetListTestCaseResults).toHaveBeenCalledWith(
        mockProps.data.fullyQualifiedName,
        newDateRange
      );
    });
  });

  it('should handle selected time range change', async () => {
    render(<TestSummary {...mockProps} />);

    await waitFor(() => {
      expect(mockDatePickerMenu).toHaveBeenCalled();
    });

    const datePickerProps = mockDatePickerMenu.mock.calls[0][0] as {
      handleSelectedTimeRange: (range: string) => void;
    };

    datePickerProps.handleSelectedTimeRange('last 7 days');

    await waitFor(() => {
      expect(mockDatePickerMenu).toHaveBeenCalled();
    });
  });

  it('should use start and end of day for default date range', () => {
    render(<TestSummary {...mockProps} />);

    expect(getEpochMillisForPastDays).toHaveBeenCalledWith(30);
  });
});
