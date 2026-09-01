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
import { DqFilterBar } from './DqFilterBar';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children, ...rest }: any) => (
    <div data-testid="box" {...rest}>
      {children}
    </div>
  ),
  Button: ({ children, onPress, iconLeading, iconTrailing, ...rest }: any) => (
    <button onClick={onPress} {...rest}>
      {iconLeading}
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
    onChange?: (...args: never[]) => void;
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
    // Root keeps the trigger always visible (as react-aria does); the toggle
    // drives `onOpenChange`, and `isOpen` is threaded to the Popover via a
    // data attribute the Popover mock reads through context-free props.
    Root: ({
      children,
      isOpen,
      onOpenChange,
    }: {
      children?: ReactNode;
      isOpen?: boolean;
      onOpenChange?: (...args: never[]) => void;
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
      onSelectionChange?: (...args: never[]) => void;
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
  XCircle: () => <span data-testid="icon-x-circle" />,
}));

jest.mock(
  'components/common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: ({ children, onUpdate, popoverProps }: any) => (
      <div
        data-owner-open={popoverProps?.open ? 'true' : 'false'}
        data-testid="user-team-selectable-list">
        <button
          data-testid="owner-toggle"
          onClick={() => popoverProps?.onOpenChange?.(!popoverProps?.open)}>
          toggle owner
        </button>
        <button
          data-testid="owner-update"
          onClick={() => onUpdate?.([{ id: 'u1', type: 'user' }])}>
          update owner
        </button>
        {children}
      </div>
    ),
  })
);

