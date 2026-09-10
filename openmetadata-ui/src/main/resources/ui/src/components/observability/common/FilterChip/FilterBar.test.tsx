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
import { FilterBar } from './FilterBar';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children, ...rest }: any) => (
    <div data-testid="box" {...rest}>
      {children}
    </div>
  ),
  Button: ({ children, onPress, iconLeading, ...rest }: any) => (
    <button onClick={onPress} {...rest}>
      {iconLeading}
      {children}
    </button>
  ),
  Dropdown: {
    Root: ({ children }: { children?: ReactNode }) => (
      <div data-testid="dropdown-root">{children}</div>
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
          data-testid="select-adv-a"
          onClick={() => onSelectionChange?.(new Set(['adv-a']))}>
          select adv-a
        </button>
        <button
          data-testid="select-adv-all-string"
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
  PlusCircle: () => <span data-testid="icon-plus-circle" />,
  XCircle: () => <span data-testid="icon-x-circle" />,
}));

jest.mock('./FilterChip', () => ({
  __esModule: true,
  default: ({ descriptor }: any) => (
    <div data-testid={`filter-chip-${descriptor.key}`}>{descriptor.label}</div>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

const getDefaultProps = () => ({
  filters: [],
  advancedMenu: [
    { key: 'adv-a', label: 'Advanced A' },
    { key: 'adv-b', label: 'Advanced B' },
  ],
  selectedFilter: [],
  hasActiveFilters: false,
  onToggleFilter: jest.fn(),
  onClearAll: jest.fn(),
});

describe('FilterBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the filter bar container', () => {
    render(<FilterBar {...(getDefaultProps() as any)} />);

    expect(screen.getByTestId('filter-bar')).toBeInTheDocument();
  });

  it('should render the advanced filter button', () => {
    render(<FilterBar {...(getDefaultProps() as any)} />);

    expect(screen.getByTestId('advanced-filter')).toBeInTheDocument();
    expect(screen.getByText('label.advanced')).toBeInTheDocument();
  });

  it('should render the advanced menu items', () => {
    render(<FilterBar {...(getDefaultProps() as any)} />);

    expect(screen.getByText('Advanced A')).toBeInTheDocument();
    expect(screen.getByText('Advanced B')).toBeInTheDocument();
  });

  it('should render a chip for each provided filter descriptor', () => {
    const props = {
      ...getDefaultProps(),
      filters: [
        { key: 'status', label: 'Status' },
        { key: 'platform', label: 'Platform' },
      ],
    };
    render(<FilterBar {...(props as any)} />);

    expect(screen.getByTestId('filter-chip-status')).toBeInTheDocument();
    expect(screen.getByTestId('filter-chip-platform')).toBeInTheDocument();
  });

  it('should call onToggleFilter when an advanced menu item is newly selected', () => {
    const props = getDefaultProps();
    render(<FilterBar {...(props as any)} />);

    fireEvent.click(screen.getByTestId('select-adv-a'));

    expect(props.onToggleFilter).toHaveBeenCalledWith({ key: 'adv-a' });
  });

  it('should toggle off an item that is deselected', () => {
    // adv-a is currently selected; selecting only adv-a again => unchanged,
    // but selecting nothing-set with adv-a previously selected toggles it off.
    const props = { ...getDefaultProps(), selectedFilter: ['adv-a', 'adv-b'] };
    render(<FilterBar {...(props as any)} />);

    // The mock emits Set(['adv-a']) — adv-b goes from selected -> absent.
    fireEvent.click(screen.getByTestId('select-adv-a'));

    expect(props.onToggleFilter).toHaveBeenCalledWith({ key: 'adv-b' });
  });

  it('should ignore the "all" selection sentinel', () => {
    const props = getDefaultProps();
    render(<FilterBar {...(props as any)} />);

    fireEvent.click(screen.getByTestId('select-adv-all-string'));

    expect(props.onToggleFilter).not.toHaveBeenCalled();
  });

  it('should not render the clear-all button when there are no active filters', () => {
    render(<FilterBar {...(getDefaultProps() as any)} />);

    expect(
      screen.queryByTestId('clear-all-filter-btn')
    ).not.toBeInTheDocument();
  });

  it('should render the clear-all button when there are active filters', () => {
    const props = { ...getDefaultProps(), hasActiveFilters: true };
    render(<FilterBar {...(props as any)} />);

    expect(screen.getByTestId('clear-all-filter-btn')).toBeInTheDocument();
  });

  it('should call onClearAll when the clear-all button is clicked', () => {
    const props = { ...getDefaultProps(), hasActiveFilters: true };
    render(<FilterBar {...(props as any)} />);

    fireEvent.click(screen.getByTestId('clear-all-filter-btn'));

    expect(props.onClearAll).toHaveBeenCalledTimes(1);
  });

  it('should handle a null advanced menu without crashing', () => {
    const props = { ...getDefaultProps(), advancedMenu: null };
    render(<FilterBar {...(props as any)} />);

    expect(screen.getByTestId('filter-bar')).toBeInTheDocument();
  });
});
