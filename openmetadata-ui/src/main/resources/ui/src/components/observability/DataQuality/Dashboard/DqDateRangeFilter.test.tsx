/*
 *  Copyright 2026 Collate.
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
import { ComponentProps } from 'react';
import DqDateRangeFilter from './DqDateRangeFilter';

type MockDateRangePickerProps = Pick<
  ComponentProps<
    typeof import('@openmetadata/ui-core-components').DateRangePicker
  >,
  'value' | 'onApply' | 'onCancel' | 'onChange'
>;

// The core DateRangePicker speaks `@internationalized/date` values. We render a
// minimal stand-in that exposes the staged `value` (as JSON) plus Apply/Cancel
// triggers so we can assert the epoch-millis conversion done by the component.
jest.mock('@openmetadata/ui-core-components', () => ({
  DateRangePicker: ({
    value,
    onApply,
    onCancel,
    onChange,
  }: MockDateRangePickerProps) => (
    <div data-testid="date-range-picker">
      <span data-testid="picker-value">
        {value ? JSON.stringify(value) : 'null'}
      </span>
      <button data-testid="picker-apply" onClick={onApply}>
        apply
      </button>
      <button data-testid="picker-cancel" onClick={onCancel}>
        cancel
      </button>
      <button data-testid="picker-clear" onClick={() => onChange?.(null)}>
        clear
      </button>
    </div>
  ),
}));

// 2024-01-15T00:00:00Z and 2024-01-20T00:00:00Z in epoch millis.
const START_TS = new Date('2024-01-15T00:00:00Z').getTime();
const END_TS = new Date('2024-01-20T00:00:00Z').getTime();

describe('DqDateRangeFilter', () => {
  const onApply = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the date range picker', () => {
    render(<DqDateRangeFilter onApply={onApply} />);

    expect(screen.getByTestId('date-range-picker')).toBeInTheDocument();
  });

  it('should render with null value when no timestamps are provided', () => {
    render(<DqDateRangeFilter onApply={onApply} />);

    expect(screen.getByTestId('picker-value')).toHaveTextContent('null');
  });

  it('should render with null value when only start timestamp is provided', () => {
    render(<DqDateRangeFilter startTs={START_TS} onApply={onApply} />);

    expect(screen.getByTestId('picker-value')).toHaveTextContent('null');
  });

  it('should build a staged value when both timestamps are provided', () => {
    render(
      <DqDateRangeFilter endTs={END_TS} startTs={START_TS} onApply={onApply} />
    );

    const value = screen.getByTestId('picker-value').textContent ?? '';

    expect(value).not.toBe('null');
    expect(value).toContain('start');
    expect(value).toContain('end');
  });

  it('should call onApply with epoch millis when applied with a valid range', () => {
    render(
      <DqDateRangeFilter endTs={END_TS} startTs={START_TS} onApply={onApply} />
    );

    fireEvent.click(screen.getByTestId('picker-apply'));

    expect(onApply).toHaveBeenCalledTimes(1);

    const arg = onApply.mock.calls[0][0];

    expect(typeof arg.startTs).toBe('number');
    expect(typeof arg.endTs).toBe('number');
    expect(arg.startTs).toBeLessThan(arg.endTs);
  });

  it('should commit the end boundary as the last ms of the end day', () => {
    render(
      <DqDateRangeFilter endTs={END_TS} startTs={START_TS} onApply={onApply} />
    );

    fireEvent.click(screen.getByTestId('picker-apply'));

    const { startTs, endTs } = onApply.mock.calls[0][0];
    const DAY = 24 * 60 * 60 * 1000;

    // Jan 15 00:00:00 → Jan 20 23:59:59.999 spans 6 calendar days minus 1ms.
    // Without the end-of-day fix the end resolves to midnight (5 days), so the
    // final day is excluded.
    expect(endTs - startTs).toBe(6 * DAY - 1);
  });

  it('should treat an epoch-0 timestamp as a real date, not absent', () => {
    render(<DqDateRangeFilter endTs={END_TS} startTs={0} onApply={onApply} />);

    // A truthiness check would drop startTs=0 and leave the staged value null.
    expect(screen.getByTestId('picker-value')).not.toHaveTextContent('null');
  });

  it('should not call onApply when there is no staged range', () => {
    render(<DqDateRangeFilter onApply={onApply} />);

    fireEvent.click(screen.getByTestId('picker-apply'));

    expect(onApply).not.toHaveBeenCalled();
  });

  it('should not call onApply after clearing the staged range', () => {
    render(
      <DqDateRangeFilter endTs={END_TS} startTs={START_TS} onApply={onApply} />
    );

    fireEvent.click(screen.getByTestId('picker-clear'));
    fireEvent.click(screen.getByTestId('picker-apply'));

    expect(onApply).not.toHaveBeenCalled();
  });

  it('should restore the committed range on cancel', () => {
    render(
      <DqDateRangeFilter endTs={END_TS} startTs={START_TS} onApply={onApply} />
    );

    // Stage a clear, then cancel — value should be rebuilt from props.
    fireEvent.click(screen.getByTestId('picker-clear'));

    expect(screen.getByTestId('picker-value')).toHaveTextContent('null');

    fireEvent.click(screen.getByTestId('picker-cancel'));

    expect(screen.getByTestId('picker-value')).not.toHaveTextContent('null');
  });
});
