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
import { BarChart } from '@openmetadata/ui-core-components/charts';
import type { BarChartProps } from '@openmetadata/ui-core-components/charts';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { DataContractResult } from '../../../generated/entity/datacontract/dataContractResult';
import { ContractExecutionStatus } from '../../../generated/type/contractExecutionStatus';
import { getAllContractResults } from '../../../rest/contractAPI';
import { processContractExecutionData } from '../../../utils/DataContract/DataContractUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { DataContractProcessedResultCharts } from './ContractExecutionChart.interface';
import ContractExecutionChart from './ContractExecutionChart.component';

type Row = DataContractProcessedResultCharts;

const lastChartProps = () => {
  const { calls } = (
    BarChart as unknown as jest.Mock<null, [BarChartProps<Row>]>
  ).mock;

  return calls[calls.length - 1][0];
};

jest.mock('../../../rest/contractAPI', () => ({
  getAllContractResults: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/DataContract/DataContractUtils', () => ({
  processContractExecutionData: jest.fn((data) =>
    data.map(
      (
        item: { timestamp: number; contractExecutionStatus: string },
        index: number
      ) => ({
        name: `${item.timestamp}_${index}`,
        displayTimestamp: item.timestamp,
        value: 1,
        status: item.contractExecutionStatus,
        failed: item.contractExecutionStatus === 'Failed' ? 1 : 0,
        success: item.contractExecutionStatus === 'Success' ? 1 : 0,
        aborted: item.contractExecutionStatus === 'Aborted' ? 1 : 0,
        running: item.contractExecutionStatus === 'Running' ? 1 : 0,
        data: item,
      })
    )
  ),
  generateMonthTickPositions: jest.fn(
    (data: { name: string; displayTimestamp: number }[]) => {
      const seen = new Set<string>();

      return data
        .filter((item) => {
          const month = new Date(item.displayTimestamp)
            .toISOString()
            .slice(0, 7);
          const isNew = !seen.has(month);
          seen.add(month);

          return isNew;
        })
        .map((item) => item.name);
    }
  ),
  formatContractExecutionTick: jest.fn((value) => {
    const timestamp = value.split('_')[0];
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    return monthNames[new Date(Number(timestamp)).getMonth()];
  }),
  formatContractExecutionDayTick: jest.fn(
    (value: string) => `day ${value.split('_')[0]}`
  ),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatMonth: jest.fn((timestamp) => {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    return monthNames[new Date(timestamp).getMonth()];
  }),
  getCurrentMillis: jest.fn(() => 1640995200000), // Fixed timestamp
  getEpochMillisForPastDays: jest.fn(
    (days) => 1640995200000 - days * 24 * 60 * 60 * 1000
  ),
  getStartOfDayInMillis: jest.fn().mockImplementation((val) => val),
  getEndOfDayInMillis: jest.fn().mockImplementation((val) => val),
  formatDateTimeLong: jest.fn((timestamp) => `at ${timestamp}`),
}));

jest.mock('../../common/DatePickerMenu/DatePickerMenu.component', () => {
  return function MockDatePickerMenu({
    handleDateRangeChange,
  }: {
    handleDateRangeChange: (range: { startTs: number; endTs: number }) => void;
  }) {
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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'label.success': 'Success',
        'label.failed': 'Failed',
        'label.aborted': 'Aborted',
        'label.running': 'Running',
        'label.partial-success': 'Partial Success',
        'label.queued': 'Queued',
        'label.contract-execution-status': 'Contract Execution Status',
      };

      return translations[key] || key;
    },
  }),
}));

const mockContract: DataContract = {
  id: 'contract-1',
  name: 'Test Contract',
  description: 'Test Description',
} as unknown as DataContract;

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
] as unknown as DataContractResult[];

const DAY_MS = 24 * 60 * 60 * 1000;

// `count` successful runs, one a day from 1 Jan 2022.
const dailyRuns = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `run-${i}`,
    timestamp: Date.UTC(2022, 0, 1) + i * DAY_MS,
    contractExecutionStatus: ContractExecutionStatus.Success,
  }));

