import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ComboBox } from './combobox';
import { SelectItem } from './select-item';

describe('ComboBox', () => {
  it('keeps the native input text transparent when disabled', () => {
    const items = [{ id: 'email', label: 'Email' }];

    render(
      <ComboBox
        isDisabled
        aria-label="Destination"
        defaultSelectedKey="email"
        items={items}>
        {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
      </ComboBox>
    );

    const input = screen.getByRole('combobox');

    expect(input).toHaveClass('tw:text-transparent');
    expect(input).not.toHaveClass('tw:disabled:text-disabled');
  });

  it('does not open the options when disabled', () => {
    const items = [{ id: 'email', label: 'Email' }];

    render(
      <ComboBox
        isDisabled
        aria-label="Destination"
        defaultSelectedKey="email"
        items={items}>
        {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
      </ComboBox>
    );

    const input = screen.getByRole('combobox');

    fireEvent.pointerDown(input.parentElement as HTMLElement);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
