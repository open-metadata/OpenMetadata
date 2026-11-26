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
import { createRef } from 'react';
import GlobalSearchInput, { GlobalSearchInputProps } from './GlobalSearchInput';

const onChange = jest.fn();
const onClear = jest.fn();
const onClose = jest.fn();
const onKeyDown = jest.fn();

const renderInput = (props: Partial<GlobalSearchInputProps> = {}) => {
  const inputRef = createRef<HTMLInputElement>();
  render(
    <GlobalSearchInput
      inputRef={inputRef}
      isLoading={false}
      listboxIds={[]}
      placeholder="Search"
      value=""
      onChange={onChange}
      onClear={onClear}
      onClose={onClose}
      onKeyDown={onKeyDown}
      {...props}
    />
  );

  return screen.getByTestId('global-search-input');
};

describe('GlobalSearchInput', () => {
  it('focuses the input on mount', () => {
    const input = renderInput();

    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('placeholder', 'Search');
  });

  it('is a combobox that controls the result listboxes and names the active option', () => {
    const input = renderInput({
      listboxIds: ['list-a', 'list-b'],
      activeOptionId: 'option-1',
    });

    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', 'list-a list-b');
    expect(input).toHaveAttribute('aria-activedescendant', 'option-1');
  });

  it('shows a spinner and a progress line while loading', () => {
    renderInput({ isLoading: true });

    expect(screen.getByTestId('global-search-progress')).toHaveAttribute(
      'role',
      'progressbar'
    );
    expect(
      screen
        .getByTestId('global-search-progress')
        .parentElement?.querySelector('[data-icon="loading"]')
    ).toBeInTheDocument();
  });

  it('reports typing and key presses', () => {
    const input = renderInput();

    fireEvent.change(input, { target: { value: 'orders' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('orders');
    expect(onKeyDown).toHaveBeenCalled();
    expect(
      screen.queryByTestId('global-search-progress')
    ).not.toBeInTheDocument();
  });

  it('asks to clear the whole search from the clear button', () => {
    renderInput({ value: 'orders' });

    fireEvent.click(screen.getByRole('button', { name: 'label.clear' }));

    expect(onClear).toHaveBeenCalled();
  });

  it('hides clear when empty and closes from the close button', () => {
    renderInput();

    expect(
      screen.queryByRole('button', { name: 'label.clear' })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('global-search-close'));

    expect(onClose).toHaveBeenCalled();
  });
});