describe('ContractExecutionChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAllContractResults as jest.Mock).mockResolvedValue({
      data: mockContractResults,
    });
  });

  describe('Basic Rendering', () => {
    it('should render chart after data is loaded', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-menu')).toBeInTheDocument();
      });

      expect(
        screen.getByTestId('contract-execution-chart')
      ).toBeInTheDocument();
    });
  });

  describe('Data Fetching', () => {
    it('should fetch contract results on component mount', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      expect(getAllContractResults).toHaveBeenCalledWith('contract-1', {
        startTs: expect.any(Number),
        endTs: expect.any(Number),
        limit: 10000,
      });

      await waitFor(() => expect(lastChartProps().loading).toBe(false));
    });

    it('should handle API errors gracefully', async () => {
      const mockError = new AxiosError('API Error');
      (getAllContractResults as jest.Mock).mockRejectedValue(mockError);

      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(mockError);
      });
      await waitFor(() => expect(lastChartProps().loading).toBe(false));
    });

    it('clears the previous range when refetching it fails', async () => {
      const mockError = new AxiosError('API Error');
      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => expect(lastChartProps().data).toHaveLength(3));

      (getAllContractResults as jest.Mock).mockRejectedValueOnce(mockError);
      await act(async () => {
        fireEvent.click(screen.getByTestId('change-date-range'));
      });

      await waitFor(() => expect(lastChartProps().loading).toBe(false));

      expect(showErrorToast).toHaveBeenCalledWith(mockError);
      expect(lastChartProps().data).toEqual([]);
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
        limit: 10000,
      });

      await waitFor(() => expect(lastChartProps().loading).toBe(false));
    });
  });

  describe('Loading States', () => {
    it('shows the chart skeleton while fetching', () => {
      (getAllContractResults as jest.Mock).mockImplementation(
        () => new Promise(() => undefined)
      );

      render(<ContractExecutionChart contract={mockContract} />);

      expect(lastChartProps().loading).toBe(true);
      expect(screen.getByTestId('date-picker-menu')).toBeInTheDocument();
    });

    it('drops the skeleton once data is loaded', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => expect(lastChartProps().loading).toBe(false));
    });
  });

  describe('Chart Data Processing', () => {
    it('passes one row per run, in timestamp order', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => expect(lastChartProps().data).toHaveLength(3));

      expect(lastChartProps().data.map((row) => row.name)).toEqual([
        '1640995200000_0',
        '1640995260000_1',
        '1640995320000_2',
      ]);
      expect(processContractExecutionData).toHaveBeenCalledWith(
        mockContractResults
      );
    });

    it('gives runs with the same timestamp their own bar', async () => {
      (getAllContractResults as jest.Mock).mockResolvedValue({
        data: [
          {
            id: 'a',
            timestamp: 1640995200000,
            contractExecutionStatus: ContractExecutionStatus.Success,
          },
          {
            id: 'b',
            timestamp: 1640995200000,
            contractExecutionStatus: ContractExecutionStatus.Failed,
          },
        ],
      });

      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() =>
        expect(lastChartProps().data.map((row) => row.name)).toEqual([
          '1640995200000_0',
          '1640995200000_1',
        ])
      );
    });

    it('passes no rows for an empty range, so core shows its empty state', async () => {
      (getAllContractResults as jest.Mock).mockResolvedValue({ data: [] });

      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => expect(lastChartProps().loading).toBe(false));

      expect(lastChartProps().data).toEqual([]);
    });
  });

  describe('Chart configuration', () => {
    const rowWith = (status: string) => ({ status } as unknown as Row);

    it('draws one full-height bar series per run', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => expect(lastChartProps().loading).toBe(false));
      const props = lastChartProps();

      expect(props.series).toEqual([
        expect.objectContaining({
          key: 'value',
          name: 'Contract Execution Status',
          seriesOption: { barMaxWidth: 12 },
        }),
      ]);
      expect(props.xKey).toBe('name');
      expect(props.radius).toBe(6);
      expect(props.height).toBe(240);
      expect(props.ariaLabel).toBe('label.execution-history');
      expect(props.yAxis).toEqual(
        expect.objectContaining({ max: 1, axisLabel: { show: false } })
      );
    });

    it.each([
      [ContractExecutionStatus.Success, 'success'],
      [ContractExecutionStatus.Failed, 'failed'],
      [ContractExecutionStatus.Aborted, 'warning'],
      [ContractExecutionStatus.PartialSuccess, 'warning'],
      [ContractExecutionStatus.Running, 'info'],
      [ContractExecutionStatus.Queued, 'muted'],
    ])('colours a %s run as %s', async (executionStatus, chartStatus) => {
      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => expect(lastChartProps().loading).toBe(false));

      expect(lastChartProps().getBarStatus?.(rowWith(executionStatus), 0)).toBe(
        chartStatus
      );
    });

    it('draws an unknown status muted, so it reads as no known state', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => expect(lastChartProps().loading).toBe(false));

      expect(lastChartProps().getBarStatus?.(rowWith('SomethingNew'), 0)).toBe(
        'muted'
      );
    });

    it('labels only the first run of each month, across a year boundary', async () => {
      const dec = Date.UTC(2021, 11, 30);
      const dec2 = Date.UTC(2021, 11, 31);
      const jan = Date.UTC(2022, 0, 2);
      (getAllContractResults as jest.Mock).mockResolvedValue({
        data: [dec, dec2, jan].map((timestamp, i) => ({
          id: `r${i}`,
          timestamp,
          contractExecutionStatus: ContractExecutionStatus.Success,
        })),
      });

      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => expect(lastChartProps().data).toHaveLength(3));
      const interval = (
        lastChartProps().xAxis?.axisLabel as {
          interval: (index: number, value: string) => boolean;
        }
      ).interval;

      expect(
        lastChartProps().data.map((row, i) => interval(i, row.name))
      ).toEqual([true, false, true]);
      // Mid-month, so the mocked month name is the same in every timezone.
      expect(
        lastChartProps().xAxis?.formatter?.(`${Date.UTC(2022, 0, 15)}_0`)
      ).toBe('Jan');
    });

    it('labels zoomed runs by day above 31 runs, so every window has labels', async () => {
      (getAllContractResults as jest.Mock).mockResolvedValue({
        data: dailyRuns(32),
      });

      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => expect(lastChartProps().data).toHaveLength(32));
      const { xAxis } = lastChartProps();

      expect(xAxis?.axisLabel).toEqual(
        expect.objectContaining({ interval: 'auto' })
      );
      expect(xAxis?.formatter?.('1640995200000_0')).toBe('day 1640995200000');
    });

    it('keeps month-start labels at 31 runs', async () => {
      (getAllContractResults as jest.Mock).mockResolvedValue({
        data: dailyRuns(31),
      });

      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => expect(lastChartProps().data).toHaveLength(31));

      expect(
        typeof (lastChartProps().xAxis?.axisLabel as { interval: unknown })
          .interval
      ).toBe('function');
    });

    it.each([3, 32])(
      "hands core zoom 'auto' with a 31-run window for %i runs",
      async (count) => {
        (getAllContractResults as jest.Mock).mockResolvedValue({
          data: dailyRuns(count),
        });

        render(<ContractExecutionChart contract={mockContract} />);

        await waitFor(() => expect(lastChartProps().data).toHaveLength(count));

        expect(lastChartProps().zoom).toBe('auto');
        expect(lastChartProps().zoomVisiblePoints).toBe(31);
      }
    );

    it('renders the hovered run in the tooltip with its status name and colour', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => expect(lastChartProps().data).toHaveLength(3));
      const props = lastChartProps();
      const html = renderToStaticMarkup(
        <>{props.tooltip?.render?.([], props.data[1])}</>
      );

      expect(html).toContain('Contract Execution Status');
      expect(html).toContain('Failed');
      // Failed status colour of the mocked core palette.
      expect(html).toContain('#a00000');
    });

    it('renders an unknown status in the tooltip by name, with the muted colour', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => expect(lastChartProps().loading).toBe(false));
      const html = renderToStaticMarkup(
        <>{lastChartProps().tooltip?.render?.([], rowWith('SomethingNew'))}</>
      );

      expect(html).toContain('SomethingNew');
      // Muted status colour of the mocked core palette.
      expect(html).toContain('#909090');
    });

    it('renders nothing in the tooltip without a hovered run', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      await waitFor(() => expect(lastChartProps().loading).toBe(false));

      expect(lastChartProps().tooltip?.render?.([], undefined)).toBeNull();
    });
  });

  describe('Date Range Handling', () => {
    it('should initialize with default date range', async () => {
      render(<ContractExecutionChart contract={mockContract} />);

      expect(getAllContractResults).toHaveBeenCalledWith('contract-1', {
        startTs: expect.any(Number),
        endTs: 1640995200000, // Fixed current time
        limit: 10000,
      });

      await waitFor(() => expect(lastChartProps().loading).toBe(false));
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

      await waitFor(() => expect(lastChartProps().loading).toBe(false));
    });
  });

  describe('Error Handling', () => {
    it('should handle missing contract ID gracefully', async () => {
      const contractWithoutId = { ...mockContract, id: undefined };

      expect(() => {
        render(
          <ContractExecutionChart
            contract={contractWithoutId as unknown as DataContract}
          />
        );
      }).not.toThrow();

      await waitFor(() => expect(lastChartProps().loading).toBe(false));
    });
  });
});