jest.mock('./DqDateRangeFilter', () => ({
  __esModule: true,
  default: ({ onApply }: { onApply?: (...args: never[]) => void }) => (
    <div data-testid="dq-date-range-filter">
      <button
        data-testid="date-apply"
        onClick={() => onApply({ startTs: 1, endTs: 2 })}>
        apply date
      </button>
    </div>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

const buildSearchFilter = (overrides: Record<string, any> = {}) => ({
  type: 'search' as const,
  key: 'tags',
  label: 'Tags',
  searchKey: 'tags',
  selectedOwnerKeys: [],
  searchProps: {
    options: [{ key: 'opt-1', label: 'Option 1' }],
    selectedKeys: [],
    onChange: jest.fn(),
    onGetInitialOptions: jest.fn(),
    onSearch: jest.fn(),
    ...overrides.searchProps,
  },
  ...overrides,
});

const buildOwnerFilter = (overrides: Record<string, any> = {}) => ({
  type: 'owner' as const,
  key: 'owner',
  label: 'Owner',
  selectedOwners: [],
  selectedOwnerKeys: [],
  onChange: jest.fn(),
  ...overrides,
});

const getDefaultProps = () => ({
  filters: [],
  dateRange: { startTs: 100, endTs: 200 },
  onDateRangeChange: jest.fn(),
  showFilterBar: true,
  hasVisibleFilters: true,
  hasActiveFilters: false,
  clearAll: jest.fn(),
});

describe('DqFilterBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the filter bar container', () => {
    render(<DqFilterBar {...(getDefaultProps() as any)} />);

    expect(screen.getByTestId('dq-filter-bar')).toBeInTheDocument();
  });

  it('should always render the date range filter', () => {
    render(<DqFilterBar {...(getDefaultProps() as any)} />);

    expect(screen.getByTestId('dq-date-range-filter')).toBeInTheDocument();
  });

  it('should forward date range selection to onDateRangeChange', () => {
    const props = getDefaultProps();
    render(<DqFilterBar {...(props as any)} />);

    fireEvent.click(screen.getByTestId('date-apply'));

    expect(props.onDateRangeChange).toHaveBeenCalledWith({
      startTs: 1,
      endTs: 2,
    });
  });

  it('should render search filter chips when filters are visible', () => {
    const props = { ...getDefaultProps(), filters: [buildSearchFilter()] };
    render(<DqFilterBar {...(props as any)} />);

    expect(screen.getByTestId('search-dropdown-tags')).toBeInTheDocument();
  });

  it('should render owner filter chip using UserTeamSelectableList', () => {
    const props = { ...getDefaultProps(), filters: [buildOwnerFilter()] };
    render(<DqFilterBar {...(props as any)} />);

    expect(screen.getByTestId('user-team-selectable-list')).toBeInTheDocument();
    expect(screen.getByTestId('search-dropdown-owner')).toBeInTheDocument();
  });

  it('should call owner onChange when the owner is updated', () => {
    const ownerFilter = buildOwnerFilter();
    const props = { ...getDefaultProps(), filters: [ownerFilter] };
    render(<DqFilterBar {...(props as any)} />);

    fireEvent.click(screen.getByTestId('owner-update'));

    expect(ownerFilter.onChange).toHaveBeenCalledWith([
      { id: 'u1', type: 'user' },
    ]);
  });

  it('should not render filter chips when showFilterBar is false', () => {
    const props = {
      ...getDefaultProps(),
      showFilterBar: false,
      filters: [buildSearchFilter()],
    };
    render(<DqFilterBar {...(props as any)} />);

    expect(
      screen.queryByTestId('search-dropdown-tags')
    ).not.toBeInTheDocument();
  });

  it('should not render filter chips when hasVisibleFilters is false', () => {
    const props = {
      ...getDefaultProps(),
      hasVisibleFilters: false,
      filters: [buildSearchFilter()],
    };
    render(<DqFilterBar {...(props as any)} />);

    expect(
      screen.queryByTestId('search-dropdown-tags')
    ).not.toBeInTheDocument();
  });

  it('should not render the clear-all button when there are no active filters', () => {
    render(<DqFilterBar {...(getDefaultProps() as any)} />);

    expect(
      screen.queryByTestId('clear-all-filter-btn')
    ).not.toBeInTheDocument();
  });

  it('should render the clear-all button when there are active filters', () => {
    const props = { ...getDefaultProps(), hasActiveFilters: true };
    render(<DqFilterBar {...(props as any)} />);

    expect(screen.getByTestId('clear-all-filter-btn')).toBeInTheDocument();
  });

  it('should call clearAll when the clear-all button is clicked', () => {
    const props = { ...getDefaultProps(), hasActiveFilters: true };
    render(<DqFilterBar {...(props as any)} />);

    fireEvent.click(screen.getByTestId('clear-all-filter-btn'));

    expect(props.clearAll).toHaveBeenCalledTimes(1);
  });

  it('should stage and commit search selections via Apply', () => {
    const filter = buildSearchFilter();
    const props = { ...getDefaultProps(), filters: [filter] };
    render(<DqFilterBar {...(props as any)} />);

    // Open the dropdown, which triggers the initial options fetch.
    fireEvent.click(screen.getByTestId('dropdown-toggle'));

    expect(filter.searchProps.onGetInitialOptions).toHaveBeenCalled();

    // Stage a selection then apply.
    fireEvent.click(screen.getByTestId('select-opt-1'));
    fireEvent.click(screen.getByTestId('apply-filter-btn'));

    expect(filter.searchProps.onChange).toHaveBeenCalledWith([
      { key: 'opt-1', label: 'Option 1' },
    ]);
  });

  it('should show the selection count in the chip label', () => {
    const filter = buildSearchFilter();
    filter.searchProps.selectedKeys = [{ key: 'opt-1', label: 'Option 1' }];
    const props = { ...getDefaultProps(), filters: [filter] };
    render(<DqFilterBar {...(props as any)} />);

    expect(screen.getByTestId('search-dropdown-tags')).toHaveTextContent(
      'Tags · 1'
    );
  });

  it('should call onSearch when typing and reset the query on close', () => {
    const filter = buildSearchFilter();
    const props = { ...getDefaultProps(), filters: [filter] };
    render(<DqFilterBar {...(props as any)} />);

    fireEvent.click(screen.getByTestId('dropdown-toggle'));
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'abc' } });

    expect(filter.searchProps.onSearch).toHaveBeenCalledWith('abc');
    expect((input as HTMLInputElement).value).toBe('abc');

    fireEvent.click(screen.getByTestId('dropdown-toggle'));
    fireEvent.click(screen.getByTestId('dropdown-toggle'));

    expect((screen.getByTestId('search-input') as HTMLInputElement).value).toBe(
      ''
    );
  });

  it('should reset staged selections when Clear is pressed', () => {
    const filter = buildSearchFilter();
    const props = { ...getDefaultProps(), filters: [filter] };
    render(<DqFilterBar {...(props as any)} />);

    fireEvent.click(screen.getByTestId('dropdown-toggle'));
    fireEvent.click(screen.getByTestId('select-opt-1'));
    fireEvent.click(screen.getByTestId('clear-filter-btn'));
    fireEvent.click(screen.getByTestId('apply-filter-btn'));

    expect(filter.searchProps.onChange).toHaveBeenCalledWith([]);
  });

  it('should not commit changes when Cancel is pressed', () => {
    const filter = buildSearchFilter();
    const props = { ...getDefaultProps(), filters: [filter] };
    render(<DqFilterBar {...(props as any)} />);

    fireEvent.click(screen.getByTestId('dropdown-toggle'));
    fireEvent.click(screen.getByTestId('select-opt-1'));
    fireEvent.click(screen.getByTestId('cancel-filter-btn'));

    expect(filter.searchProps.onChange).not.toHaveBeenCalled();
  });

  it('should ignore an all-selection change', () => {
    const filter = buildSearchFilter();
    const props = { ...getDefaultProps(), filters: [filter] };
    render(<DqFilterBar {...(props as any)} />);

    fireEvent.click(screen.getByTestId('dropdown-toggle'));
    fireEvent.click(screen.getByTestId('select-all'));
    fireEvent.click(screen.getByTestId('apply-filter-btn'));

    expect(filter.searchProps.onChange).toHaveBeenCalledWith([]);
  });

  it('should close the open search chip when another search chip opens', () => {
    const props = {
      ...getDefaultProps(),
      filters: [
        buildSearchFilter({ key: 'tags', searchKey: 'tags', label: 'Tags' }),
        buildSearchFilter({ key: 'tier', searchKey: 'tier', label: 'Tier' }),
      ],
    };
    render(<DqFilterBar {...(props as any)} />);

    const roots = screen.getAllByTestId('dropdown-root');
    const toggles = screen.getAllByTestId('dropdown-toggle');

    fireEvent.click(toggles[0]);

    expect(roots[0]).toHaveAttribute('data-isopen', 'true');
    expect(roots[1]).toHaveAttribute('data-isopen', 'false');

    fireEvent.click(toggles[1]);

    expect(roots[0]).toHaveAttribute('data-isopen', 'false');
    expect(roots[1]).toHaveAttribute('data-isopen', 'true');
  });

  it('should close the owner popover when a search chip opens', () => {
    const props = {
      ...getDefaultProps(),
      filters: [buildOwnerFilter(), buildSearchFilter()],
    };
    render(<DqFilterBar {...(props as any)} />);

    const owner = screen.getByTestId('user-team-selectable-list');

    fireEvent.click(screen.getByTestId('owner-toggle'));

    expect(owner).toHaveAttribute('data-owner-open', 'true');

    fireEvent.click(screen.getByTestId('dropdown-toggle'));

    expect(owner).toHaveAttribute('data-owner-open', 'false');
    expect(screen.getByTestId('dropdown-root')).toHaveAttribute(
      'data-isopen',
      'true'
    );
  });
});
