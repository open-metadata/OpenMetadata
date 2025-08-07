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

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SystemChartType } from '../../../enums/DataInsight.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { getTitleByChartType } from '../../../utils/ServiceInsightsTabUtils';
import { getReadableCountString } from '../../../utils/ServiceUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import PlatformInsightsWidget from './PlatformInsightsWidget';
import { PlatformInsightsWidgetProps } from './PlatformInsightsWidget.interface';

// Mock dependencies
jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(),
}));

jest.mock('../../../utils/ServiceInsightsTabUtils', () => ({
  getTitleByChartType: jest.fn(),
}));

jest.mock('../../../utils/ServiceUtils', () => ({
  getReadableCountString: jest.fn(),
}));

// Mock SVG components
jest.mock('../../../assets/svg/ic-arrow-down.svg', () => {
  return {
    __esModule: true,
    ReactComponent: () => <div data-testid="arrow-down-icon" />,
  };
});

jest.mock('../../../assets/svg/ic-trend-up.svg', () => {
  return {
    __esModule: true,
    ReactComponent: () => <div data-testid="arrow-up-icon" />,
  };
});

const mockUseRequiredParams = useRequiredParams as jest.MockedFunction<any>;

const mockGetTitleByChartType = getTitleByChartType as jest.MockedFunction<
  typeof getTitleByChartType
>;

const mockGetReadableCountString =
  getReadableCountString as jest.MockedFunction<typeof getReadableCountString>;

