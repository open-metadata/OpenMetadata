import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DatePicker } from './date-picker';

describe('DatePicker trigger variants', () => {
  it('defaults to the compact secondary button', () => {
    render(<DatePicker aria-label="Start date" />);

    expect(screen.getByRole('button')).not.toHaveClass('tw:w-full');
  });

  it('shapes the input trigger like a text field so a form column lines up', () => {
    render(
      <DatePicker
        aria-label="Start date"
        placeholder="Pick a day"
        triggerVariant="input"
      />
    );

    const trigger = screen.getByRole('button');

    // The same radius, surface and outline border `Input`'s wrapper draws.
    expect(trigger).toHaveClass('tw:w-full');
    expect(trigger).toHaveClass('tw:rounded-lg');
    expect(trigger).toHaveClass('tw:outline-primary');
    // Unset reads as a placeholder, not as a chosen value.
    expect(screen.getByText('Pick a day')).toHaveClass('tw:text-placeholder');
  });
});
