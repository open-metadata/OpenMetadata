import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from '../../base/input/input';
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

  it('sizes the input trigger like a default Input so the two match in height', () => {
    render(
      <>
        <Input aria-label="Name" />
        <DatePicker aria-label="Start date" triggerVariant="input" />
      </>
    );

    const field = screen.getByRole('textbox', { name: 'Name' });
    const trigger = screen.getByRole('button');

    for (const sizeClass of ['tw:px-3', 'tw:py-2', 'tw:text-sm']) {
      expect(field).toHaveClass(sizeClass);
      expect(trigger).toHaveClass(sizeClass);
    }
  });

  it('turns the input trigger red when the field is invalid', () => {
    render(
      <DatePicker isInvalid aria-label="Start date" triggerVariant="input" />
    );

    // `isInvalid` is a field-level prop on the picker; react-aria never hands
    // it to a plain Button's render props, so the trigger has to read it off
    // the picker itself or an errored date stays neutral next to an errored
    // Input.
    expect(screen.getByRole('button')).toHaveClass('tw:outline-error_subtle');
  });
});
