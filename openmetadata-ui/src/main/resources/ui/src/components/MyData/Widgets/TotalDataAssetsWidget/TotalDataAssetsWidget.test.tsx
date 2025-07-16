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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AxiosError } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { CHART_WIDGET_DAYS_DURATION } from '../../../../constants/constants';
import { SystemChartType } from '../../../../enums/DataInsight.enum';
import {
  DataInsightCustomChartResult,
  getChartPreviewByName,
} from '../../../../rest/DataInsightAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import TotalDataAssetsWidget from './TotalDataAssetsWidget.component';
import { TotalDataAssetsWidgetProps } from './TotalDataAssetsWidget.interface';

// Mock dependencies
jest.mock('../../../../rest/DataInsightAPI', () => ({
  getChartPreviewByName: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  customFormatDateTime: jest.fn((timestamp: number, format: string) => {
    const date = new Date(timestamp);
    if (format === 'dd MMM') {
      return `${date
        .getDate()
        .toString()
        .padStart(2, '0')} ${date.toLocaleDateString('en', {
        month: 'short',
      })}`;
    }

    return date.toLocaleDateString();
  }),
  getCurrentMillis: jest.fn(() => 1640995200000), // 2022-01-01
  getEpochMillisForPastDays: jest.fn(
    (days: number) => 1640995200000 - days * 24 * 60 * 60 * 1000
  ),
}));

jest.mock('../Common/WidgetWrapper/WidgetWrapper', () => {
  return jest.fn().mockImplementation(({ children, loading, dataLength }) => (
    <div
      data-length={dataLength}
      data-loading={loading}
      data-testid="widget-wrapper">
      {children}
    </div>
  ));
});

jest.mock('../Common/WidgetHeader/WidgetHeader', () => {
  return jest
    .fn()
    .mockImplementation(
      ({ title, handleRemoveWidget, isEditView, widgetKey }) => (
        <div data-testid="widget-header">
          <span>{title}</span>
          {isEditView && (
            <button
              data-testid="remove-widget-button"
              onClick={() => handleRemoveWidget?.(widgetKey)}>
              Remove
            </button>
          )}
        </div>
      )
    );
});

jest.mock('../Common/WidgetEmptyState/WidgetEmptyState', () => {
  return jest
    .fn()
    .mockImplementation(({ title, description, actionButtonText }) => (
      <div data-testid="widget-empty-state">
        <div>{title}</div>
        <div>{description}</div>
        <button>{actionButtonText}</button>
      </div>
    ));
});

// Mock Recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ data }: { data: any[] }) => (
    <div data-length={data.length} data-testid="pie">
      {data.map((item, index) => (
        <div data-testid={`pie-cell-${item.name}`} key={index}>
          {item.name}: {item.value}
        </div>
      ))}
    </div>
  ),
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

// Mock chart data
const mockChartData: DataInsightCustomChartResult = {
  results: [
    {
      count: 150,
      day: 1640995200000, // 2022-01-01
      group: 'table',
      term: 'table',
    },
    {
      count: 75,
      day: 1640995200000,
      group: 'dashboard',
      term: 'dashboard',
    },
    {
      count: 200,
      day: 1641081600000, // 2022-01-02
      group: 'table',
      term: 'table',
    },
    {
      count: 100,
      day: 1641081600000,
      group: 'dashboard',
      term: 'dashboard',
    },
    {
      count: 50,
      day: 1641081600000,
      group: 'pipeline',
      term: 'pipeline',
    },
  ],
};

const defaultProps: TotalDataAssetsWidgetProps = {
  widgetKey: 'test-widget-key',
  isEditView: false,
  selectedDays: CHART_WIDGET_DAYS_DURATION,
  currentLayout: [
    {
      i: 'test-widget-key',
      x: 0,
      y: 0,
      w: 2,
      h: 4,
    },
  ],
  handleRemoveWidget: jest.fn(),
  handleLayoutUpdate: jest.fn(),
};

const renderTotalDataAssetsWidget = (
  props: Partial<TotalDataAssetsWidgetProps> = {}
) => {
  return render(
    <MemoryRouter>
      <TotalDataAssetsWidget {...defaultProps} {...props} />
    </MemoryRouter>
  );
};

