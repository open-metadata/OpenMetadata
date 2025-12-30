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

import { queryByAttribute, render, screen } from '@testing-library/react';
import { ColumnProfile } from '../../../generated/entity/data/table';
import '../../../test/unit/mocks/mui.mock';
import '../../../test/unit/mocks/recharts.mock';
import CardinalityDistributionChart, {
  CardinalityDistributionChartProps,
} from './CardinalityDistributionChart.component';

// Mock utility functions
jest.mock('../../../utils/ChartUtils', () => ({
  axisTickFormatter: jest.fn(
    (value: string, suffix: string) => `${value}${suffix}`
  ),
  tooltipFormatter: jest.fn((value: number) => value.toLocaleString()),
  createHorizontalGridLineRenderer: jest.fn(() => jest.fn()),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  customFormatDateTime: jest.fn((timestamp: number) => {
    if (timestamp === 1704067200000) {
      return 'Jan 01';
    }
    if (timestamp === 1703980800000) {
      return 'Dec 30';
    }

    return 'Unknown Date';
  }),
}));

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return function MockErrorPlaceHolder({
    placeholderText,
  }: {
    placeholderText: string | React.ReactNode;
  }) {
    return <div data-testid="error-placeholder">{placeholderText}</div>;
  };
});

const mockColumnProfileWithCardinality: ColumnProfile = {
  name: 'test_column',
  timestamp: 1704067200000,
  valuesCount: 1000,
  nullCount: 10,
  cardinalityDistribution: {
    categories: ['low', 'medium', 'high', 'very_high'],
    counts: [100, 300, 400, 200],
    percentages: [10, 30, 40, 20],
  },
};

const mockColumnProfileWithoutCardinality: ColumnProfile = {
  name: 'test_column',
  timestamp: 1704067200000,
  valuesCount: 1000,
  nullCount: 10,
};

const mockSecondColumnProfile: ColumnProfile = {
  name: 'test_column',
  timestamp: 1703980800000,
  valuesCount: 950,
  nullCount: 15,
  cardinalityDistribution: {
    categories: ['low', 'medium', 'high'],
    counts: [150, 400, 400],
    percentages: [15.8, 42.1, 42.1],
  },
};

const mockColumnProfileWithAllUnique: ColumnProfile = {
  name: 'test_column',
  timestamp: 1704067200000,
  valuesCount: 1000,
  nullCount: 10,
  cardinalityDistribution: {
    allValuesUnique: true,
  },
};

const mockSecondColumnProfileWithAllUnique: ColumnProfile = {
  name: 'test_column',
  timestamp: 1703980800000,
  valuesCount: 950,
  nullCount: 15,
  cardinalityDistribution: {
    allValuesUnique: true,
  },
};

