import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TimePicker } from './time-picker';

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
});