describe('PlatformInsightsWidget', () => {
  const mockServiceDetails = {
    id: 'test-service-id',
    name: 'test-service',
    serviceType: 'Mysql' as any,
    fullyQualifiedName: 'test-service-fqn',
  } as any;

  const mockChartsData = [
    {
      chartType: SystemChartType.DescriptionCoverage,
      currentPercentage: 85,
      percentageChange: 5,
      isIncreased: true,
      numberOfDays: 7,
    },
    {
      chartType: SystemChartType.PIICoverage,
      currentPercentage: 60,
      percentageChange: -2,
      isIncreased: false,
      numberOfDays: 7,
    },
    {
      chartType: SystemChartType.TierCoverage,
      currentPercentage: 75,
      percentageChange: 0,
      isIncreased: true,
      numberOfDays: 1,
    },
    {
      chartType: SystemChartType.OwnersCoverage,
      currentPercentage: 90,
      percentageChange: 10,
      isIncreased: true,
      numberOfDays: 30,
    },
  ];

  const defaultProps: PlatformInsightsWidgetProps = {
    chartsData: mockChartsData,
    isLoading: false,
    serviceDetails: mockServiceDetails,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRequiredParams.mockReturnValue({
      serviceCategory: ServiceCategory.DATABASE_SERVICES,
    });
    mockGetTitleByChartType.mockImplementation(
      (chartType) => `Title for ${chartType}`
    );
    mockGetReadableCountString.mockImplementation((value) => value.toString());
  });

  const renderComponent = (props = {}) => {
    return render(
      <MemoryRouter>
        <PlatformInsightsWidget {...defaultProps} {...props} />
      </MemoryRouter>
    );
  };

  describe('Component Rendering', () => {
    it('should render the component with correct header', () => {
      renderComponent();

      expect(
        screen.getByText('label.entity-insight-plural')
      ).toBeInTheDocument();
      expect(
        screen.getByText('message.platform-insight-description')
      ).toBeInTheDocument();
    });

    it('should render expand/collapse functionality', () => {
      renderComponent();

      const expandIcon = screen.getByText('label.view-more');

      expect(expandIcon).toBeInTheDocument();
    });

    it('should render the export class for platform insights chart', () => {
      renderComponent();

      const exportContainer = document.querySelector(
        '.export-platform-insights-chart'
      );

      expect(exportContainer).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should render skeleton loaders when isLoading is true', () => {
      renderComponent({ isLoading: true });

      // Should render 5 skeleton cards for database services (includes HealthyDataAssets)
      const skeletonCards = document.querySelectorAll('.ant-skeleton');

      expect(skeletonCards).toHaveLength(5);
    });

    it('should render skeleton loaders for non-database services', () => {
      mockUseRequiredParams.mockReturnValue({
        serviceCategory: ServiceCategory.MESSAGING_SERVICES,
      });
      renderComponent({ isLoading: true });

      // Should render 4 skeleton cards (excludes HealthyDataAssets for non-database services)
      const skeletonCards = document.querySelectorAll('.ant-skeleton');

      expect(skeletonCards).toHaveLength(4);
    });
  });

  describe('Chart Data Rendering', () => {
    it('should render all chart cards when data is available', () => {
      renderComponent();

      // Should render 4 chart cards for database services
      const chartCards = screen.getAllByText(/Title for/);

      expect(chartCards).toHaveLength(4);
    });

    it('should render chart cards for non-database services (excluding HealthyDataAssets)', () => {
      mockUseRequiredParams.mockReturnValue({
        serviceCategory: ServiceCategory.MESSAGING_SERVICES,
      });
      renderComponent();

      // Should render 4 chart cards (excludes HealthyDataAssets for non-database services)
      const chartCards = screen.getAllByText(/Title for/);

      expect(chartCards).toHaveLength(4);
    });

    it('should render chart titles correctly', () => {
      renderComponent();

      expect(mockGetTitleByChartType).toHaveBeenCalledWith(
        SystemChartType.DescriptionCoverage
      );
      expect(mockGetTitleByChartType).toHaveBeenCalledWith(
        SystemChartType.PIICoverage
      );
      expect(mockGetTitleByChartType).toHaveBeenCalledWith(
        SystemChartType.TierCoverage
      );
      expect(mockGetTitleByChartType).toHaveBeenCalledWith(
        SystemChartType.OwnersCoverage
      );
    });

    it('should render current percentage values', () => {
      renderComponent();

      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('90%')).toBeInTheDocument();
    });
  });

  describe('Percentage Change Display', () => {
    it('should render positive percentage change with green color and up arrow', () => {
      renderComponent();

      const positiveChange = screen.getByText('5%');

      expect(positiveChange).toBeInTheDocument();
      expect(positiveChange).toHaveStyle({ color: 'rgb(6, 118, 71)' }); // GREEN_1
    });

    it('should render negative percentage change with red color and down arrow', () => {
      renderComponent();

      const negativeChange = screen.getByText('-2%');

      expect(negativeChange).toBeInTheDocument();
      expect(negativeChange).toHaveStyle({ color: 'rgb(240, 68, 56)' }); // RED_1
    });

    it('should render percentage change text but not icon when value is 0', () => {
      const chartsDataWithZeroChange = [
        {
          chartType: SystemChartType.DescriptionCoverage,
          currentPercentage: 85,
          percentageChange: 0,
          isIncreased: true,
          numberOfDays: 7,
        },
      ];

      renderComponent({ chartsData: chartsDataWithZeroChange });

      // Should show the percentage change text
      expect(screen.getByText('0%')).toBeInTheDocument();

      // Should not show the icon (since showIcon = false when percentageChange === 0)
      const icons = screen.getAllByTestId('arrow-up-icon');

      expect(icons).toHaveLength(1); // Only the one from the header
    });

    it('should render percentage change icon correctly', () => {
      renderComponent();

      const upIcons = screen.getAllByTestId('arrow-up-icon');

      expect(upIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Time Period Display', () => {
    it('should render "in the last day" for single day', () => {
      renderComponent();

      expect(screen.getByText('label.in-the-last-day')).toBeInTheDocument();
    });

    it('should render "in last X days" for multiple days', () => {
      renderComponent();

      expect(screen.getAllByText('label.in-last-number-of-days')).toHaveLength(
        3
      ); // Multiple charts have this text
    });
  });

  describe('Service Category Filtering', () => {
    it('should include HealthyDataAssets chart for database services', () => {
      mockUseRequiredParams.mockReturnValue({
        serviceCategory: ServiceCategory.DATABASE_SERVICES,
      });

      const chartsDataWithHealthyAssets = [
        ...mockChartsData,
        {
          chartType: SystemChartType.HealthyDataAssets,
          currentPercentage: 95,
          percentageChange: 3,
          isIncreased: true,
          numberOfDays: 7,
        },
      ];

      renderComponent({ chartsData: chartsDataWithHealthyAssets });

      expect(mockGetTitleByChartType).toHaveBeenCalledWith(
        SystemChartType.HealthyDataAssets
      );
    });

    it('should exclude HealthyDataAssets chart for non-database services', () => {
      mockUseRequiredParams.mockReturnValue({
        serviceCategory: ServiceCategory.MESSAGING_SERVICES,
      });

      const chartsDataWithHealthyAssets = [
        ...mockChartsData,
        {
          chartType: SystemChartType.HealthyDataAssets,
          currentPercentage: 95,
          percentageChange: 3,
          isIncreased: true,
          numberOfDays: 7,
        },
      ];

      renderComponent({ chartsData: chartsDataWithHealthyAssets });

      expect(mockGetTitleByChartType).not.toHaveBeenCalledWith(
        SystemChartType.HealthyDataAssets
      );
    });
  });

  describe('Empty State', () => {
    it('should handle empty charts data', () => {
      renderComponent({ chartsData: [] });

      const chartCards = screen.queryAllByText(/Title for/);

      expect(chartCards).toHaveLength(0);
    });

    it('should handle undefined percentage change', () => {
      const chartsDataWithUndefinedChange = [
        {
          chartType: SystemChartType.DescriptionCoverage,
          currentPercentage: 85,
          percentageChange: undefined,
          isIncreased: true,
          numberOfDays: 7,
        },
      ];

      renderComponent({ chartsData: chartsDataWithUndefinedChange });

      // Should not render percentage change section
      expect(
        screen.queryByText('label.in-last-number-of-days')
      ).not.toBeInTheDocument();
    });
  });

  describe('CSS Classes and Styling', () => {
    it('should apply correct container class for 5 charts (database services)', () => {
      renderComponent();

      const colElement = document.querySelector('.other-charts-container');

      expect(colElement).toBeInTheDocument();
      expect(colElement).not.toHaveClass('four-chart-container');
    });

    it('should apply correct container class for non-4 charts', () => {
      const limitedChartsData = mockChartsData.slice(0, 2);
      renderComponent({ chartsData: limitedChartsData });

      const colElement = document.querySelector('.four-chart-container');

      expect(colElement).not.toBeInTheDocument();
    });

    it('should apply correct CSS classes to chart cards', () => {
      renderComponent();

      const chartCards = screen.getAllByText(/Title for/);
      chartCards.forEach((card) => {
        const cardElement = card.closest('.widget-info-card');

        expect(cardElement).toHaveClass('other-charts-card');
      });
    });
  });

  describe('Utility Function Calls', () => {
    it('should call getReadableCountString for current percentage', () => {
      renderComponent();

      expect(mockGetReadableCountString).toHaveBeenCalledWith(85);
      expect(mockGetReadableCountString).toHaveBeenCalledWith(60);
      expect(mockGetReadableCountString).toHaveBeenCalledWith(75);
      expect(mockGetReadableCountString).toHaveBeenCalledWith(90);
    });

    it('should call getReadableCountString for percentage change', () => {
      renderComponent();

      expect(mockGetReadableCountString).toHaveBeenCalledWith(5);
      expect(mockGetReadableCountString).toHaveBeenCalledWith(-2);
      expect(mockGetReadableCountString).toHaveBeenCalledWith(0);
      expect(mockGetReadableCountString).toHaveBeenCalledWith(10);
    });

    it('should call getTitleByChartType for each chart', () => {
      renderComponent();

      expect(mockGetTitleByChartType).toHaveBeenCalledTimes(4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle charts data with noRecords flag', () => {
      const chartsDataWithNoRecords = [
        {
          chartType: SystemChartType.DescriptionCoverage,
          currentPercentage: 85,
          percentageChange: 5,
          isIncreased: true,
          numberOfDays: 7,
          noRecords: true,
        },
      ];

      renderComponent({ chartsData: chartsDataWithNoRecords });

      // Should still render the chart card
      expect(
        screen.getByText('Title for assets_with_description')
      ).toBeInTheDocument();
    });

    it('should handle very large percentage values', () => {
      const chartsDataWithLargeValues = [
        {
          chartType: SystemChartType.DescriptionCoverage,
          currentPercentage: 999999,
          percentageChange: 999999,
          isIncreased: true,
          numberOfDays: 7,
        },
      ];

      renderComponent({ chartsData: chartsDataWithLargeValues });

      expect(screen.getAllByText('999999%')).toHaveLength(2); // Both current and percentage change
    });

    it('should handle zero current percentage', () => {
      const chartsDataWithZeroPercentage = [
        {
          chartType: SystemChartType.DescriptionCoverage,
          currentPercentage: 0,
          percentageChange: 5,
          isIncreased: true,
          numberOfDays: 7,
        },
      ];

      renderComponent({ chartsData: chartsDataWithZeroPercentage });

      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    it('should integrate with useRequiredParams hook', () => {
      renderComponent();

      expect(mockUseRequiredParams).toHaveBeenCalled();
    });

    it('should handle route parameter changes', () => {
      const { rerender } = renderComponent();

      // Change service category
      mockUseRequiredParams.mockReturnValue({
        serviceCategory: ServiceCategory.MESSAGING_SERVICES,
      });

      rerender(
        <MemoryRouter>
          <PlatformInsightsWidget {...defaultProps} />
        </MemoryRouter>
      );

      expect(mockUseRequiredParams).toHaveBeenCalled();
    });
  });
});