describe('TotalDataAssetsWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getChartPreviewByName as jest.Mock).mockResolvedValue(mockChartData);
  });

  describe('Component Rendering', () => {
    it('should render the widget with header and wrapper', async () => {
      await act(async () => {
        renderTotalDataAssetsWidget();
      });

      expect(screen.getByTestId('widget-wrapper')).toBeInTheDocument();
      expect(screen.getByTestId('widget-header')).toBeInTheDocument();
      expect(
        screen.getByText('label.data-insight-total-entity-summary')
      ).toBeInTheDocument();
    });

    it('should render empty state when no data is available', async () => {
      (getChartPreviewByName as jest.Mock).mockResolvedValue({ results: [] });

      await act(async () => {
        renderTotalDataAssetsWidget();
      });

      expect(screen.getByTestId('widget-empty-state')).toBeInTheDocument();
      expect(
        screen.getByText('label.no-data-assets-to-display')
      ).toBeInTheDocument();
      expect(
        screen.getByText('message.no-data-for-total-assets')
      ).toBeInTheDocument();
    });
  });

  describe('Data Fetching', () => {
    it('should fetch chart data on component mount', async () => {
      await act(async () => {
        renderTotalDataAssetsWidget();
      });

      expect(getChartPreviewByName).toHaveBeenCalledWith(
        SystemChartType.TotalDataAssets,
        expect.objectContaining({
          start: expect.any(Number),
          end: expect.any(Number),
        })
      );
    });

    it('should refetch data when selectedDays prop changes', async () => {
      const { rerender } = renderTotalDataAssetsWidget({ selectedDays: 7 });

      await act(async () => {
        rerender(
          <MemoryRouter>
            <TotalDataAssetsWidget {...defaultProps} selectedDays={30} />
          </MemoryRouter>
        );
      });

      await waitFor(() => {
        expect(getChartPreviewByName).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle API error gracefully', async () => {
      const mockError = new AxiosError('Network Error');
      (getChartPreviewByName as jest.Mock).mockRejectedValue(mockError);

      await act(async () => {
        renderTotalDataAssetsWidget();
      });

      expect(showErrorToast).toHaveBeenCalledWith(mockError);
    });

    it('should show loading state while fetching data', async () => {
      (getChartPreviewByName as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(mockChartData), 100)
          )
      );

      renderTotalDataAssetsWidget();

      const wrapper = screen.getByTestId('widget-wrapper');

      expect(wrapper).toHaveAttribute('data-loading', 'true');
    });
  });

  describe('Chart Rendering', () => {
    it('should render pie chart with data', async () => {
      await act(async () => {
        renderTotalDataAssetsWidget();
      });

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      expect(screen.getByTestId('pie')).toBeInTheDocument();
    });

    it('should display total data assets count in center of donut chart', async () => {
      await act(async () => {
        renderTotalDataAssetsWidget();
      });

      // For the latest date (1641081600000), total should be 200 + 100 + 50 = 350
      expect(screen.getByText('350')).toBeInTheDocument();
    });

    it('should render legend when widget is full size', async () => {
      await act(async () => {
        renderTotalDataAssetsWidget({
          currentLayout: [
            {
              i: 'test-widget-key',
              x: 0,
              y: 0,
              w: 2, // Full width
              h: 4,
            },
          ],
        });
      });

      // Should show legend with entity types and counts
      expect(screen.getByText('Table')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Pipeline')).toBeInTheDocument();
    });

    it('should not render legend when widget is not full size', async () => {
      await act(async () => {
        renderTotalDataAssetsWidget({
          currentLayout: [
            {
              i: 'test-widget-key',
              x: 0,
              y: 0,
              w: 1, // Half width
              h: 4,
            },
          ],
        });
      });

      // Legend should not be visible for smaller widgets
      const legendElements = screen.queryAllByText('table');

      expect(legendElements.length).toBeLessThanOrEqual(1); // Only in pie chart data
    });
  });

  describe('Date Selection', () => {
    it('should render date selector with available dates', async () => {
      await act(async () => {
        renderTotalDataAssetsWidget();
      });

      expect(screen.getByText('01')).toBeInTheDocument(); // Day from formatted date
      expect(screen.getByText('02')).toBeInTheDocument(); // Day from formatted date
    });

    it('should auto-select the latest date on data load', async () => {
      await act(async () => {
        renderTotalDataAssetsWidget();
      });

      // The latest date should be selected and show its total
      expect(screen.getByText('350')).toBeInTheDocument(); // 200 + 100 + 50
    });

    it('should update chart data when a different date is selected', async () => {
      await act(async () => {
        renderTotalDataAssetsWidget();
      });

      // Find and click on the first date
      const firstDateBox = screen.getByText('01').closest('.date-box');

      expect(firstDateBox).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(firstDateBox!);
      });

      // Should now show data for the first date (150 + 75 = 225)
      await waitFor(() => {
        expect(screen.getByText('225')).toBeInTheDocument();
      });
    });

    it('should highlight selected date', async () => {
      await act(async () => {
        renderTotalDataAssetsWidget();
      });

      const dateBoxes = screen.getAllByText('02')[0].closest('.date-box');

      expect(dateBoxes).toHaveClass('selected');
    });
  });

  describe('Widget Configuration', () => {
    it('should use default selected days when not provided', async () => {
      await act(async () => {
        renderTotalDataAssetsWidget({ selectedDays: undefined });
      });

      expect(getChartPreviewByName).toHaveBeenCalledWith(
        SystemChartType.TotalDataAssets,
        expect.objectContaining({
          start: expect.any(Number),
          end: expect.any(Number),
        })
      );
    });

    it('should use custom selected days when provided', async () => {
      await act(async () => {
        renderTotalDataAssetsWidget({ selectedDays: 30 });
      });

      expect(getChartPreviewByName).toHaveBeenCalledWith(
        SystemChartType.TotalDataAssets,
        expect.objectContaining({
          start: expect.any(Number),
          end: expect.any(Number),
        })
      );
    });

    it('should pass correct props to WidgetWrapper', async () => {
      await act(async () => {
        renderTotalDataAssetsWidget();
      });

      const wrapper = screen.getByTestId('widget-wrapper');

      expect(wrapper).toHaveAttribute('data-loading', 'false');
      expect(wrapper).toHaveAttribute('data-length', '2'); // Two unique dates
    });
  });
});
