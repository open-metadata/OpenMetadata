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
import FilterChip from './FilterChip';

/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('@openmetadata/ui-core-components', () => {
  const Dropdown: any = {
    Root: ({
      children,
      isOpen,
      onOpenChange,
    }: {
      children?: ReactNode;
      isOpen?: boolean;
      onOpenChange: (...args: unknown[]) => void;
    }) => (
      <div data-open={isOpen} data-testid="dropdown-root">
        <button
          data-testid="dropdown-toggle"
          onClick={() => onOpenChange(!isOpen)}>
          toggle
        </button>
        {children}
      </div>
    ),
    Popover: ({
      children,
      className,
    }: {
      children?: ReactNode;
      className?: string;
    }) => (
      <div className={className} data-testid="dropdown-popover">
        {children}
      </div>
    ),
    Menu: ({ children, onSelectionChange, selectionMode }: any) => (
      <div data-selection-mode={selectionMode} data-testid="dropdown-menu">
        <button
          data-testid="select-a"
          onClick={() => onSelectionChange(new Set(['a']))}>
          select-a
        </button>
        <button
          data-testid="select-all"
          onClick={() => onSelectionChange('all')}>
          select-all
        </button>
        {children}
      </div>
    ),
    // `isSelected` is derived from the option id so the single-select item's
    // selected branch (className fn + Check icon) is exercised.
    Item: ({
      children,
      label,
      id,
      className,
    }: {
      // react-aria passes render props for both slots.
      children?: ReactNode | ((state: { isSelected: boolean }) => ReactNode);
      label?: ReactNode;
      id: string;
      className?:
        | string
        | ((state: { isSelected: boolean }) => string | undefined);
    }) => {
      const isSelected = id === 'success';
      const cls =
        typeof className === 'function' ? className({ isSelected }) : className;

      return (
        <div className={cls} data-id={id} data-testid="dropdown-item">
          {label}
          {typeof children === 'function' ? children({ isSelected }) : children}
        </div>
      );
    },
  };

  return {
    Box: ({
      children,
      className,
    }: {
      children?: ReactNode;
      className?: string;
    }) => (
      <div className={className} data-testid="box">
        {children}
      </div>
    ),
    Button: ({ children, onPress, isDisabled, ...rest }: any) => (
      <button
        data-testid={rest['data-testid']}
        disabled={isDisabled}
        onClick={onPress}>
        {children}
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
    Dropdown,
  };
});

jest.mock('@untitledui/icons', () => ({
  Check: () => <span data-testid="check-icon" />,
  ChevronDown: () => <span data-testid="chevron-icon" />,
  Columns01: () => <span data-testid="columns-icon" />,
  LayoutAlt04: () => <span data-testid="layout-icon" />,
  SearchLg: () => <span data-testid="search-icon" />,
  Table: () => <span data-testid="table-icon" />,
}));

jest.mock('../../DataQuality/Dashboard/DqDateRangeFilter', () => ({
  __esModule: true,
  default: ({ onApply, startTs, endTs }: any) => (
    <button
      data-end={endTs}
      data-start={startTs}
      data-testid="date-range-filter"
      onClick={() => onApply({ startTs: 1, endTs: 2 })}>
      date-filter
    </button>
  ),
}));

jest.mock(
  'components/common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: ({
      children,
      onUpdate,
    }: {
      children?: ReactNode;
      onUpdate: (...args: unknown[]) => void;
    }) => (
      <div data-testid="user-team-selectable-list">
        {children}
        <button
          data-testid="trigger-owner-update"
          onClick={() => onUpdate([{ id: 'owner-1', name: 'owner-1' }])}>
          update-owner
        </button>
      </div>
    ),
  })
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const baseDescriptor = (overrides: any = {}) => ({
  label: 'Status',
  key: 'status',
  controlType: 'multiselect',
  searchable: false,
  value: [],
  options: [
    { label: 'Success', value: 'success' },
    { label: 'Failed', value: 'failed' },
  ],
  onChange: jest.fn(),
  onGetInitialOptions: jest.fn(),
  onSearch: jest.fn(),
  ...overrides,
});

