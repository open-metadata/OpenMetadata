import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TimePicker, type TimePickerValue } from './time-picker';

const getSegmentValues = () =>
  screen
    .getAllByRole('spinbutton')
    .map((segment) => segment.getAttribute('aria-valuenow'));

describe('TimePicker', () => {
  it('shows hour and minute segments by default', () => {
    render(
      <TimePicker
        aria-label="Time"
        hourCycle={24}
        value={{ hour: 15, minute: 35 }}
      />
    );

    expect(getSegmentValues()).toEqual(['15', '35']);
  });

  it('shows and reports seconds when granularity is second', async () => {
    const onChange = vi.fn();
    render(
      <TimePicker
        aria-label="Time"
        granularity="second"
        hourCycle={24}
        value={{ hour: 15, minute: 35, second: 59 }}
        onChange={onChange}
      />
    );

    expect(getSegmentValues()).toEqual(['15', '35', '59']);

    const [, , seconds] = screen.getAllByRole('spinbutton');
    await userEvent.click(seconds);
    await userEvent.keyboard('{ArrowDown}');

    expect(onChange).toHaveBeenLastCalledWith({
      hour: 15,
      minute: 35,
      second: 58,
    });
  });

  it('omits seconds from the reported value without second granularity', async () => {
    const onChange = vi.fn();
    render(
      <TimePicker
        aria-label="Time"
        hourCycle={24}
        value={{ hour: 15, minute: 35 }}
        onChange={onChange}
      />
    );

    const [, minutes] = screen.getAllByRole('spinbutton');
    await userEvent.click(minutes);
    await userEvent.keyboard('{ArrowUp}');

    expect(onChange).toHaveBeenLastCalledWith({ hour: 15, minute: 36 });
  });

  it('reports a half-typed time as incomplete until every segment is set', async () => {
    const onChange = vi.fn();
    const onIncompleteChange = vi.fn();
    const ControlledTimePicker = () => {
      const [value, setValue] = useState<TimePickerValue | null>(null);

      return (
        <TimePicker
          aria-label="Time"
          hourCycle={24}
          value={value}
          onChange={(time) => {
            onChange(time);
            setValue(time);
          }}
          onIncompleteChange={onIncompleteChange}
        />
      );
    };
    render(<ControlledTimePicker />);

    expect(onIncompleteChange).toHaveBeenLastCalledWith(false);

    const [hours] = screen.getAllByRole('spinbutton');
    await userEvent.click(hours);
    await userEvent.keyboard('09');

    expect(onIncompleteChange).toHaveBeenLastCalledWith(true);
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.keyboard('30');

    expect(onIncompleteChange).toHaveBeenLastCalledWith(false);
    expect(onChange).toHaveBeenLastCalledWith({ hour: 9, minute: 30 });
  });

  it('reports a partly cleared time as incomplete', async () => {
    const onIncompleteChange = vi.fn();
    render(
      <TimePicker
        aria-label="Time"
        granularity="second"
        hourCycle={24}
        value={{ hour: 14, minute: 30, second: 5 }}
        onIncompleteChange={onIncompleteChange}
      />
    );

    const [, , seconds] = screen.getAllByRole('spinbutton');
    await userEvent.click(seconds);
    await userEvent.keyboard('{Backspace}');

    expect(onIncompleteChange).toHaveBeenLastCalledWith(true);
  });
});
