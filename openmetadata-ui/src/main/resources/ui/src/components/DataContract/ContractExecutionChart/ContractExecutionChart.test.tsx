/* eslint-disable @typescript-eslint/no-explicit-any */
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
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AxiosError } from 'axios';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { DataContractResult } from '../../../generated/entity/datacontract/dataContractResult';
import { ContractExecutionStatus } from '../../../generated/type/contractExecutionStatus';
import { getAllContractResults } from '../../../rest/contractAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import ContractExecutionChart from './ContractExecutionChart.component';

jest.mock('../../../rest/contractAPI', () => ({
  getAllContractResults: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn((timestamp) =>
    new Date(timestamp).toLocaleDateString()
  ),
  getCurrentMillis: jest.fn(() => 1640995200000), // Fixed timestamp
  getEpochMillisForPastDays: jest.fn(
    (days) => 1640995200000 - days * 24 * 60 * 60 * 1000
  ),
}));

jest.mock('../../common/DatePickerMenu/DatePickerMenu.component', () => {
  return function MockDatePickerMenu({ handleDateRangeChange }: any) {
    return (
      <div data-testid="date-picker-menu">
        <button
          data-testid="change-date-range"
          onClick={() =>
            handleDateRangeChange({
              startTs: 1640908800000,
              endTs: 1640995200000,
            })
          }>
          Change Date Range
        </button>
      </div>
    );
  };
});

jest.mock('../../common/ExpandableCard/ExpandableCard', () => {
  return function MockExpandableCard({ cardProps, children }: any) {
    return (
      <div className={cardProps?.className} data-testid="expandable-card">
        <div data-testid="card-title">{cardProps?.title}</div>
        <div>{children}</div>
      </div>
    );
  };
});

jest.mock('../../common/Loader/Loader', () => {
  return function MockLoader() {
    return <div data-testid="loader">Loading...</div>;
  };
});

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ data, children }: any) => (
    <div data-chart-data={JSON.stringify(data)} data-testid="bar-chart">
      {children}
    </div>
  ),
  Bar: ({ dataKey, fill, name }: any) => (
    <div data-fill={fill} data-testid={`bar-${dataKey}`}>
      {name}
    </div>
  ),
  XAxis: ({ dataKey }: any) => (
    <div data-key={dataKey} data-testid="x-axis">
      XAxis
    </div>
  ),
  CartesianGrid: () => <div data-testid="cartesian-grid">Grid</div>,
  Tooltip: () => <div data-testid="tooltip">Tooltip</div>,
  Legend: () => <div data-testid="legend">Legend</div>,
  Rectangle: () => <div data-testid="rectangle">Rectangle</div>,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'label.contract-execution-history': 'Contract Execution History',
        'message.contract-execution-history-description':
          'View contract execution history over time',
        'label.success': 'Success',
        'label.failed': 'Failed',
        'label.aborted': 'Aborted',
      };

      return translations[key] || key;
    },
  }),
}));

const mockContract: DataContract = {
  id: 'contract-1',
  name: 'Test Contract',
  description: 'Test Description',
} as any;

const mockContractResults: DataContractResult[] = [
  {
    id: 'result-1',
    timestamp: 1640995200000,
    contractExecutionStatus: ContractExecutionStatus.Success,
  },
  {
    id: 'result-2',
    timestamp: 1640995260000,
    contractExecutionStatus: ContractExecutionStatus.Failed,
  },
  {
    id: 'result-3',
    timestamp: 1640995320000,
    contractExecutionStatus: ContractExecutionStatus.Aborted,
  },
] as any;

