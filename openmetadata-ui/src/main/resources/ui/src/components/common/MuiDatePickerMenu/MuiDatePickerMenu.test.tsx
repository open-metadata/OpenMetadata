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
import { DateTime } from 'luxon';
import '../../../test/unit/mocks/mui.mock';
import MuiDatePickerMenu from './MuiDatePickerMenu';

jest.mock('../../../utils/DatePickerMenuUtils', () => ({
  getDaysCount: jest.fn().mockReturnValue(7),
  getTimestampLabel: jest.fn().mockReturnValue('Custom Range'),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  getCurrentDayEndGMTinMillis: jest.fn().mockReturnValue(1711670399000),
  getDayAgoStartGMTinMillis: jest.fn().mockReturnValue(1711065600000),
}));

jest.mock('../../../constants/profiler.constant', () => ({
  DEFAULT_SELECTED_RANGE: {
    key: 'last7days',
    title: 'Last 7 days',
    days: 7,
  },
  PROFILER_FILTER_RANGE: {
    last7days: {
      days: 7,
      title: 'Last 7 days',
    },
    last14days: {
      days: 14,
      title: 'Last 14 days',
    },
    last30days: {
      days: 30,
      title: 'Last 30 days',
    },
  },
}));

jest.mock('../DatePicker/DatePicker', () => ({
  __esModule: true,
  default: {
    RangePicker: ({
      onChange,
      ...props
    }: {
      onChange: (
        values: [start: DateTime | null, end: DateTime | null] | null,
        dateStrings: [string, string]
      ) => void;
    }) => (
      <div data-testid="date-range-picker" {...props}>
        <button
          data-testid="apply-custom-range"
          onClick={() =>
            onChange(
              [DateTime.fromISO('2024-03-01'), DateTime.fromISO('2024-03-31')],
              ['2024-03-01', '2024-03-31']
            )
          }>
          Apply
        </button>
        <button
          data-testid="clear-custom-range"
          onClick={() => onChange(null, ['', ''])}>
          Clear
        </button>
      </div>
    ),
  },
}));

