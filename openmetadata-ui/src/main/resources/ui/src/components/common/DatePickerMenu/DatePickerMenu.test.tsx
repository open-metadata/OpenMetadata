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
import { fireEvent, render, screen } from '@testing-library/react';
import DatePickerMenu from './DatePickerMenu.component';

jest.mock('../../../utils/DatePickerMenuUtils', () => ({
  getDaysCount: jest.fn().mockReturnValue(3),
  getTimestampLabel: jest.fn().mockReturnValue('custom range'),
}));
jest.mock('../../../constants/profiler.constant', () => ({
  DEFAULT_SELECTED_RANGE: {
    key: 'last3days',
    title: 'Last 3 days',
    days: 3,
  },
  PROFILER_FILTER_RANGE: {
    last3days: {
      days: 3,
      title: 'Last 3 days',
    },
    last7days: {
      days: 7,
      title: 'Last 7 days',
    },
  },
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  getCurrentMillis: jest.fn().mockReturnValue(1711583974000),
  getEpochMillisForPastDays: jest.fn().mockReturnValue(1709424034000),
}));

describe('DatePickerMenu', () => {
  const mockHandleDateRangeChange = jest.fn();
  const mockHandleSelectedTimeRange = jest.fn();

  it('should render component with default options', () => {
    render(
      <DatePickerMenu
        handleDateRangeChange={mockHandleDateRangeChange}
        handleSelectedTimeRange={mockHandleSelectedTimeRange}
      />
    );

    expect(screen.getByText('Last 3 days')).toBeInTheDocument();
  });

  it('should show default date range if provided via props', () => {
    render(
      <DatePickerMenu
        defaultDateRange={{ key: 'customRange', title: 'Default Range' }}
        handleDateRangeChange={mockHandleDateRangeChange}
        handleSelectedTimeRange={mockHandleSelectedTimeRange}
      />
    );

    expect(screen.getByText('Default Range')).toBeInTheDocument();
  });

  it('should update the selected range when the default range changes', () => {
    const { rerender } = render(
      <DatePickerMenu
        defaultDateRange={{ key: 'last3days', title: 'Last 3 days' }}
        handleDateRangeChange={mockHandleDateRangeChange}
      />
    );

    rerender(
      <DatePickerMenu
        defaultDateRange={{ key: 'customRange', title: 'Updated Range' }}
        handleDateRangeChange={mockHandleDateRangeChange}
      />
    );

    expect(screen.getByText('Updated Range')).toBeInTheDocument();
    expect(screen.queryByText('Last 3 days')).not.toBeInTheDocument();
  });

  it('should preserve a selection when equivalent default props are recreated', async () => {
    const { rerender } = render(
      <DatePickerMenu
        defaultDateRange={{ key: 'last3days', title: 'Last 3 days' }}
        handleDateRangeChange={mockHandleDateRangeChange}
      />
    );

    fireEvent.click(screen.getByTestId('date-picker-menu'));
    fireEvent.click(await screen.findByText('Last 7 days'));

    rerender(
      <DatePickerMenu
        defaultDateRange={{ key: 'last3days', title: 'Last 3 days' }}
        handleDateRangeChange={mockHandleDateRangeChange}
      />
    );

    expect(screen.getByTestId('date-picker-menu')).toHaveTextContent(
      'Last 7 days'
    );
  });

  it('should clear the selected range and restore the disabled placeholder', () => {
    const onClear = jest.fn();

    render(
      <DatePickerMenu
        allowClear
        defaultDateRange={{ key: 'last3days', title: 'Last 3 days' }}
        handleDateRangeChange={mockHandleDateRangeChange}
        placeholder="Select date"
        onClear={onClear}
      />
    );

    const clearButton = screen.getByTestId('clear-date-picker');
    const datePickerTrigger = screen.getByTestId('date-picker-menu');

    expect(datePickerTrigger).toHaveClass('tw:h-8');
    expect(datePickerTrigger).toHaveClass('tw:max-w-64');
    expect(clearButton).toHaveClass('tw:items-center');
    expect(clearButton).toHaveClass('tw:justify-center');
    expect(clearButton).toHaveClass('tw:cursor-pointer');
    expect(clearButton.tagName).toBe('BUTTON');
    expect(datePickerTrigger).not.toContainElement(clearButton);

    fireEvent.mouseDown(clearButton);
    fireEvent.click(clearButton);

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Select date')).toHaveClass('tw:text-disabled');
  });
});
