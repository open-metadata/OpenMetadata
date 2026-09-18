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
import { ReactNode } from 'react';
import DqSearchFilterChip from './DqSearchFilterChip';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children, ...rest }: any) => (
    <div data-testid="box" {...rest}>
      {children}
    </div>
  ),
  Button: ({ children, onPress, iconTrailing, ...rest }: any) => (
    <button onClick={onPress} {...rest}>
      {children}
      {iconTrailing}
    </button>
  ),
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange: (...args: unknown[]) => void;
    placeholder?: string;
  }) => (
    <input
      aria-label="search-input"
      data-testid="search-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  Dropdown: {
    Root: ({
      children,
      isOpen,
      onOpenChange,
    }: {
      children?: ReactNode;
      isOpen?: boolean;
      onOpenChange?: (...args: unknown[]) => void;
    }) => (
      <div data-isopen={isOpen ? 'true' : 'false'} data-testid="dropdown-root">
        <button
          data-testid="dropdown-toggle"
          onClick={() => onOpenChange?.(!isOpen)}>
          toggle
        </button>
        {children}
      </div>
    ),
    Popover: ({ children }: { children?: ReactNode }) => (
      <div data-testid="dropdown-popover">{children}</div>
    ),
    Menu: ({
      children,
      onSelectionChange,
    }: {
      children?: ReactNode;
      onSelectionChange?: (...args: unknown[]) => void;
    }) => (
      <div data-testid="dropdown-menu">
        <button
          data-testid="select-opt-1"
          onClick={() => onSelectionChange?.(new Set(['opt-1']))}>
          select opt-1
        </button>
        <button
          data-testid="select-all"
          onClick={() => onSelectionChange?.('all')}>
          select all
        </button>
        {children}
      </div>
    ),
    Item: ({ label }: { label?: ReactNode }) => (
      <div data-testid="dropdown-item">{label}</div>
    ),
  },
}));

jest.mock('@untitledui/icons', () => ({
  ChevronDown: () => <span data-testid="icon-chevron" />,
  SearchLg: () => <span data-testid="icon-search" />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const buildSearchProps = (overrides: Record<string, any> = {}) => ({
  options: [{ key: 'opt-1', label: 'Option 1' }],
  selectedKeys: [],
  onChange: jest.fn(),
  onGetInitialOptions: jest.fn(),
  onSearch: jest.fn(),
  ...overrides,
});

const getDefaultProps = (searchOverrides: Record<string, any> = {}) => ({
  label: 'Tags',
  searchKey: 'tags',
  searchProps: buildSearchProps(searchOverrides),
  isOpen: false,
  onOpenChange: jest.fn(),
});

describe('DqSearchFilterChip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the trigger with the plain label when nothing is selected', () => {
    render(<DqSearchFilterChip {...(getDefaultProps() as any)} />);

    expect(screen.getByTestId('search-dropdown-tags')).toHaveTextContent(
      'Tags'
    );
  });

  it('should render the selection count in the trigger label', () => {
    const props = getDefaultProps({
      selectedKeys: [{ key: 'opt-1', label: 'Option 1' }],
    });
    render(<DqSearchFilterChip {...(props as any)} />);

    expect(screen.getByTestId('search-dropdown-tags')).toHaveTextContent(
      'Tags · 1'
    );
  });

  it('should render a staged selection that is missing from the fetched options', () => {
    const props = getDefaultProps({
      selectedKeys: [{ key: 'persisted', label: 'Persisted Tag' }],
      options: [{ key: 'opt-1', label: 'Option 1' }],
    });
    render(<DqSearchFilterChip {...(props as any)} />);

    fireEvent.click(screen.getByTestId('dropdown-toggle'));

    const items = screen.getAllByTestId('dropdown-item');

    expect(items.some((el) => el.textContent?.includes('Persisted Tag'))).toBe(
      true
    );
    expect(items.some((el) => el.textContent?.includes('Option 1'))).toBe(true);
  });

  it('should fetch initial options and forward open state when opened', () => {
    const props = getDefaultProps();
    render(<DqSearchFilterChip {...(props as any)} />);

    fireEvent.click(screen.getByTestId('dropdown-toggle'));

    expect(props.searchProps.onGetInitialOptions).toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(true);
  });

  it('should stage a selection and commit it on Apply', () => {
    const props = getDefaultProps();
    render(<DqSearchFilterChip {...(props as any)} />);

    fireEvent.click(screen.getByTestId('dropdown-toggle'));
    fireEvent.click(screen.getByTestId('select-opt-1'));
    fireEvent.click(screen.getByTestId('apply-filter-btn'));

    expect(props.searchProps.onChange).toHaveBeenCalledWith([
      { key: 'opt-1', label: 'Option 1' },
    ]);
  });

  it('should reset staged selections when Clear is pressed', () => {
    const props = getDefaultProps();
    render(<DqSearchFilterChip {...(props as any)} />);

    fireEvent.click(screen.getByTestId('dropdown-toggle'));
    fireEvent.click(screen.getByTestId('select-opt-1'));
    fireEvent.click(screen.getByTestId('clear-filter-btn'));
    fireEvent.click(screen.getByTestId('apply-filter-btn'));

    expect(props.searchProps.onChange).toHaveBeenCalledWith([]);
  });

  it('should not commit changes when Cancel is pressed', () => {
    const props = getDefaultProps();
    render(<DqSearchFilterChip {...(props as any)} />);

    fireEvent.click(screen.getByTestId('dropdown-toggle'));
    fireEvent.click(screen.getByTestId('select-opt-1'));
    fireEvent.click(screen.getByTestId('cancel-filter-btn'));

    expect(props.searchProps.onChange).not.toHaveBeenCalled();
  });

  it('should forward the typed query to onSearch', () => {
    const props = getDefaultProps();
    render(<DqSearchFilterChip {...(props as any)} />);

    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'abc' },
    });

    expect(props.searchProps.onSearch).toHaveBeenCalledWith('abc');
  });

  it('should ignore an all-selection change', () => {
    const props = getDefaultProps();
    render(<DqSearchFilterChip {...(props as any)} />);

    fireEvent.click(screen.getByTestId('dropdown-toggle'));
    fireEvent.click(screen.getByTestId('select-all'));
    fireEvent.click(screen.getByTestId('apply-filter-btn'));

    expect(props.searchProps.onChange).toHaveBeenCalledWith([]);
  });
});