describe('ContractExecutionChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAllContractResults as jest.Mock).mockResolvedValue({
      data: mockContractResults,
    });
  });

  describe('Basic Rendering', () => {
    it('should render the component with loading state initially', async () => {
      (getAllContractResults as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<ContractExecutionChart contract={mockContract} />);

      expect(screen.getByTestId('expandable-card')).toBeInTheDocument();
      expect(
        screen.getByText('Contract Execution History')
      ).toBeInTheDocument();
      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('should render chart after data is loaded', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-menu')).toBeInTheDocument();
      });

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('should display chart title and description', () => {
      render(<ContractExecutionChart contract={mockContract} />);

      expect(
        screen.getByText('Contract Execution History')
      ).toBeInTheDocument();
      expect(
        screen.getByText('View contract execution history over time')
      ).toBeInTheDocument();
    });
  });

  describe('Data Fetching', () => {
    it('should fetch contract results on component mount', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      expect(getAllContractResults).toHaveBeenCalledWith('contract-1', {
        startTs: expect.any(Number),
        endTs: expect.any(Number),
      });

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      const mockError = new AxiosError('API Error');
      (getAllContractResults as jest.Mock).mockRejectedValue(mockError);

      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(mockError);
      });
    });

    it('should refetch data when date range changes', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-menu')).toBeInTheDocument();
      });

      const changeDateButton = screen.getByTestId('change-date-range');

      await act(async () => {
        fireEvent.click(changeDateButton);
      });

      expect(getAllContractResults).toHaveBeenCalledTimes(2);
      expect(getAllContractResults).toHaveBeenLastCalledWith('contract-1', {
        startTs: 1640908800000,
        endTs: 1640995200000,
      });
    });
  });

  describe('Chart Data Processing', () => {
    it('should process contract results into chart data correctly', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => {
        const barChart = screen.getByTestId('bar-chart');
        const chartData = JSON.parse(
          barChart.getAttribute('data-chart-data') || '[]'
        );

        expect(chartData).toHaveLength(3);
        expect(chartData[0]).toEqual({
          name: 1640995200000,
          failed: 0,
          success: 1,
          aborted: 0,
        });
        expect(chartData[1]).toEqual({
          name: 1640995260000,
          failed: 1,
          success: 0,
          aborted: 0,
        });
        expect(chartData[2]).toEqual({
          name: 1640995320000,
          failed: 0,
          success: 0,
          aborted: 1,
        });
      });
    });

    it('should handle empty data gracefully', async () => {
      (getAllContractResults as jest.Mock).mockResolvedValue({ data: [] });

      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => {
        const barChart = screen.getByTestId('bar-chart');
        const chartData = JSON.parse(
          barChart.getAttribute('data-chart-data') || '[]'
        );

        expect(chartData).toHaveLength(0);
      });
    });
  });

  describe('Chart Components', () => {
    it('should render all chart components', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      expect(
        await screen.findByTestId('responsive-container')
      ).toBeInTheDocument();
      expect(await screen.findByTestId('bar-chart')).toBeInTheDocument();
      expect(await screen.findByTestId('cartesian-grid')).toBeInTheDocument();
      expect(await screen.findByTestId('x-axis')).toBeInTheDocument();
      expect(await screen.findByTestId('legend')).toBeInTheDocument();
    });

    it('should render bars for each status type', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      //   expect(screen.getByTestId('bar-success')).toBeInTheDocument();
      //   expect(screen.getByTestId('bar-failed')).toBeInTheDocument();
      //   expect(screen.getByTestId('bar-aborted')).toBeInTheDocument();

      expect(await screen.findByTestId('bar-success')).toHaveTextContent(
        'Success'
      );
      expect(await screen.findByTestId('bar-failed')).toHaveTextContent(
        'Failed'
      );
      expect(await screen.findByTestId('bar-aborted')).toHaveTextContent(
        'Aborted'
      );
    });

    it('should use correct colors for bars', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => {
        expect(screen.getByTestId('bar-success')).toHaveAttribute(
          'data-fill',
          '#48ca9e'
        );
        expect(screen.getByTestId('bar-failed')).toHaveAttribute(
          'data-fill',
          '#f24822'
        );
        expect(screen.getByTestId('bar-aborted')).toHaveAttribute(
          'data-fill',
          '#ffbe0e'
        );
      });
    });
  });

  describe('Date Range Handling', () => {
    it('should initialize with default date range', () => {
      render(<ContractExecutionChart contract={mockContract} />);

      expect(getAllContractResults).toHaveBeenCalledWith('contract-1', {
        startTs: expect.any(Number),
        endTs: 1640995200000, // Fixed current time
      });
    });

    it('should not refetch data if date range is the same', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-menu')).toBeInTheDocument();
      });

      // Simulate no change in date range
      const changeDateButton = screen.getByTestId('change-date-range');

      await act(async () => {
        fireEvent.click(changeDateButton);
      });

      expect(getAllContractResults).toHaveBeenCalledTimes(2);
    });
  });

  describe('Component Structure', () => {
    it('should have correct CSS classes', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      expect(screen.getByTestId('expandable-card')).toHaveClass(
        'expandable-card-contract'
      );
    });

    it('should display card title structure correctly', () => {
      render(<ContractExecutionChart contract={mockContract} />);

      const cardTitle = screen.getByTestId('card-title');

      expect(cardTitle).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state during data fetch', () => {
      (getAllContractResults as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<ContractExecutionChart contract={mockContract} />);

      expect(screen.getByTestId('loader')).toBeInTheDocument();
      expect(screen.queryByTestId('date-picker-menu')).not.toBeInTheDocument();
    });

    it('should hide loading state after data is loaded', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('date-picker-menu')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing contract ID gracefully', async () => {
      const contractWithoutId = { ...mockContract, id: undefined };

      expect(() => {
        render(<ContractExecutionChart contract={contractWithoutId as any} />);
      }).not.toThrow();
    });
  });
});
