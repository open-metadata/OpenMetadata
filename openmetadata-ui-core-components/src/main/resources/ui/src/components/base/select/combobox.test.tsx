import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('clears the typed text and selection when allowClear is set', () => {
    const items = [{ id: 'email', label: 'Email' }];
    const onInputChange = vi.fn();
    const onSelectionChange = vi.fn();

    render(
      <ComboBox
        allowClear
        aria-label="Destination"
        defaultSelectedKey="email"
        items={items}
        onInputChange={onInputChange}
        onSelectionChange={onSelectionChange}>
        {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
      </ComboBox>
    );

    fireEvent.click(screen.getByTestId('combobox-clear'));

    expect(onSelectionChange).toHaveBeenCalledWith(null);
    expect(onInputChange).toHaveBeenLastCalledWith('');
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.queryByTestId('combobox-clear')).not.toBeInTheDocument();
  });

  it('hides the clear button while the input is empty', () => {
    render(
      <ComboBox allowClear aria-label="Destination" items={[]}>
        {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
      </ComboBox>
    );

    expect(screen.queryByTestId('combobox-clear')).not.toBeInTheDocument();
  });
});