describe('MuiDatePickerMenu', () => {
  const mockHandleDateRangeChange = jest.fn();
  const mockHandleSelectedTimeRange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the component with default date range', () => {
      render(
        <MuiDatePickerMenu handleDateRangeChange={mockHandleDateRangeChange} />
      );

      expect(screen.getByTestId('mui-date-picker-menu')).toBeInTheDocument();
      expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    });

    it('should render with custom default date range', () => {
      render(
        <MuiDatePickerMenu
          defaultDateRange={{ key: 'last30days', title: 'Last 30 days' }}
          handleDateRangeChange={mockHandleDateRangeChange}
        />
      );

      expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    });

    it('should render with custom date range title', () => {
      render(
        <MuiDatePickerMenu
          defaultDateRange={{ key: 'customRange', title: 'Mar 1 - Mar 31' }}
          handleDateRangeChange={mockHandleDateRangeChange}
        />
      );

      expect(screen.getByText('Mar 1 - Mar 31')).toBeInTheDocument();
    });

    it('should render with different button sizes', () => {
      const { rerender } = render(
        <MuiDatePickerMenu
          handleDateRangeChange={mockHandleDateRangeChange}
          size="small"
        />
      );

      const button = screen.getByTestId('mui-date-picker-menu');

      expect(button).toBeInTheDocument();

      rerender(
        <MuiDatePickerMenu
          handleDateRangeChange={mockHandleDateRangeChange}
          size="medium"
        />
      );

      expect(button).toBeInTheDocument();

      rerender(
        <MuiDatePickerMenu
          handleDateRangeChange={mockHandleDateRangeChange}
          size="large"
        />
      );

      expect(button).toBeInTheDocument();
    });

    it('should render button with correct attributes', () => {
      render(
        <MuiDatePickerMenu handleDateRangeChange={mockHandleDateRangeChange} />
      );

      const button = screen.getByTestId('mui-date-picker-menu');

      expect(button).toBeInTheDocument();
      expect(button.tagName.toLowerCase()).toBe('button');
    });
  });

  describe('Menu Interaction', () => {
    it('should have clickable button element', () => {
      render(
        <MuiDatePickerMenu handleDateRangeChange={mockHandleDateRangeChange} />
      );

      const button = screen.getByTestId('mui-date-picker-menu');

      expect(button).toBeEnabled();
      expect(button).not.toBeDisabled();
    });

    it('should render button with text content', () => {
      render(
        <MuiDatePickerMenu handleDateRangeChange={mockHandleDateRangeChange} />
      );

      const button = screen.getByTestId('mui-date-picker-menu');

      expect(button).toHaveTextContent('Last 7 days');
    });
  });

  describe('Preset Range Selection', () => {
    it('should initialize with default options from constant', () => {
      render(
        <MuiDatePickerMenu handleDateRangeChange={mockHandleDateRangeChange} />
      );

      expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    });

    it('should display custom option title when provided', () => {
      const customOptions = {
        last7days: { days: 7, title: 'Past Week' },
      };

      render(
        <MuiDatePickerMenu
          defaultDateRange={{ key: 'last7days' }}
          handleDateRangeChange={mockHandleDateRangeChange}
          options={customOptions}
        />
      );

      expect(screen.getByText('Past Week')).toBeInTheDocument();
    });
  });

  describe('Props Handling', () => {
    it('should work without optional callbacks', () => {
      expect(() => {
        render(<MuiDatePickerMenu />);
      }).not.toThrow();
    });

    it('should handle allowCustomRange prop as true by default', () => {
      render(
        <MuiDatePickerMenu handleDateRangeChange={mockHandleDateRangeChange} />
      );

      const button = screen.getByTestId('mui-date-picker-menu');

      expect(button).toBeInTheDocument();
    });

    it('should handle allowCustomRange prop when set to false', () => {
      render(
        <MuiDatePickerMenu
          allowCustomRange={false}
          handleDateRangeChange={mockHandleDateRangeChange}
        />
      );

      const button = screen.getByTestId('mui-date-picker-menu');

      expect(button).toBeInTheDocument();
    });

    it('should handle showSelectedCustomRange prop', () => {
      render(
        <MuiDatePickerMenu
          allowCustomRange
          showSelectedCustomRange
          handleDateRangeChange={mockHandleDateRangeChange}
        />
      );

      const button = screen.getByTestId('mui-date-picker-menu');

      expect(button).toBeInTheDocument();
    });

    it('should handle handleSelectedTimeRange callback', () => {
      render(
        <MuiDatePickerMenu
          handleDateRangeChange={mockHandleDateRangeChange}
          handleSelectedTimeRange={mockHandleSelectedTimeRange}
        />
      );

      const button = screen.getByTestId('mui-date-picker-menu');

      expect(button).toBeInTheDocument();
    });
  });

  describe('Custom Options', () => {
    it('should accept custom options prop', () => {
      const customOptions = {
        last1day: { days: 1, title: 'Last 1 day' },
        last2days: { days: 2, title: 'Last 2 days' },
      };

      render(
        <MuiDatePickerMenu
          handleDateRangeChange={mockHandleDateRangeChange}
          options={customOptions}
        />
      );

      const button = screen.getByTestId('mui-date-picker-menu');

      expect(button).toBeInTheDocument();
    });

    it('should use default profiler filter range when no options provided', () => {
      render(
        <MuiDatePickerMenu handleDateRangeChange={mockHandleDateRangeChange} />
      );

      expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    });
  });

  describe('Component Display', () => {
    it('should display selected time range text', () => {
      render(
        <MuiDatePickerMenu handleDateRangeChange={mockHandleDateRangeChange} />
      );

      const button = screen.getByTestId('mui-date-picker-menu');

      expect(button).toHaveTextContent('Last 7 days');
    });

    it('should display different text for different initial ranges', () => {
      const { unmount } = render(
        <MuiDatePickerMenu handleDateRangeChange={mockHandleDateRangeChange} />
      );

      expect(screen.getByText('Last 7 days')).toBeInTheDocument();

      unmount();

      render(
        <MuiDatePickerMenu
          defaultDateRange={{ key: 'last14days', title: 'Last 14 days' }}
          handleDateRangeChange={mockHandleDateRangeChange}
        />
      );

      expect(screen.getByText('Last 14 days')).toBeInTheDocument();
    });

    it('should display custom range text correctly', () => {
      render(
        <MuiDatePickerMenu
          defaultDateRange={{
            key: 'customRange',
            title: 'Jan 1 - Jan 31, 2024',
          }}
          handleDateRangeChange={mockHandleDateRangeChange}
        />
      );

      expect(screen.getByText('Jan 1 - Jan 31, 2024')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button element', () => {
      render(
        <MuiDatePickerMenu handleDateRangeChange={mockHandleDateRangeChange} />
      );

      const button = screen.getByTestId('mui-date-picker-menu');

      expect(button).toBeVisible();
      expect(button).toBeEnabled();
    });

    it('should have text content for screen readers', () => {
      render(
        <MuiDatePickerMenu handleDateRangeChange={mockHandleDateRangeChange} />
      );

      const button = screen.getByTestId('mui-date-picker-menu');

      expect(button).toHaveTextContent('Last 7 days');
      expect(button.textContent).not.toBe('');
    });
  });
});
