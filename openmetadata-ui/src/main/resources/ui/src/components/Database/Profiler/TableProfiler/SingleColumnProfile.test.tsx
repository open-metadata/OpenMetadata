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
import { AxiosError } from 'axios';
import { DateRangeObject } from 'Models';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { ColumnProfile } from '../../../../generated/entity/data/container';
import { Table } from '../../../../generated/entity/data/table';
import { Operation } from '../../../../generated/entity/policies/accessControl/resourcePermission';
import { getColumnProfilerList } from '../../../../rest/tableAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import SingleColumnProfile from './SingleColumnProfile';
import { useTableProfiler } from './TableProfilerProvider';

jest.mock('../../../../rest/tableAPI', () => ({
  getColumnProfilerList: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('./TableProfilerProvider', () => ({
  useTableProfiler: jest.fn(),
}));

jest.mock('../../../../utils/TableProfilerUtils', () => ({
  calculateColumnProfilerMetrics: jest.fn().mockReturnValue({
    countMetrics: { data: [] },
    proportionMetrics: { data: [] },
    mathMetrics: { data: [] },
    sumMetrics: { data: [] },
    quartileMetrics: { data: [] },
  }),
  calculateCustomMetrics: jest.fn().mockReturnValue({}),
  getColumnCustomMetric: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../../utils/DocumentationLinksClassBase', () => ({
  getDocsURLS: () => ({
    DATA_QUALITY_PROFILER_WORKFLOW_DOCS: 'https://docs.example.com/profiler',
  }),
}));

jest.mock('../ProfilerDetailsCard/ProfilerDetailsCard', () => {
  return function MockProfilerDetailsCard(props: Record<string, unknown>) {
    return (
      <>
        <div data-testid={`profiler-details-card-${props.name as string}`}>
          {props.title as string}
        </div>
        {props.isLoading && <div data-testid="loading">Loading...</div>}
        {!props.isLoading &&
          (props.chartCollection as { data?: unknown[] })?.data?.length ===
            0 && (
            <div data-testid="no-data">
              {props.noDataPlaceholderText as string}
            </div>
          )}
      </>
    );
  };
});

jest.mock(
  '../../../Visualisations/Chart/DataDistributionHistogram.component',
  () => {
    return function MockDataDistributionHistogram(
      props: Record<string, unknown>
    ) {
      return (
        <div data-testid="data-distribution-histogram">
          {(props.data as { firstDayData?: unknown; currentDayData?: unknown })
            ?.firstDayData ||
          (props.data as { firstDayData?: unknown; currentDayData?: unknown })
            ?.currentDayData ? (
            <div>Histogram Data</div>
          ) : (
            <div>{props.noDataPlaceholderText as string}</div>
          )}
        </div>
      );
    };
  }
);

jest.mock(
  '../../../Visualisations/Chart/CardinalityDistributionChart.component',
  () => {
    return function MockCardinalityDistributionChart(
      props: Record<string, unknown>
    ) {
      return (
        <div data-testid="cardinality-distribution-chart">
          {(props.data as { firstDayData?: unknown; currentDayData?: unknown })
            ?.firstDayData ||
          (props.data as { firstDayData?: unknown; currentDayData?: unknown })
            ?.currentDayData ? (
            <div>Cardinality Data</div>
          ) : (
            <div>{props.noDataPlaceholderText as string}</div>
          )}
        </div>
      );
    };
  }
);

jest.mock('./CustomMetricGraphs/CustomMetricGraphs.component', () => {
  return function MockCustomMetricGraphs(props: Record<string, unknown>) {
    return (
      <>
        <div data-testid="custom-metric-graphs">Custom Metrics Component</div>
        {props.isLoading && <div data-testid="custom-loading">Loading...</div>}
        <div>
          {(props.customMetrics as unknown[])?.length || 0} custom metrics
        </div>
      </>
    );
  };
});

const mockColumnProfilerData: ColumnProfile[] = [
  {
    name: 'test_column',
    timestamp: 1704067200000,
    valuesCount: 1000,
    nullCount: 10,
    min: 1,
    max: 100,
    mean: 50.5,
    histogram: {
      boundaries: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      frequencies: [100, 90, 80, 70, 60, 50, 40, 30, 20, 10],
    },
    cardinalityDistribution: {
      categories: ['low', 'medium', 'high'],
      counts: [300, 400, 300],
    },
  },
  {
    name: 'test_column',
    timestamp: 1703980800000,
    valuesCount: 950,
    nullCount: 15,
    min: 0,
    max: 95,
    mean: 47.5,
    histogram: {
      boundaries: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      frequencies: [95, 85, 75, 65, 55, 45, 35, 25, 15, 5],
    },
  },
];

const mockStringColumnProfilerData: ColumnProfile[] = [
  {
    name: 'string_column',
    timestamp: 1704067200000,
    valuesCount: 500,
    nullCount: 5,
    min: 'apple',
    max: 'zebra',
    distinctCount: 450,
  },
];

const mockDateRangeObject: DateRangeObject = {
  startTs: 1703980800000,
  endTs: 1704067200000,
  key: 'last_7_days',
};

const mockTableDetails: Table = {
  id: 'table-id',
  name: 'test_table',
  fullyQualifiedName: 'db.schema.test_table',
  columns: [],
  customMetrics: [
    {
      id: 'metric-1',
      name: 'custom_metric_1',
      expression: 'SELECT COUNT(*) FROM test_table',
      updatedAt: 1704067200000,
      updatedBy: 'admin',
    },
  ],
} as Table;

const mockPermissions: OperationPermission = Object.values(Operation).reduce(
  (acc, operation) => ({ ...acc, [operation]: true }),
  {} as OperationPermission
);

const defaultTableProfilerContext = {
  permissions: mockPermissions,
  isTestsLoading: false,
  isProfilerDataLoading: false,
  customMetric: undefined,
  allTestCases: [],
  overallSummary: [],
  onTestCaseUpdate: jest.fn(),
  onSettingButtonClick: jest.fn(),
  fetchAllTests: jest.fn(),
  onCustomMetricUpdate: jest.fn(),
  isProfilingEnabled: true,
  dateRangeObject: { startTs: 0, endTs: 0, key: '' },
  onDateRangeChange: jest.fn(),
  testCasePaging: {
    currentPage: 1,
    paging: { total: 0 },
    pageSize: 10,
    showPagination: false,
    handlePageChange: jest.fn(),
    handlePagingChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
    pagingCursor: {
      cursorType: undefined,
      cursorValue: undefined,
      currentPage: '1',
      pageSize: 10,
    },
  },
  isTestCaseDrawerOpen: false,
  onTestCaseDrawerOpen: jest.fn(),
};

const mockGetColumnProfilerList = getColumnProfilerList as jest.MockedFunction<
  typeof getColumnProfilerList
>;
const mockUseTableProfiler = useTableProfiler as jest.MockedFunction<
  typeof useTableProfiler
>;
const mockShowErrorToast = showErrorToast as jest.MockedFunction<
  typeof showErrorToast
>;

describe('SingleColumnProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTableProfiler.mockReturnValue(defaultTableProfilerContext);
    mockGetColumnProfilerList.mockResolvedValue({
      data: mockColumnProfilerData,
      paging: { total: mockColumnProfilerData.length },
    });
  });

  const defaultProps = {
    activeColumnFqn: 'db.schema.test_table.test_column',
    dateRangeObject: mockDateRangeObject,
    tableDetails: mockTableDetails,
  };

  describe('Rendering', () => {
    it('should render all profiler detail cards', async () => {
      render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('profiler-tab-container')
        ).toBeInTheDocument();
      });

      expect(
        screen.getByTestId('profiler-details-card-count')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('profiler-details-card-proportion')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('profiler-details-card-math')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('profiler-details-card-sum')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('profiler-details-card-quartile')
      ).toBeInTheDocument();
      expect(screen.getByTestId('custom-metric-graphs')).toBeInTheDocument();
    });

    it('should render histogram section when histogram data is available', async () => {
      render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('histogram-metrics')).toBeInTheDocument();
      });

      expect(screen.getByTestId('data-distribution-title')).toBeInTheDocument();
      expect(
        screen.getByTestId('data-distribution-histogram')
      ).toBeInTheDocument();
    });

    it('should render cardinality distribution section when cardinality data is available', async () => {
      render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('cardinality-distribution-metrics')
        ).toBeInTheDocument();
      });

      expect(
        screen.getByTestId('cardinality-distribution-title')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('cardinality-distribution-chart')
      ).toBeInTheDocument();
    });

    it('should not render histogram section when no histogram data', async () => {
      mockGetColumnProfilerList.mockResolvedValue({
        data: [{ ...mockColumnProfilerData[0], histogram: undefined }],
        paging: { total: 1 },
      });

      render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('profiler-tab-container')
        ).toBeInTheDocument();
      });

      expect(screen.queryByTestId('histogram-metrics')).not.toBeInTheDocument();
    });

    it('should not render cardinality section when no cardinality data', async () => {
      mockGetColumnProfilerList.mockResolvedValue({
        data: [
          { ...mockColumnProfilerData[0], cardinalityDistribution: undefined },
        ],
        paging: { total: 1 },
      });

      render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('profiler-tab-container')
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId('cardinality-distribution-metrics')
      ).not.toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state initially', () => {
      render(<SingleColumnProfile {...defaultProps} />);

      expect(screen.getAllByTestId('loading')).toHaveLength(5);
    });

    it('should show loading state from TableProfiler context', async () => {
      mockUseTableProfiler.mockReturnValue({
        ...defaultTableProfilerContext,
        isProfilerDataLoading: true,
      });

      render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('custom-loading')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch column profiler data with correct parameters', async () => {
      render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(mockGetColumnProfilerList).toHaveBeenCalledWith(
          'db.schema.test_table.test_column',
          { startTs: 1703980800000, endTs: 1704067200000 }
        );
      });
    });

    it('should fetch data with default range when dateRangeObject is not provided', async () => {
      render(
        <SingleColumnProfile
          {...defaultProps}
          dateRangeObject={undefined as unknown as DateRangeObject}
        />
      );

      await waitFor(() => {
        expect(mockGetColumnProfilerList).toHaveBeenCalledWith(
          'db.schema.test_table.test_column',
          expect.objectContaining({
            startTs: expect.any(Number),
            endTs: expect.any(Number),
          })
        );
      });
    });

    it('should not fetch data when activeColumnFqn is empty', async () => {
      render(<SingleColumnProfile {...defaultProps} activeColumnFqn="" />);

      expect(mockGetColumnProfilerList).not.toHaveBeenCalled();
    });

    it('should refetch data when activeColumnFqn changes', async () => {
      const { rerender } = render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(mockGetColumnProfilerList).toHaveBeenCalledTimes(1);
      });

      rerender(
        <SingleColumnProfile
          {...defaultProps}
          activeColumnFqn="db.schema.test_table.new_column"
        />
      );

      await waitFor(() => {
        expect(mockGetColumnProfilerList).toHaveBeenCalledTimes(2);
        expect(mockGetColumnProfilerList).toHaveBeenLastCalledWith(
          'db.schema.test_table.new_column',
          { startTs: 1703980800000, endTs: 1704067200000 }
        );
      });
    });

    it('should refetch data when dateRangeObject changes', async () => {
      const { rerender } = render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(mockGetColumnProfilerList).toHaveBeenCalledTimes(1);
      });

      const newDateRange = {
        startTs: 1703894400000,
        endTs: 1703980800000,
        key: 'last_1_day',
      };

      rerender(
        <SingleColumnProfile {...defaultProps} dateRangeObject={newDateRange} />
      );

      await waitFor(() => {
        expect(mockGetColumnProfilerList).toHaveBeenCalledTimes(2);
        expect(mockGetColumnProfilerList).toHaveBeenLastCalledWith(
          'db.schema.test_table.test_column',
          { startTs: 1703894400000, endTs: 1703980800000 }
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error toast when API call fails', async () => {
      const error = new AxiosError('API Error');
      mockGetColumnProfilerList.mockRejectedValue(error);

      render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(error);
      });
    });

    it('should set loading to false after error', async () => {
      const error = new AxiosError('API Error');
      mockGetColumnProfilerList.mockRejectedValue(error);

      render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });
    });
  });

  describe('String Data Handling', () => {
    it('should handle string min/max values correctly', async () => {
      mockGetColumnProfilerList.mockResolvedValue({
        data: mockStringColumnProfilerData,
        paging: { total: mockStringColumnProfilerData.length },
      });

      render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('profiler-tab-container')
        ).toBeInTheDocument();
      });
    });
  });

  describe('No Data States', () => {
    it('should show appropriate message when profiling is enabled but no data', async () => {
      mockGetColumnProfilerList.mockResolvedValue({
        data: [],
        paging: { total: 0 },
      });

      render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('profiler-tab-container')
        ).toBeInTheDocument();
      });
    });

    it('should show documentation link when profiling is disabled', async () => {
      mockUseTableProfiler.mockReturnValue({
        ...defaultTableProfilerContext,
        isProfilingEnabled: false,
      });
      mockGetColumnProfilerList.mockResolvedValue({
        data: [],
        paging: { total: 0 },
      });

      render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('profiler-tab-container')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Custom Metrics Integration', () => {
    it('should use custom metrics from tableDetails when provided', async () => {
      render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('custom-metric-graphs')).toBeInTheDocument();
      });

      expect(screen.getByTestId('custom-metric-graphs')).toBeInTheDocument();
    });

    it('should fallback to custom metrics from context when tableDetails not provided', async () => {
      mockUseTableProfiler.mockReturnValue({
        ...defaultTableProfilerContext,
        customMetric: mockTableDetails,
      });

      render(
        <SingleColumnProfile {...defaultProps} tableDetails={undefined} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('custom-metric-graphs')).toBeInTheDocument();
      });
    });

    it('should handle empty custom metrics array', async () => {
      render(
        <SingleColumnProfile
          {...defaultProps}
          tableDetails={{ ...mockTableDetails, customMetrics: undefined }}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('custom-metric-graphs')).toBeInTheDocument();
      });

      expect(screen.getByTestId('custom-metric-graphs')).toBeInTheDocument();
    });
  });

  describe('Data Processing', () => {
    it('should process first and last day data correctly', async () => {
      render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('data-distribution-histogram')
        ).toBeInTheDocument();
      });

      expect(screen.getByText('Histogram Data')).toBeInTheDocument();
    });

    it('should handle single data point correctly', async () => {
      mockGetColumnProfilerList.mockResolvedValue({
        data: [mockColumnProfilerData[0]],
        paging: { total: 1 },
      });

      render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('profiler-tab-container')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Component Updates', () => {
    it('should update metrics when column profiler data changes', async () => {
      const { rerender } = render(<SingleColumnProfile {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('profiler-tab-container')
        ).toBeInTheDocument();
      });

      mockGetColumnProfilerList.mockResolvedValue({
        data: [mockStringColumnProfilerData[0]],
        paging: { total: 1 },
      });

      rerender(
        <SingleColumnProfile
          {...defaultProps}
          activeColumnFqn="db.schema.test_table.string_column"
        />
      );

      await waitFor(() => {
        expect(mockGetColumnProfilerList).toHaveBeenCalledWith(
          'db.schema.test_table.string_column',
          { startTs: 1703980800000, endTs: 1704067200000 }
        );
      });
    });
  });
});
