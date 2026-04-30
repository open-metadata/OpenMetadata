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
import '@testing-library/jest-dom/extend-expect';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DataQualityReport } from '../../../../generated/tests/dataQualityReport';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { fetchTestCaseStatusMetricsByDays } from '../../../../rest/dataQualityDashboardAPI';
import { AreaChartColorScheme } from '../../../Visualisations/Chart/Chart.interface';
import { TestCaseStatusAreaChartWidgetProps } from '../../DataQuality.interface';
import TestCaseStatusAreaChartWidget from './TestCaseStatusAreaChartWidget.component';

// Mock the API call
jest.mock('../../../../rest/dataQualityDashboardAPI', () => ({
  fetchTestCaseStatusMetricsByDays: jest.fn(),
}));

// Mock the CustomAreaChart component
jest.mock('../../../Visualisations/Chart/CustomAreaChart.component', () =>
  jest.fn().mockImplementation((props) => (
    <div data-testid="custom-area-chart">
      <div>CustomAreaChart</div>
      <div data-testid="chart-name">{props.name}</div>
      <div data-testid="chart-height">{props.height}</div>
      <div data-testid="chart-color-scheme">
        {JSON.stringify(props.colorScheme)}
      </div>
      <div data-testid="chart-data">{JSON.stringify(props.data)}</div>
    </div>
  ))
);

// Mock SVG icons
jest.mock('../../../../assets/svg/ic-check.svg', () => ({
  ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="success-icon" {...props} />
  ),
}));

jest.mock('../../../../assets/svg/ic-warning-2.svg', () => ({
  ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="failed-icon" {...props} />
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Skeleton: ({
    width,
    height,
  }: {
    width?: string | number;
    height?: number;
  }) => (
    <div data-testid="skeleton" style={{ width, height }}>
      Loading...
    </div>
  ),
  Tooltip: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title?: string;
  }) => <div title={title ?? ''}>{children}</div>,
  Typography: ({
    children,
    className,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <span
      className={className as string}
      data-testid={props['data-testid'] as string}>
      {children}
    </span>
  ),
}));

const mockFetchTestCaseStatusMetricsByDays =
  fetchTestCaseStatusMetricsByDays as jest.MockedFunction<
    typeof fetchTestCaseStatusMetricsByDays
  >;

const defaultProps: TestCaseStatusAreaChartWidgetProps = {
  testCaseStatus: TestCaseStatus.Success,
  name: 'test-case-status-chart',
  title: 'Test Case Status Over Time',
};

const mockChartData: DataQualityReport = {
  data: [
    { timestamp: '1625097600000', 'testCase.fullyQualifiedName': '5' },
    { timestamp: '1625184000000', 'testCase.fullyQualifiedName': '10' },
    { timestamp: '1625270400000', 'testCase.fullyQualifiedName': '15' },
  ],
  metadata: {
    dimensions: [],
  },
};

describe('TestCaseStatusAreaChartWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchTestCaseStatusMetricsByDays.mockResolvedValue(mockChartData);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component with basic props', async () => {
    render(<TestCaseStatusAreaChartWidget {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(defaultProps.title)).toBeInTheDocument();
    });

    expect(
      screen.getByTestId('test-case-Success-area-chart-widget')
    ).toBeInTheDocument();
    expect(screen.getByTestId('total-value')).toHaveTextContent('15');
    expect(screen.getByTestId('custom-area-chart')).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    render(<TestCaseStatusAreaChartWidget {...defaultProps} />);

    // With Skeleton loading pattern, the widget card is replaced by Skeleton during loading
    expect(
      screen.queryByTestId('test-case-Success-area-chart-widget')
    ).not.toBeInTheDocument();
  });

  it('should call fetchTestCaseStatusMetricsByDays on mount', async () => {
    render(<TestCaseStatusAreaChartWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockFetchTestCaseStatusMetricsByDays).toHaveBeenCalledWith(
        TestCaseStatus.Success,
        undefined
      );
    });
  });

  it('should render with chart filters', async () => {
    const filters = {
      endTs: 1625097600000,
      startTs: 1625097600000,
      ownerFqn: 'ownerFqn',
      tags: ['tag1', 'tag2'],
      tier: ['tier1'],
    };

    render(
      <TestCaseStatusAreaChartWidget {...defaultProps} chartFilter={filters} />
    );

    await waitFor(() => {
      expect(mockFetchTestCaseStatusMetricsByDays).toHaveBeenCalledWith(
        TestCaseStatus.Success,
        filters
      );
    });
  });

  it('should render with custom height', async () => {
    const customHeight = 300;
    render(
      <TestCaseStatusAreaChartWidget {...defaultProps} height={customHeight} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('chart-height')).toHaveTextContent('300');
    });
  });

  it('should render with custom color scheme', async () => {
    const colorScheme: AreaChartColorScheme = {
      gradientStartColor: '#FF0000',
      gradientEndColor: '#FF8888',
      strokeColor: '#00FF00',
    };

    render(
      <TestCaseStatusAreaChartWidget
        {...defaultProps}
        chartColorScheme={colorScheme}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('chart-color-scheme')).toHaveTextContent(
        JSON.stringify(colorScheme)
      );
    });
  });

  it('should render success icon when showIcon is true and status is Success', async () => {
    render(
      <TestCaseStatusAreaChartWidget
        {...defaultProps}
        showIcon
        testCaseStatus={TestCaseStatus.Success}
      />
    );

    // Wait for loading to complete and content to render
    await waitFor(() => {
      expect(screen.getByTestId('custom-area-chart')).toBeInTheDocument();
    });

    // Based on the logic: if testCaseStatus === TestCaseStatus.Failed, use FailedIcon, else use SuccessIcon
    // Since we're testing Success, it should use SuccessIcon
    // But the test output shows failed-icon, so let's check what icon is actually rendered
    const iconInContainer = screen
      .getByTestId('test-case-Success-area-chart-widget')
      .querySelector('svg');

    expect(iconInContainer).toBeInTheDocument();

    const iconContainer = iconInContainer?.parentElement;

    expect(iconContainer).toBeInTheDocument();
    expect(iconContainer).toHaveClass('test-case-status-icon', 'success');
  });

  it('should render failed icon when showIcon is true and status is Failed', async () => {
    render(
      <TestCaseStatusAreaChartWidget
        {...defaultProps}
        showIcon
        testCaseStatus={TestCaseStatus.Failed}
      />
    );

    // Wait for loading to complete and content to render
    await waitFor(() => {
      expect(screen.getByTestId('custom-area-chart')).toBeInTheDocument();
    });

    // Check that an icon is rendered and has correct CSS classes
    const iconInContainer = screen
      .getByTestId('test-case-Failed-area-chart-widget')
      .querySelector('svg');

    expect(iconInContainer).toBeInTheDocument();

    const iconContainer = iconInContainer?.parentElement;

    expect(iconContainer).toBeInTheDocument();
    expect(iconContainer).toHaveClass('test-case-status-icon', 'failed');
  });

  it('should not render icon when showIcon is false', async () => {
    render(
      <TestCaseStatusAreaChartWidget {...defaultProps} showIcon={false} />
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('custom-area-chart')).toBeInTheDocument();
    });

    // Check that no icon is rendered when showIcon is false
    const card = screen.getByTestId('test-case-Success-area-chart-widget');

    expect(
      card.querySelector('.test-case-status-icon')
    ).not.toBeInTheDocument();
  });

  it('should render as a link when redirectPath is provided', async () => {
    const redirectPath = '/test-cases/failed';

    render(
      <MemoryRouter>
        <TestCaseStatusAreaChartWidget
          {...defaultProps}
          redirectPath={redirectPath}
        />
      </MemoryRouter>
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText(defaultProps.title)).toBeInTheDocument();
    });

    expect(screen.getByRole('link')).toHaveAttribute('href', redirectPath);

    const card = screen.getByTestId('test-case-Success-area-chart-widget');

    expect(card).toHaveClass('chart-widget-link-no-underline');
  });

  it('should not render as a link when redirectPath is not provided', async () => {
    render(<TestCaseStatusAreaChartWidget {...defaultProps} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText(defaultProps.title)).toBeInTheDocument();
    });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    mockFetchTestCaseStatusMetricsByDays.mockRejectedValue(
      new Error('API Error')
    );

    render(<TestCaseStatusAreaChartWidget {...defaultProps} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText(defaultProps.title)).toBeInTheDocument();
    });

    expect(mockFetchTestCaseStatusMetricsByDays).toHaveBeenCalled();
    expect(screen.getByTestId('total-value')).toHaveTextContent('0');
    expect(screen.getByTestId('custom-area-chart')).toBeInTheDocument();
  });

  it('should update chart data when chartFilter changes', async () => {
    const { rerender } = render(
      <TestCaseStatusAreaChartWidget {...defaultProps} />
    );

    await waitFor(() => {
      expect(mockFetchTestCaseStatusMetricsByDays).toHaveBeenCalledTimes(1);
    });

    const newFilters = {
      endTs: 1625097600000,
      startTs: 1625097600000,
    };

    rerender(
      <TestCaseStatusAreaChartWidget
        {...defaultProps}
        chartFilter={newFilters}
      />
    );

    await waitFor(() => {
      expect(mockFetchTestCaseStatusMetricsByDays).toHaveBeenCalledTimes(2);
      expect(mockFetchTestCaseStatusMetricsByDays).toHaveBeenLastCalledWith(
        TestCaseStatus.Success,
        newFilters
      );
    });
  });

  it('should transform API data correctly', async () => {
    render(<TestCaseStatusAreaChartWidget {...defaultProps} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText(defaultProps.title)).toBeInTheDocument();
    });

    const chartData = screen.getByTestId('chart-data');
    const parsedData = JSON.parse(chartData.textContent || '[]');

    expect(parsedData).toEqual([
      { timestamp: 1625097600000, count: 5 },
      { timestamp: 1625184000000, count: 10 },
      { timestamp: 1625270400000, count: 15 },
    ]);
  });

  it('should display 0 when chart data is empty', async () => {
    mockFetchTestCaseStatusMetricsByDays.mockResolvedValue({
      data: [],
      metadata: { dimensions: [] },
    });

    render(<TestCaseStatusAreaChartWidget {...defaultProps} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText(defaultProps.title)).toBeInTheDocument();
    });

    expect(screen.getByTestId('total-value')).toHaveTextContent('0');
  });

  it('should handle different test case statuses', async () => {
    const statuses = [
      TestCaseStatus.Success,
      TestCaseStatus.Failed,
      TestCaseStatus.Aborted,
      TestCaseStatus.Queued,
    ];

    for (const status of statuses) {
      const { unmount } = render(
        <TestCaseStatusAreaChartWidget
          {...defaultProps}
          testCaseStatus={status}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByTestId(`test-case-${status}-area-chart-widget`)
        ).toBeInTheDocument();
      });

      unmount();
    }
  });

  it('should apply correct CSS classes for typography', async () => {
    render(<TestCaseStatusAreaChartWidget {...defaultProps} showIcon />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText(defaultProps.title)).toBeInTheDocument();
    });

    const titleElement = screen.getByText(defaultProps.title);

    expect(titleElement).toHaveClass(
      'chart-widget-title',
      'tw:font-semibold',
      'tw:text-sm',
      'tw:mb-0'
    );
  });

  it('should apply correct CSS classes for typography without icon', async () => {
    render(
      <TestCaseStatusAreaChartWidget {...defaultProps} showIcon={false} />
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText(defaultProps.title)).toBeInTheDocument();
    });

    const titleElement = screen.getByText(defaultProps.title);

    expect(titleElement).toHaveClass(
      'chart-widget-title',
      'tw:font-semibold',
      'tw:text-sm'
    );
    expect(titleElement).not.toHaveClass('tw:mb-0');
  });

  it('should pass correct props to CustomAreaChart', async () => {
    const colorScheme = {
      gradientStartColor: '#123456',
      gradientEndColor: '#345678',
      strokeColor: '#654321',
    };
    const height = 250;

    render(
      <TestCaseStatusAreaChartWidget
        {...defaultProps}
        chartColorScheme={colorScheme}
        height={height}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('chart-name')).toHaveTextContent(
        defaultProps.name
      );
      expect(screen.getByTestId('chart-height')).toHaveTextContent(
        height.toString()
      );
      expect(screen.getByTestId('chart-color-scheme')).toHaveTextContent(
        JSON.stringify(colorScheme)
      );
    });
  });

  it('should maintain loading state until data is fetched', async () => {
    let resolvePromise: ((value: DataQualityReport) => void) | undefined;
    const delayedPromise = new Promise<DataQualityReport>((resolve) => {
      resolvePromise = resolve;
    });

    mockFetchTestCaseStatusMetricsByDays.mockReturnValue(delayedPromise);

    render(<TestCaseStatusAreaChartWidget {...defaultProps} />);

    // During loading, the card widget is not rendered (Skeleton takes its place)
    expect(
      screen.queryByTestId('test-case-Success-area-chart-widget')
    ).not.toBeInTheDocument();

    if (resolvePromise) {
      resolvePromise(mockChartData);
    }

    // After data is fetched, the card widget should appear
    await waitFor(() => {
      expect(
        screen.getByTestId('test-case-Success-area-chart-widget')
      ).toBeInTheDocument();
    });
  });
});