describe('CardinalityDistributionChart', () => {
  const defaultProps: CardinalityDistributionChartProps = {
    data: {
      firstDayData: mockColumnProfileWithCardinality,
      currentDayData: mockSecondColumnProfile,
    },
  };

  describe('Rendering', () => {
    it('should render chart container when data is provided', async () => {
      render(<CardinalityDistributionChart {...defaultProps} />);

      expect(await screen.findByTestId('chart-container')).toBeInTheDocument();
    });

    it('should render dual charts when both firstDayData and currentDayData have cardinality data', async () => {
      const { container } = render(
        <CardinalityDistributionChart {...defaultProps} />
      );

      expect(await screen.findAllByTestId('date')).toHaveLength(2);
      expect(await screen.findAllByTestId('cardinality-tag')).toHaveLength(2);
      expect(
        queryByAttribute('id', container, 'firstDayData-cardinality')
      ).toBeInTheDocument();
      expect(
        queryByAttribute('id', container, 'currentDayData-cardinality')
      ).toBeInTheDocument();
    });

    it('should render single chart when only currentDayData has cardinality data', async () => {
      const props: CardinalityDistributionChartProps = {
        data: {
          firstDayData: mockColumnProfileWithoutCardinality,
          currentDayData: mockSecondColumnProfile,
        },
      };

      const { container } = render(<CardinalityDistributionChart {...props} />);

      expect(await screen.findAllByTestId('date')).toHaveLength(1);
      expect(await screen.findAllByTestId('cardinality-tag')).toHaveLength(1);
      expect(
        queryByAttribute('id', container, 'firstDayData-cardinality')
      ).not.toBeInTheDocument();
      expect(
        queryByAttribute('id', container, 'currentDayData-cardinality')
      ).toBeInTheDocument();
    });

    it('should render single chart when only firstDayData has cardinality data', async () => {
      const props: CardinalityDistributionChartProps = {
        data: {
          firstDayData: mockColumnProfileWithCardinality,
          currentDayData: mockColumnProfileWithoutCardinality,
        },
      };

      const { container } = render(<CardinalityDistributionChart {...props} />);

      expect(await screen.findAllByTestId('date')).toHaveLength(1);
      expect(await screen.findAllByTestId('cardinality-tag')).toHaveLength(1);
      expect(
        queryByAttribute('id', container, 'firstDayData-cardinality')
      ).toBeInTheDocument();
      expect(
        queryByAttribute('id', container, 'currentDayData-cardinality')
      ).not.toBeInTheDocument();
    });

    it('should render error placeholder when no cardinality data is available', async () => {
      const props: CardinalityDistributionChartProps = {
        data: {
          firstDayData: mockColumnProfileWithoutCardinality,
          currentDayData: mockColumnProfileWithoutCardinality,
        },
        noDataPlaceholderText: 'No cardinality data available',
      };

      render(<CardinalityDistributionChart {...props} />);

      expect(
        await screen.findByTestId('error-placeholder')
      ).toBeInTheDocument();
      expect(
        await screen.findByText('No cardinality data available')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('chart-container')).not.toBeInTheDocument();
    });

    it('should render error placeholder with default message when no cardinality data and no placeholder text', async () => {
      const props: CardinalityDistributionChartProps = {
        data: {
          firstDayData: mockColumnProfileWithoutCardinality,
          currentDayData: mockColumnProfileWithoutCardinality,
        },
      };

      render(<CardinalityDistributionChart {...props} />);

      expect(
        await screen.findByTestId('error-placeholder')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('chart-container')).not.toBeInTheDocument();
    });
  });

  describe('Data Processing', () => {
    it('should render charts when cardinality data is provided', async () => {
      const { container } = render(
        <CardinalityDistributionChart {...defaultProps} />
      );

      // Should render chart containers with unique IDs
      expect(
        queryByAttribute('id', container, 'firstDayData-cardinality')
      ).toBeInTheDocument();
      expect(
        queryByAttribute('id', container, 'currentDayData-cardinality')
      ).toBeInTheDocument();
    });

    it('should handle missing counts and percentages gracefully', async () => {
      const incompleteProfile: ColumnProfile = {
        name: 'test_column',
        timestamp: 1704067200000,
        valuesCount: 1000,
        nullCount: 10,
        cardinalityDistribution: {
          categories: ['low', 'medium', 'high'],
          counts: [100], // Missing counts for medium and high
          percentages: [10, 30], // Missing percentage for high
        },
      };

      const props: CardinalityDistributionChartProps = {
        data: {
          currentDayData: incompleteProfile,
        },
      };

      const { container } = render(<CardinalityDistributionChart {...props} />);

      // Should still render the chart container
      expect(await screen.findByTestId('chart-container')).toBeInTheDocument();
      expect(
        queryByAttribute('id', container, 'currentDayData-cardinality')
      ).toBeInTheDocument();
    });

    it('should handle empty categories array', async () => {
      const emptyProfile: ColumnProfile = {
        name: 'test_column',
        timestamp: 1704067200000,
        valuesCount: 1000,
        nullCount: 10,
        cardinalityDistribution: {
          categories: [],
          counts: [],
          percentages: [],
        },
      };

      const props: CardinalityDistributionChartProps = {
        data: {
          currentDayData: emptyProfile,
        },
      };

      const { container } = render(<CardinalityDistributionChart {...props} />);

      // Should still render the chart container even with empty data
      expect(await screen.findByTestId('chart-container')).toBeInTheDocument();
      expect(
        queryByAttribute('id', container, 'currentDayData-cardinality')
      ).toBeInTheDocument();
    });
  });

  describe('Date and Tag Display', () => {
    it('should display formatted dates correctly', async () => {
      render(<CardinalityDistributionChart {...defaultProps} />);

      const dateElements = await screen.findAllByTestId('date');

      expect(dateElements[0]).toHaveTextContent('Jan 01');
      expect(dateElements[1]).toHaveTextContent('Dec 30');
    });

    it('should display total categories count in tags', async () => {
      render(<CardinalityDistributionChart {...defaultProps} />);

      const cardinalityTags = await screen.findAllByTestId('cardinality-tag');

      expect(cardinalityTags[0]).toHaveTextContent('label.total-entity: 4');
      expect(cardinalityTags[1]).toHaveTextContent('label.total-entity: 3');
    });

    it('should handle zero categories in tag', async () => {
      const emptyProfile: ColumnProfile = {
        name: 'test_column',
        timestamp: 1704067200000,
        valuesCount: 1000,
        nullCount: 10,
        cardinalityDistribution: {
          categories: [],
          counts: [],
          percentages: [],
        },
      };

      const props: CardinalityDistributionChartProps = {
        data: {
          currentDayData: emptyProfile,
        },
      };

      render(<CardinalityDistributionChart {...props} />);

      const cardinalityTag = await screen.findByTestId('cardinality-tag');

      expect(cardinalityTag).toHaveTextContent('label.total-entity: 0');
    });
  });

  describe('Layout and Styling', () => {
    it('should use correct layout for single graph', async () => {
      const props: CardinalityDistributionChartProps = {
        data: {
          currentDayData: mockColumnProfileWithCardinality,
        },
      };

      const { container } = render(<CardinalityDistributionChart {...props} />);

      // Single graph should render one chart
      expect(await screen.findAllByTestId('date')).toHaveLength(1);
      expect(
        queryByAttribute('id', container, 'currentDayData-cardinality')
      ).toBeInTheDocument();
    });

    it('should use correct layout for dual graphs', async () => {
      const { container } = render(
        <CardinalityDistributionChart {...defaultProps} />
      );

      // Dual graphs should render two charts
      expect(await screen.findAllByTestId('date')).toHaveLength(2);
      expect(
        queryByAttribute('id', container, 'firstDayData-cardinality')
      ).toBeInTheDocument();
      expect(
        queryByAttribute('id', container, 'currentDayData-cardinality')
      ).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined data gracefully', async () => {
      const props: CardinalityDistributionChartProps = {
        data: {},
      };

      render(<CardinalityDistributionChart {...props} />);

      expect(
        await screen.findByTestId('error-placeholder')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('chart-container')).not.toBeInTheDocument();
    });

    it('should handle data with undefined cardinality distribution', async () => {
      const props: CardinalityDistributionChartProps = {
        data: {
          firstDayData: {
            ...mockColumnProfileWithCardinality,
            cardinalityDistribution: undefined,
          },
          currentDayData: {
            ...mockSecondColumnProfile,
            cardinalityDistribution: undefined,
          },
        },
      };

      render(<CardinalityDistributionChart {...props} />);

      expect(
        await screen.findByTestId('error-placeholder')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('chart-container')).not.toBeInTheDocument();
    });

    it('should handle missing timestamp gracefully', async () => {
      const profileWithoutTimestamp: ColumnProfile = {
        ...mockColumnProfileWithCardinality,
        timestamp: undefined as unknown as number,
      };

      const props: CardinalityDistributionChartProps = {
        data: {
          currentDayData: profileWithoutTimestamp,
        },
      };

      render(<CardinalityDistributionChart {...props} />);

      const dateElement = await screen.findByTestId('date');

      expect(dateElement).toHaveTextContent('Unknown Date');
    });

    it('should handle React node as noDataPlaceholderText', async () => {
      const customPlaceholder = <div>Custom No Data Message</div>;

      const props: CardinalityDistributionChartProps = {
        data: {
          firstDayData: mockColumnProfileWithoutCardinality,
          currentDayData: mockColumnProfileWithoutCardinality,
        },
        noDataPlaceholderText: customPlaceholder,
      };

      render(<CardinalityDistributionChart {...props} />);

      expect(
        await screen.findByTestId('error-placeholder')
      ).toBeInTheDocument();
      expect(
        await screen.findByText('Custom No Data Message')
      ).toBeInTheDocument();
    });

    it('should handle undefined columnProfile data', async () => {
      const props: CardinalityDistributionChartProps = {
        data: {
          firstDayData: undefined,
          currentDayData: undefined,
        },
      };

      render(<CardinalityDistributionChart {...props} />);

      expect(
        await screen.findByTestId('error-placeholder')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('chart-container')).not.toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    it('should render with both data sources having different category counts', async () => {
      const { container } = render(
        <CardinalityDistributionChart {...defaultProps} />
      );

      const cardinalityTags = await screen.findAllByTestId('cardinality-tag');

      // First profile has 4 categories, second has 3
      expect(cardinalityTags[0]).toHaveTextContent('4');
      expect(cardinalityTags[1]).toHaveTextContent('3');

      // Both charts should render
      expect(
        queryByAttribute('id', container, 'firstDayData-cardinality')
      ).toBeInTheDocument();
      expect(
        queryByAttribute('id', container, 'currentDayData-cardinality')
      ).toBeInTheDocument();
    });

    it('should render without custom placeholder text', async () => {
      const props: CardinalityDistributionChartProps = {
        data: {
          firstDayData: mockColumnProfileWithoutCardinality,
          currentDayData: mockColumnProfileWithoutCardinality,
        },
      };

      render(<CardinalityDistributionChart {...props} />);

      expect(
        await screen.findByTestId('error-placeholder')
      ).toBeInTheDocument();
    });
  });

  describe('All Values Unique Flag', () => {
    it('should render single full-width message when both charts have allValuesUnique true', async () => {
      const props: CardinalityDistributionChartProps = {
        data: {
          firstDayData: mockColumnProfileWithAllUnique,
          currentDayData: mockSecondColumnProfileWithAllUnique,
        },
      };

      render(<CardinalityDistributionChart {...props} />);

      const errorPlaceholder = await screen.findByTestId('error-placeholder');

      expect(errorPlaceholder).toBeInTheDocument();
      expect(errorPlaceholder).toHaveTextContent(
        'message.all-values-unique-no-distribution-available'
      );
      expect(await screen.findByTestId('chart-container')).toBeInTheDocument();
      expect(screen.queryByTestId('date')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cardinality-tag')).not.toBeInTheDocument();
    });

    it('should render message in first chart position when only firstDayData has allValuesUnique true', async () => {
      const props: CardinalityDistributionChartProps = {
        data: {
          firstDayData: mockColumnProfileWithAllUnique,
          currentDayData: mockSecondColumnProfile,
        },
      };

      const { container } = render(<CardinalityDistributionChart {...props} />);

      const errorPlaceholder = await screen.findByTestId('error-placeholder');

      expect(errorPlaceholder).toBeInTheDocument();
      expect(errorPlaceholder).toHaveTextContent(
        'message.all-values-unique-no-distribution-available'
      );
      expect(await screen.findByTestId('chart-container')).toBeInTheDocument();

      // Second chart should still render normally
      expect(await screen.findByTestId('date')).toBeInTheDocument();
      expect(await screen.findByTestId('cardinality-tag')).toBeInTheDocument();
      expect(
        queryByAttribute('id', container, 'currentDayData-cardinality')
      ).toBeInTheDocument();
      expect(
        queryByAttribute('id', container, 'firstDayData-cardinality')
      ).not.toBeInTheDocument();
    });

    it('should render message in second chart position when only currentDayData has allValuesUnique true', async () => {
      const props: CardinalityDistributionChartProps = {
        data: {
          firstDayData: mockColumnProfileWithCardinality,
          currentDayData: mockSecondColumnProfileWithAllUnique,
        },
      };

      const { container } = render(<CardinalityDistributionChart {...props} />);

      const errorPlaceholder = await screen.findByTestId('error-placeholder');

      expect(errorPlaceholder).toBeInTheDocument();
      expect(errorPlaceholder).toHaveTextContent(
        'message.all-values-unique-no-distribution-available'
      );
      expect(await screen.findByTestId('chart-container')).toBeInTheDocument();

      // First chart should still render normally
      expect(await screen.findByTestId('date')).toBeInTheDocument();
      expect(await screen.findByTestId('cardinality-tag')).toBeInTheDocument();
      expect(
        queryByAttribute('id', container, 'firstDayData-cardinality')
      ).toBeInTheDocument();
      expect(
        queryByAttribute('id', container, 'currentDayData-cardinality')
      ).not.toBeInTheDocument();
    });

    it('should render charts normally when allValuesUnique is false', async () => {
      const profileWithFalseFlag: ColumnProfile = {
        name: 'test_column',
        timestamp: 1704067200000,
        valuesCount: 1000,
        nullCount: 10,
        cardinalityDistribution: {
          allValuesUnique: false,
          categories: ['low', 'medium', 'high'],
          counts: [100, 300, 600],
          percentages: [10, 30, 60],
        },
      };

      const props: CardinalityDistributionChartProps = {
        data: {
          currentDayData: profileWithFalseFlag,
        },
      };

      const { container } = render(<CardinalityDistributionChart {...props} />);

      expect(await screen.findByTestId('chart-container')).toBeInTheDocument();
      expect(await screen.findByTestId('date')).toBeInTheDocument();
      expect(await screen.findByTestId('cardinality-tag')).toBeInTheDocument();
      expect(
        queryByAttribute('id', container, 'currentDayData-cardinality')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('error-placeholder')).not.toBeInTheDocument();
    });

    it('should render charts normally when allValuesUnique is undefined', async () => {
      const props: CardinalityDistributionChartProps = {
        data: {
          firstDayData: mockColumnProfileWithCardinality,
          currentDayData: mockSecondColumnProfile,
        },
      };

      const { container } = render(<CardinalityDistributionChart {...props} />);

      expect(await screen.findByTestId('chart-container')).toBeInTheDocument();
      expect(await screen.findAllByTestId('date')).toHaveLength(2);
      expect(await screen.findAllByTestId('cardinality-tag')).toHaveLength(2);
      expect(
        queryByAttribute('id', container, 'firstDayData-cardinality')
      ).toBeInTheDocument();
      expect(
        queryByAttribute('id', container, 'currentDayData-cardinality')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('error-placeholder')).not.toBeInTheDocument();
    });

    it('should handle allValuesUnique with empty categories array', async () => {
      const profileWithEmptyCategories: ColumnProfile = {
        name: 'test_column',
        timestamp: 1704067200000,
        valuesCount: 1000,
        nullCount: 10,
        cardinalityDistribution: {
          allValuesUnique: true,
          categories: [],
          counts: [],
          percentages: [],
        },
      };

      const props: CardinalityDistributionChartProps = {
        data: {
          currentDayData: profileWithEmptyCategories,
        },
      };

      render(<CardinalityDistributionChart {...props} />);

      const errorPlaceholder = await screen.findByTestId('error-placeholder');

      expect(errorPlaceholder).toBeInTheDocument();
      expect(errorPlaceholder).toHaveTextContent(
        'message.all-values-unique-no-distribution-available'
      );
      expect(screen.queryByTestId('date')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cardinality-tag')).not.toBeInTheDocument();
    });

    it('should maintain 50% width layout when one chart has allValuesUnique', async () => {
      const props: CardinalityDistributionChartProps = {
        data: {
          firstDayData: mockColumnProfileWithCardinality,
          currentDayData: mockSecondColumnProfileWithAllUnique,
        },
      };

      const { container } = render(<CardinalityDistributionChart {...props} />);

      // Chart container should exist
      expect(await screen.findByTestId('chart-container')).toBeInTheDocument();

      // First chart should render normally
      expect(
        queryByAttribute('id', container, 'firstDayData-cardinality')
      ).toBeInTheDocument();

      // Error placeholder should exist for second chart
      expect(
        await screen.findByTestId('error-placeholder')
      ).toBeInTheDocument();
    });
  });
});