describe('FilterChip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the date range filter for date control type', () => {
    const descriptor = baseDescriptor({
      controlType: 'date',
      value: { startTs: 100, endTs: 200 },
    });
    render(<FilterChip descriptor={descriptor as any} />);

    expect(screen.getByTestId('date-range-filter')).toBeInTheDocument();
  });

  it('should forward onApply to descriptor.onChange for date control', () => {
    const onChange = jest.fn();
    const descriptor = baseDescriptor({
      controlType: 'date',
      value: {},
      onChange,
    });
    render(<FilterChip descriptor={descriptor as any} />);

    fireEvent.click(screen.getByTestId('date-range-filter'));

    expect(onChange).toHaveBeenCalledWith({ startTs: 1, endTs: 2 });
  });

  it('should render the select chip trigger with label when nothing selected', () => {
    render(<FilterChip descriptor={baseDescriptor() as any} />);

    expect(screen.getByTestId('search-dropdown-status')).toHaveTextContent(
      'Status'
    );
  });

  it('should show count in trigger for multiselect with committed values', () => {
    render(
      <FilterChip
        descriptor={baseDescriptor({ value: ['success', 'failed'] }) as any}
      />
    );

    expect(screen.getByTestId('search-dropdown-status')).toHaveTextContent(
      'Status · 2'
    );
  });

  it('should show selected option label for single select', () => {
    render(
      <FilterChip
        descriptor={
          baseDescriptor({
            controlType: 'select',
            value: 'success',
          }) as any
        }
      />
    );

    expect(screen.getByTestId('search-dropdown-status')).toHaveTextContent(
      'Success'
    );
  });

  it('should render a persisted single-select value missing from the fetched options', () => {
    render(
      <FilterChip
        descriptor={
          baseDescriptor({
            key: 'tableFqn',
            label: 'Table',
            controlType: 'select',
            searchable: true,
            value: 'svc.db.schema.selected_table',
            options: [{ label: 'Other Table', value: 'svc.db.schema.other' }],
          }) as any
        }
      />
    );

    // Trigger resolves the selected FQN to its name instead of the bare label.
    expect(screen.getByTestId('search-dropdown-tableFqn')).toHaveTextContent(
      'selected_table'
    );

    // The selected item is rendered in the menu so it can show as checked.
    fireEvent.click(screen.getByTestId('dropdown-toggle'));

    expect(
      screen
        .getAllByTestId('dropdown-item')
        .some((el) => el.textContent?.includes('selected_table'))
    ).toBe(true);
  });

  it('should render a persisted multiselect value missing from the fetched options', () => {
    render(
      <FilterChip
        descriptor={
          baseDescriptor({
            key: 'tags',
            label: 'Tags',
            controlType: 'multiselect',
            searchable: true,
            value: ['classification.Tier1'],
            options: [],
          }) as any
        }
      />
    );

    fireEvent.click(screen.getByTestId('dropdown-toggle'));

    expect(
      screen
        .getAllByTestId('dropdown-item')
        .some((el) => el.textContent?.includes('Tier1'))
    ).toBe(true);
  });

  it('should call onGetInitialOptions when dropdown opens', () => {
    const onGetInitialOptions = jest.fn();
    render(
      <FilterChip descriptor={baseDescriptor({ onGetInitialOptions }) as any} />
    );

    fireEvent.click(screen.getByTestId('dropdown-toggle'));

    expect(onGetInitialOptions).toHaveBeenCalled();
  });

  it('should render search input only when searchable', () => {
    const { rerender } = render(
      <FilterChip descriptor={baseDescriptor() as any} />
    );

    expect(screen.queryByTestId('search-input')).not.toBeInTheDocument();

    rerender(
      <FilterChip descriptor={baseDescriptor({ searchable: true }) as any} />
    );

    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('should call onSearch when typing in the search box', () => {
    const onSearch = jest.fn();
    render(
      <FilterChip
        descriptor={baseDescriptor({ searchable: true, onSearch }) as any}
      />
    );

    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'foo' },
    });

    expect(onSearch).toHaveBeenCalledWith('foo');
  });

  it('should render apply/clear/cancel buttons for multiselect', () => {
    render(<FilterChip descriptor={baseDescriptor() as any} />);

    expect(screen.getByTestId('apply-filter-btn')).toBeInTheDocument();
    expect(screen.getByTestId('clear-filter-btn')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-filter-btn')).toBeInTheDocument();
  });

  it('should disable clear button when nothing staged', () => {
    render(<FilterChip descriptor={baseDescriptor() as any} />);

    expect(screen.getByTestId('clear-filter-btn')).toBeDisabled();
  });

  it('should commit staged value to onChange on Apply for multiselect', () => {
    const onChange = jest.fn();
    render(<FilterChip descriptor={baseDescriptor({ onChange }) as any} />);

    fireEvent.click(screen.getByTestId('select-a'));
    fireEvent.click(screen.getByTestId('apply-filter-btn'));

    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('should call onChange immediately on selection for single select', () => {
    const onChange = jest.fn();
    render(
      <FilterChip
        descriptor={baseDescriptor({ controlType: 'select', onChange }) as any}
      />
    );

    fireEvent.click(screen.getByTestId('select-a'));

    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('should not render apply/clear/cancel buttons for single select', () => {
    render(
      <FilterChip
        descriptor={baseDescriptor({ controlType: 'select' }) as any}
      />
    );

    expect(screen.queryByTestId('apply-filter-btn')).not.toBeInTheDocument();
  });

  it('should reset the search query when the dropdown closes', () => {
    render(
      <FilterChip descriptor={baseDescriptor({ searchable: true }) as any} />
    );

    fireEvent.click(screen.getByTestId('dropdown-toggle'));
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'abc' } });

    expect((input as HTMLInputElement).value).toBe('abc');

    fireEvent.click(screen.getByTestId('dropdown-toggle'));

    expect((screen.getByTestId('search-input') as HTMLInputElement).value).toBe(
      ''
    );
  });

  it('should reset staged selections when Clear is pressed', () => {
    const onChange = jest.fn();
    render(<FilterChip descriptor={baseDescriptor({ onChange }) as any} />);

    fireEvent.click(screen.getByTestId('select-a'));
    fireEvent.click(screen.getByTestId('clear-filter-btn'));
    fireEvent.click(screen.getByTestId('apply-filter-btn'));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('should not commit changes when Cancel is pressed', () => {
    const onChange = jest.fn();
    render(<FilterChip descriptor={baseDescriptor({ onChange }) as any} />);

    fireEvent.click(screen.getByTestId('select-a'));
    fireEvent.click(screen.getByTestId('cancel-filter-btn'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('should ignore an all-selection change', () => {
    const onChange = jest.fn();
    render(<FilterChip descriptor={baseDescriptor({ onChange }) as any} />);

    fireEvent.click(screen.getByTestId('select-all'));
    fireEvent.click(screen.getByTestId('apply-filter-btn'));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('should mark the selected option with a check icon for single select', () => {
    render(
      <FilterChip
        descriptor={
          baseDescriptor({ controlType: 'select', value: 'success' }) as any
        }
      />
    );

    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  it('should fall back to the label for single select with no value', () => {
    render(
      <FilterChip
        descriptor={
          baseDescriptor({ controlType: 'select', value: undefined }) as any
        }
      />
    );

    expect(screen.getByTestId('search-dropdown-status')).toHaveTextContent(
      'Status'
    );
  });

  it('should render the date filter when the descriptor has no value', () => {
    const descriptor = baseDescriptor({
      controlType: 'date',
      value: undefined,
    });
    render(<FilterChip descriptor={descriptor as any} />);

    const dateFilter = screen.getByTestId('date-range-filter');

    expect(dateFilter).toBeInTheDocument();
    expect(dateFilter).not.toHaveAttribute('data-start');
  });

  it('should render the label above the input trigger for the input variant', () => {
    render(
      <FilterChip
        descriptor={
          baseDescriptor({ controlType: 'select', value: 'success' }) as any
        }
        variant="input"
      />
    );

    // Label sits above; the trigger shows the selected option's label.
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByTestId('search-dropdown-status')).toHaveTextContent(
      'Success'
    );
  });

  it('should show the label as placeholder for the input variant when nothing is selected', () => {
    render(
      <FilterChip
        descriptor={
          baseDescriptor({ controlType: 'select', value: undefined }) as any
        }
        variant="input"
      />
    );

    expect(screen.getByTestId('search-dropdown-status')).toHaveTextContent(
      'Status'
    );
  });

  it('should show the selected option label for the input variant when selected', () => {
    render(
      <FilterChip
        descriptor={
          baseDescriptor({ controlType: 'select', value: 'success' }) as any
        }
        variant="input"
      />
    );

    expect(screen.getByTestId('search-dropdown-status')).toHaveTextContent(
      'Success'
    );
  });

  it('should render the user picker for the user control type', () => {
    render(
      <FilterChip
        descriptor={
          baseDescriptor({
            controlType: 'user',
            label: 'Assignee',
            key: 'assignee',
            value: '',
            onOwnerChange: jest.fn(),
          }) as any
        }
      />
    );

    expect(screen.getByTestId('user-team-selectable-list')).toBeInTheDocument();
    expect(screen.getByTestId('search-dropdown-assignee')).toBeInTheDocument();
  });

  it('should call onOwnerChange when an owner is selected in the user picker', () => {
    const onOwnerChange = jest.fn();
    render(
      <FilterChip
        descriptor={
          baseDescriptor({
            controlType: 'user',
            label: 'Assignee',
            key: 'assignee',
            value: '',
            onOwnerChange,
          }) as any
        }
      />
    );

    fireEvent.click(screen.getByTestId('trigger-owner-update'));

    expect(onOwnerChange).toHaveBeenCalledWith([
      { id: 'owner-1', name: 'owner-1' },
    ]);
  });

  it('should show the selected owner display name for the user control type', () => {
    render(
      <FilterChip
        descriptor={
          baseDescriptor({
            controlType: 'user',
            label: 'Assignee',
            key: 'assignee',
            value: '',
            selectedOwners: [{ id: 'owner-1', displayName: 'Owner One' }],
            onOwnerChange: jest.fn(),
          }) as any
        }
        variant="input"
      />
    );

    expect(screen.getByTestId('search-dropdown-assignee')).toHaveTextContent(
      'Owner One'
    );
  });
});
