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
import { getLocalTimeZone, today } from '@internationalized/date';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { dateValueToMillis } from '../../../utils/date-time/calendarDate.utils';
import DatePickerMenu from './DatePickerMenu.component';

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

  it('should center the small trigger content within its fixed height', () => {
    render(<DatePickerMenu size="small" />);

    expect(screen.getByTestId('date-picker-menu')).toHaveClass(
      'tw:inline-flex',
      'tw:h-8',
      'tw:max-w-72',
      'tw:items-center',
      'tw:justify-center'
    );
  });

  it('should show the complete custom range without the preset width limit', () => {
    const customRange = '2025-02-06 -> 2025-02-28';

    render(
      <DatePickerMenu
        allowClear
        defaultDateRange={{ key: 'customRange', title: customRange }}
        size="small"
      />
    );

    expect(screen.getByTestId('date-picker-container')).toHaveClass(
      'tw:max-w-none'
    );
    expect(screen.getByTestId('date-picker-menu')).toHaveClass('tw:max-w-none');
    expect(screen.getByText(customRange)).toHaveClass('tw:whitespace-nowrap');
  });

  it('commits a real calendar range at local day boundaries and closes the menu', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onChange = jest.fn();
    render(
      <DatePickerMenu
        showSelectedCustomRange
        handleDateRangeChange={onChange}
        size="small"
      />
    );
    await user.click(screen.getByTestId('date-picker-menu'));
    await user.click(await screen.findByText('label.custom-range'));
    const calendar = await screen.findByRole('dialog', {
      name: 'label.custom-range',
    });
    const currentDate = today(getLocalTimeZone());
    const start = currentDate.set({ day: 6 });
    const end = currentDate.set({ day: 28 });
    const dateLabel = (date: typeof start) =>
      new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date.toDate(getLocalTimeZone()));
    const startButton = within(calendar).getByRole('button', {
      name: (label) => label.includes(dateLabel(start)),
    });
    const endButton = within(calendar).getByRole('button', {
      name: (label) => label.includes(dateLabel(end)),
    });
    await user.click(startButton);

    expect(onChange).not.toHaveBeenCalled();

    await user.click(endButton);

    expect(onChange).toHaveBeenCalledWith(
      {
        startTs: dateValueToMillis(start),
        endTs: dateValueToMillis(end.add({ days: 1 })) - 1,
        key: 'customRange',
        title: start.toString() + ' -> ' + end.toString(),
      },
      22
    );
    expect(screen.getByTestId('date-picker-menu')).toHaveTextContent(
      start.toString() + ' -> ' + end.toString()
    );
    expect(
      screen.queryByRole('dialog', { name: 'label.custom-range' })
    ).not.toBeInTheDocument();
  });

  it('should not render the clear control by default', () => {
    render(
      <DatePickerMenu
        defaultDateRange={{ key: 'last3days', title: 'Last 3 days' }}
        size="small"
      />
    );

    expect(screen.queryByTestId('clear-date-picker')).not.toBeInTheDocument();
  });

  it('should clear the selected range when enabled', () => {
    const onClear = jest.fn();

    render(
      <DatePickerMenu
        allowClear
        defaultDateRange={{ key: 'last3days', title: 'Last 3 days' }}
        placeholder="Select date"
        size="small"
        onClear={onClear}
      />
    );

    const datePickerContainer = screen.getByTestId('date-picker-container');
    const datePickerTrigger = screen.getByTestId('date-picker-menu');
    const clearButton = screen.getByTestId('clear-date-picker');

    expect(datePickerContainer).toHaveClass('tw:max-w-80', 'tw:relative');
    expect(datePickerContainer).toHaveClass(
      'tw:[&_[data-testid=date-picker-menu]>span:first-of-type]:pr-6'
    );
    expect(clearButton).toHaveAccessibleName('label.clear');

    expect(clearButton.tagName).toBe('BUTTON');
    expect(datePickerTrigger).not.toContainElement(clearButton);

    fireEvent.click(clearButton);

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Select date')).toHaveClass('tw:text-disabled');
    expect(screen.queryByTestId('clear-date-picker')).not.toBeInTheDocument();
  });
});
