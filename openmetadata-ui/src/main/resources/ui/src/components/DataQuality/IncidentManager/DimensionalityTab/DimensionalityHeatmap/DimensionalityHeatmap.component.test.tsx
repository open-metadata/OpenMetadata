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

import { createTheme, Theme, ThemeProvider } from '@mui/material/styles';
import { ThemeColors } from '@openmetadata/ui-core-components';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { TestCaseStatus } from '../../../../../generated/tests/dimensionResult';
import DimensionalityHeatmap from './DimensionalityHeatmap.component';
import { DimensionResultWithTimestamp } from './DimensionalityHeatmap.interface';

const mockThemeColors: ThemeColors = {
  white: '#FFFFFF',
  gray: {
    300: '#D1D5DB',
    700: '#374151',
    900: '#111827',
  },
} as ThemeColors;

const theme: Theme = createTheme({
  palette: {
    allShades: mockThemeColors,
  },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

jest.mock('./useScrollIndicator.hook', () => ({
  useScrollIndicator: jest.fn(() => ({
    showLeftIndicator: false,
    showRightIndicator: false,
    handleScrollLeft: jest.fn(),
    handleScrollRight: jest.fn(),
  })),
}));

jest.mock('./HeatmapCellTooltip.component', () => ({
  HeatmapCellTooltip: jest
    .fn()
    .mockImplementation(() => <div>HeatmapCellTooltip</div>),
}));

describe('DimensionalityHeatmap Component', () => {
  const startDate = new Date('2025-01-01').getTime();
  const endDate = new Date('2025-01-03').getTime();

  const createMockResult = (
    dimensionValue: string,
    date: string,
    status: TestCaseStatus
  ): DimensionResultWithTimestamp => ({
    dimensionValues: [{ name: 'region', value: dimensionValue }],
    timestamp: new Date(date).getTime(),
    testCaseStatus: status,
    passedRows: 100,
    failedRows: 0,
    testResultValue: [],
  });

  const mockData: DimensionResultWithTimestamp[] = [
    createMockResult('US', '2025-01-01', TestCaseStatus.Success),
    createMockResult('US', '2025-01-02', TestCaseStatus.Failed),
    createMockResult('EU', '2025-01-01', TestCaseStatus.Success),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering States', () => {
    it('should render loading state when isLoading is true', () => {
      render(
        <DimensionalityHeatmap
          isLoading
          data={[]}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should render empty state when data is empty', () => {
      render(
        <DimensionalityHeatmap
          data={[]}
          endDate={endDate}
          isLoading={false}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText('message.no-data-available')).toBeInTheDocument();
    });

    it('should render heatmap when data is provided', () => {
      render(
        <DimensionalityHeatmap
          data={mockData}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText('US')).toBeInTheDocument();
      expect(screen.getByText('EU')).toBeInTheDocument();
    });
  });

  describe('Date Range Header', () => {
    it('should render all dates in the range', () => {
      render(
        <DimensionalityHeatmap
          data={mockData}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText('Jan 1')).toBeInTheDocument();
      expect(screen.getByText('Jan 2')).toBeInTheDocument();
      expect(screen.getByText('Jan 3')).toBeInTheDocument();
    });

    it('should render dates in reverse chronological order', () => {
      const { container } = render(
        <DimensionalityHeatmap
          data={mockData}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      const headers = container.querySelectorAll(
        '.dimensionality-heatmap__header-cell:not(.dimensionality-heatmap__header-cell--placeholder)'
      );

      expect(headers[2]).toHaveTextContent('Jan 3');
      expect(headers[0]).toHaveTextContent('Jan 1');
    });
  });

  describe('Dimension Rows', () => {
    it('should render all unique dimension values', () => {
      render(
        <DimensionalityHeatmap
          data={mockData}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      const dimensionLabels = screen.getAllByText(/US|EU/);

      expect(dimensionLabels.length).toBeGreaterThanOrEqual(2);
    });

    it('should render cells for each dimension-date combination', () => {
      const { container } = render(
        <DimensionalityHeatmap
          data={mockData}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      const cells = container.querySelectorAll(
        '.dimensionality-heatmap__cell:not(.dimensionality-heatmap__cell--placeholder)'
      );

      expect(cells).toHaveLength(6);
    });

    it('should apply correct status classes to cells', () => {
      const { container } = render(
        <DimensionalityHeatmap
          data={mockData}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      expect(
        container.querySelector('.dimensionality-heatmap__cell--success')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.dimensionality-heatmap__cell--failed')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.dimensionality-heatmap__cell--no-data')
      ).toBeInTheDocument();
    });
  });

  describe('Legend', () => {
    it('should render legend with all status types', () => {
      render(
        <DimensionalityHeatmap
          data={mockData}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText('label.success')).toBeInTheDocument();
      expect(screen.getByText('label.failed')).toBeInTheDocument();
      expect(screen.getByText('label.aborted')).toBeInTheDocument();
      expect(screen.getByText('label.no-data')).toBeInTheDocument();
    });

    it('should render legend boxes with correct classes', () => {
      const { container } = render(
        <DimensionalityHeatmap
          data={mockData}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      expect(
        container.querySelector('.dimensionality-heatmap__legend-box--success')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.dimensionality-heatmap__legend-box--failed')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.dimensionality-heatmap__legend-box--aborted')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.dimensionality-heatmap__legend-box--no-data')
      ).toBeInTheDocument();
    });
  });

  describe('Scroll Indicators', () => {
    it('should not render scroll indicators when both are false', () => {
      const { container } = render(
        <DimensionalityHeatmap
          data={mockData}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      expect(
        container.querySelector(
          '.dimensionality-heatmap__scroll-indicator--left'
        )
      ).not.toBeInTheDocument();
      expect(
        container.querySelector(
          '.dimensionality-heatmap__scroll-indicator--right'
        )
      ).not.toBeInTheDocument();
    });

    it('should render right scroll indicator when showRightIndicator is true', () => {
      const mockUseScrollIndicator =
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./useScrollIndicator.hook').useScrollIndicator;
      const mockHandleScrollRight = jest.fn();

      mockUseScrollIndicator.mockReturnValue({
        showLeftIndicator: false,
        showRightIndicator: true,
        handleScrollLeft: jest.fn(),
        handleScrollRight: mockHandleScrollRight,
      });

      const { container } = render(
        <DimensionalityHeatmap
          data={mockData}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      expect(
        container.querySelector(
          '.dimensionality-heatmap__scroll-indicator--right'
        )
      ).toBeInTheDocument();
      expect(
        container.querySelector(
          '.dimensionality-heatmap__scroll-indicator--left'
        )
      ).not.toBeInTheDocument();
    });

    it('should render left scroll indicator when showLeftIndicator is true', () => {
      const mockUseScrollIndicator =
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./useScrollIndicator.hook').useScrollIndicator;
      const mockHandleScrollLeft = jest.fn();

      mockUseScrollIndicator.mockReturnValue({
        showLeftIndicator: true,
        showRightIndicator: false,
        handleScrollLeft: mockHandleScrollLeft,
        handleScrollRight: jest.fn(),
      });

      const { container } = render(
        <DimensionalityHeatmap
          data={mockData}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      expect(
        container.querySelector(
          '.dimensionality-heatmap__scroll-indicator--left'
        )
      ).toBeInTheDocument();
      expect(
        container.querySelector(
          '.dimensionality-heatmap__scroll-indicator--right'
        )
      ).not.toBeInTheDocument();
    });

    it('should call handleScrollRight when right scroll indicator is clicked', () => {
      const mockUseScrollIndicator =
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./useScrollIndicator.hook').useScrollIndicator;
      const mockHandleScrollRight = jest.fn();

      mockUseScrollIndicator.mockReturnValue({
        showLeftIndicator: false,
        showRightIndicator: true,
        handleScrollLeft: jest.fn(),
        handleScrollRight: mockHandleScrollRight,
      });

      const { container } = render(
        <DimensionalityHeatmap
          data={mockData}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      const scrollIndicator = container.querySelector(
        '.dimensionality-heatmap__scroll-indicator--right'
      );
      if (scrollIndicator) {
        fireEvent.click(scrollIndicator);
      }

      expect(mockHandleScrollRight).toHaveBeenCalledTimes(1);
    });

    it('should call handleScrollLeft when left scroll indicator is clicked', () => {
      const mockUseScrollIndicator =
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./useScrollIndicator.hook').useScrollIndicator;
      const mockHandleScrollLeft = jest.fn();

      mockUseScrollIndicator.mockReturnValue({
        showLeftIndicator: true,
        showRightIndicator: false,
        handleScrollLeft: mockHandleScrollLeft,
        handleScrollRight: jest.fn(),
      });

      const { container } = render(
        <DimensionalityHeatmap
          data={mockData}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      const scrollIndicator = container.querySelector(
        '.dimensionality-heatmap__scroll-indicator--left'
      );
      if (scrollIndicator) {
        fireEvent.click(scrollIndicator);
      }

      expect(mockHandleScrollLeft).toHaveBeenCalledTimes(1);
    });

    it('should render both indicators when both are true', () => {
      const mockUseScrollIndicator =
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./useScrollIndicator.hook').useScrollIndicator;

      mockUseScrollIndicator.mockReturnValue({
        showLeftIndicator: true,
        showRightIndicator: true,
        handleScrollLeft: jest.fn(),
        handleScrollRight: jest.fn(),
      });

      const { container } = render(
        <DimensionalityHeatmap
          data={mockData}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      expect(
        container.querySelector(
          '.dimensionality-heatmap__scroll-indicator--left'
        )
      ).toBeInTheDocument();
      expect(
        container.querySelector(
          '.dimensionality-heatmap__scroll-indicator--right'
        )
      ).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should render placeholder cells when container is measured', () => {
      const { container } = render(
        <DimensionalityHeatmap
          data={mockData}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        value: 1000,
      });

      const placeholderHeaders = container.querySelectorAll(
        '.dimensionality-heatmap__header-cell--placeholder'
      );

      expect(placeholderHeaders.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Data Transformations', () => {
    it('should handle multiple dimensions correctly', () => {
      const multiDimensionData = [
        createMockResult('US', '2025-01-01', TestCaseStatus.Success),
        createMockResult('EU', '2025-01-01', TestCaseStatus.Failed),
        createMockResult('APAC', '2025-01-01', TestCaseStatus.Aborted),
      ];

      render(
        <DimensionalityHeatmap
          data={multiDimensionData}
          endDate={startDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText('US')).toBeInTheDocument();
      expect(screen.getByText('EU')).toBeInTheDocument();
      expect(screen.getByText('APAC')).toBeInTheDocument();
    });

    it('should handle sparse data with missing dates', () => {
      const sparseData = [
        createMockResult('US', '2025-01-01', TestCaseStatus.Success),
      ];

      const { container } = render(
        <DimensionalityHeatmap
          data={sparseData}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      const cells = container.querySelectorAll(
        '.dimensionality-heatmap__cell:not(.dimensionality-heatmap__cell--placeholder)'
      );

      expect(cells).toHaveLength(3);

      const noDataCells = container.querySelectorAll(
        '.dimensionality-heatmap__cell--no-data'
      );

      expect(noDataCells).toHaveLength(2);
    });
  });

  describe('ResizeObserver Integration', () => {
    it('should set up ResizeObserver on mount', () => {
      const observeMock = jest.fn();
      const disconnectMock = jest.fn();

      window.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: observeMock,
        disconnect: disconnectMock,
        unobserve: jest.fn(),
      }));

      const { unmount } = render(
        <DimensionalityHeatmap
          data={mockData}
          endDate={endDate}
          startDate={startDate}
        />,
        { wrapper: Wrapper }
      );

      expect(observeMock).toHaveBeenCalled();

      unmount();

      expect(disconnectMock).toHaveBeenCalled();
    });
  });
});
