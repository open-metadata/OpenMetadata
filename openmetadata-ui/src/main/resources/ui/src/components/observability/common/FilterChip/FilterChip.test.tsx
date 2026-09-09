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

// Selection UX (staged commits, search box, checkbox rows, all-sentinel) lives
// in the FilterSelect core component and is covered by its own suite; these
// tests assert the descriptor → FilterSelect mapping and the date/user chips.
jest.mock('@openmetadata/ui-core-components', () => ({
  borderAfter: 'border-after',
  FilterSelect: ({
    'data-testid': testId,
    label,
    options,
    selectedValues,
    selectionMode,
    commitMode,
    searchable,
    triggerVariant,
    resolveMissingLabel,
    onChange,
    onOpenChange,
    onSearch,
  }: any) => {
    const single = selectionMode === 'single';
    const selectedLabel =
      single && selectedValues[0]
        ? options.find((option: any) => option.value === selectedValues[0])
            ?.label ??
          resolveMissingLabel?.(selectedValues[0]) ??
          selectedValues[0]
        : undefined;

    return (
      <div
        data-commit={commitMode}
        data-searchable={String(Boolean(searchable))}
        data-selection={selectionMode}
        data-testid={testId}
        data-variant={triggerVariant}>
        <span data-testid="trigger-text">
          {single
            ? selectedLabel ?? label
            : selectedValues.length > 0
            ? `${label} · ${selectedValues.length}`
            : label}
        </span>
        {options.map((option: any) => (
          <div data-testid="filter-option" key={option.value}>
            {option.label}
            {option.icon ? <option.icon /> : null}
          </div>
        ))}
        <button data-testid="open-filter" onClick={() => onOpenChange?.(true)}>
          open
        </button>
        <button data-testid="commit-success" onClick={() => onChange(['success'])}>
          commit success
        </button>
        <button
          data-testid="commit-multi"
          onClick={() => onChange(['success', 'failed'])}>
          commit multi
        </button>
        <button data-testid="commit-empty" onClick={() => onChange([])}>
          commit empty
        </button>
        <button data-testid="filter-search" onClick={() => onSearch?.('abc')}>
          search
        </button>
      </div>
    );
  },
}));

jest.mock('@untitledui/icons', () => ({
  ChevronDown: () => <span data-testid="chevron-icon" />,
  Columns01: () => <span data-testid="columns-icon" />,
  LayoutAlt04: () => <span data-testid="layout-icon" />,
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
      value: { startTs: 10, endTs: 20 },
    });
    render(<FilterChip descriptor={descriptor as any} />);

    const dateFilter = screen.getByTestId('date-range-filter');

    expect(dateFilter).toBeInTheDocument();
    expect(dateFilter).toHaveAttribute('data-start', '10');
    expect(dateFilter).toHaveAttribute('data-end', '20');
  });

  it('should forward onApply to descriptor.onChange for date control', () => {
    const descriptor = baseDescriptor({ controlType: 'date', value: {} });
    render(<FilterChip descriptor={descriptor as any} />);

    fireEvent.click(screen.getByTestId('date-range-filter'));

    expect(descriptor.onChange).toHaveBeenCalledWith({ startTs: 1, endTs: 2 });
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

  it('should render the select chip trigger with label when nothing selected', () => {
    render(<FilterChip descriptor={baseDescriptor() as any} />);

    expect(screen.getByTestId('trigger-text')).toHaveTextContent('Status');
  });

  it('should show count in trigger for multiselect with committed values', () => {
    render(
      <FilterChip
        descriptor={baseDescriptor({ value: ['success', 'failed'] }) as any}
      />
    );

    expect(screen.getByTestId('trigger-text')).toHaveTextContent('Status · 2');
  });

  it('should show selected option label for single select', () => {
    render(
      <FilterChip
        descriptor={
          baseDescriptor({ controlType: 'select', value: 'success' }) as any
        }
      />
    );

    expect(screen.getByTestId('trigger-text')).toHaveTextContent('Success');
  });

  it('should resolve a persisted value missing from the fetched options to its FQN leaf', () => {
    render(
      <FilterChip
        descriptor={
          baseDescriptor({
            controlType: 'select',
            value: 'db.schema.table1',
            options: [],
          }) as any
        }
      />
    );

    expect(screen.getByTestId('trigger-text')).toHaveTextContent('table1');
  });

  it('should stage commits for multiselect and apply immediately for single select', () => {
    const { rerender } = render(
      <FilterChip descriptor={baseDescriptor() as any} />
    );

    expect(screen.getByTestId('search-dropdown-status')).toHaveAttribute(
      'data-commit',
      'staged'
    );

    rerender(
      <FilterChip
        descriptor={baseDescriptor({ controlType: 'select' }) as any}
      />
    );

    expect(screen.getByTestId('search-dropdown-status')).toHaveAttribute(
      'data-commit',
      'immediate'
    );
  });

  it('should call onGetInitialOptions when dropdown opens', () => {
    const descriptor = baseDescriptor();
    render(<FilterChip descriptor={descriptor as any} />);

    fireEvent.click(screen.getByTestId('open-filter'));

    expect(descriptor.onGetInitialOptions).toHaveBeenCalled();
  });

  it('should pass the searchable flag through', () => {
    const { rerender } = render(
      <FilterChip descriptor={baseDescriptor({ searchable: true }) as any} />
    );

    expect(screen.getByTestId('search-dropdown-status')).toHaveAttribute(
      'data-searchable',
      'true'
    );

    rerender(
      <FilterChip descriptor={baseDescriptor({ searchable: false }) as any} />
    );

    expect(screen.getByTestId('search-dropdown-status')).toHaveAttribute(
      'data-searchable',
      'false'
    );
  });

  it('should forward the typed query to onSearch', () => {
    const descriptor = baseDescriptor({ searchable: true });
    render(<FilterChip descriptor={descriptor as any} />);

    fireEvent.click(screen.getByTestId('filter-search'));

    expect(descriptor.onSearch).toHaveBeenCalledWith('abc');
  });

  it('should commit multiselect values as an array', () => {
    const descriptor = baseDescriptor();
    render(<FilterChip descriptor={descriptor as any} />);

    fireEvent.click(screen.getByTestId('commit-multi'));

    expect(descriptor.onChange).toHaveBeenCalledWith(['success', 'failed']);
  });

  it('should commit a single select value as a string', () => {
    const descriptor = baseDescriptor({ controlType: 'select' });
    render(<FilterChip descriptor={descriptor as any} />);

    fireEvent.click(screen.getByTestId('commit-success'));

    expect(descriptor.onChange).toHaveBeenCalledWith('success');
  });

  it('should commit an empty single select as an empty string', () => {
    const descriptor = baseDescriptor({ controlType: 'select' });
    render(<FilterChip descriptor={descriptor as any} />);

    fireEvent.click(screen.getByTestId('commit-empty'));

    expect(descriptor.onChange).toHaveBeenCalledWith('');
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

    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByTestId('search-dropdown-status')).toHaveAttribute(
      'data-variant',
      'input'
    );
    expect(screen.getByTestId('trigger-text')).toHaveTextContent('Success');
  });

  it('should use the button trigger for the chip variant', () => {
    render(<FilterChip descriptor={baseDescriptor() as any} />);

    expect(screen.getByTestId('search-dropdown-status')).toHaveAttribute(
      'data-variant',
      'button'
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
