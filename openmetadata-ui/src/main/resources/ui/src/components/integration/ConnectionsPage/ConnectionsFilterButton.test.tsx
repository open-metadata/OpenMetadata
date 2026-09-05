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

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import ConnectionsFilterButton, {
  ConnectionsFilterButtonOption,
  ConnectionsFilterButtonProps,
} from './ConnectionsFilterButton';

// Captures the selection handler the component hands to the menu, so the react-aria selection
// contract can be exercised directly — including the 'all' sentinel, which no click can produce.
let menuProps: {
  selectionMode?: string;
  disallowEmptySelection?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (keys: 'all' | Iterable<React.Key>) => void;
} = {};

// Captured so a test can close the popover the way react-aria would.
let closePopover: (() => void) | undefined;

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: ({ children, ...rest }: Record<string, unknown>) => (
    <button {...rest}>{children as React.ReactNode}</button>
  ),
  // Renders the title so the wiring is visible here too.
  Tooltip: ({
    children,
    title,
    isDisabled,
  }: {
    children: React.ReactNode;
    title?: React.ReactNode;
    isDisabled?: boolean;
  }) => (
    <div data-tooltip={isDisabled ? undefined : String(title ?? '')}>
      {children}
    </div>
  ),
  Input: ({
    onChange,
    icon: _icon,
    size: _size,
    ...rest
  }: {
    onChange?: (value: string) => void;
    icon?: unknown;
    size?: string;
    [key: string]: unknown;
  }) => (
    <input {...rest} onChange={(event) => onChange?.(event.target.value)} />
  ),
  Dropdown: {
    Item: ({ children }: { children: unknown }) => (
      <div>
        {typeof children === 'function'
          ? (children as (state: unknown) => React.ReactNode)({
              isSelected: false,
              isDisabled: false,
            })
          : (children as React.ReactNode)}
      </div>
    ),
    Menu: (props: Record<string, unknown>) => {
      menuProps = props as typeof menuProps;

      return <div data-testid="menu">{props.children as React.ReactNode}</div>;
    },
    Popover: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => (
      <div className={className} data-testid="popover">
        {children}
      </div>
    ),
    Root: ({
      children,
      onOpenChange,
    }: {
      children: React.ReactNode;
      onOpenChange?: (isOpen: boolean) => void;
    }) => {
      closePopover = () => onOpenChange?.(false);

      return <>{children}</>;
    },
  },
}));

jest.mock('@untitledui/icons', () => ({
  Check: () => <span />,
  ChevronDown: () => <span />,
  SearchLg: () => <span />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

const OPTIONS: ConnectionsFilterButtonOption[] = [
  { label: 'Mysql', value: 'Mysql' },
  { label: 'Postgres', value: 'Postgres' },
];

describe('ConnectionsFilterButton', () => {
  beforeEach(() => {
    menuProps = {};
  });

  // Exercises the renamed exports as real, structural usage rather than just importing them: if
  // ConnectionsFilterButtonProps/ConnectionsFilterButtonOption were ever renamed or reshaped without
  // updating the component, this assignment (and the render below) would fail to compile.
  it('accepts a value typed against the exported prop and option types', () => {
    const typedProps: ConnectionsFilterButtonProps = {
      label: 'All',
      multiple: true,
      onChange: jest.fn(),
      options: OPTIONS,
      value: ['Mysql'],
    };

    render(<ConnectionsFilterButton {...typedProps} />);

    expect(screen.getByRole('button')).toHaveTextContent('Mysql');
  });

  describe('single select', () => {
    it('keeps the existing single-select contract', () => {
      const onChange = jest.fn();
      render(
        <ConnectionsFilterButton
          label="All"
          options={OPTIONS}
          value="Mysql"
          onChange={onChange}
        />
      );

      expect(menuProps.selectionMode).toBe('single');
      expect(menuProps.disallowEmptySelection).toBe(true);
      expect(menuProps.selectedKeys).toEqual(['Mysql']);

      menuProps.onSelectionChange?.(new Set(['Postgres']));

      expect(onChange).toHaveBeenCalledWith('Postgres');
    });

    it('shows the selected option on the trigger', () => {
      render(
        <ConnectionsFilterButton
          label="All"
          options={OPTIONS}
          value="Mysql"
          onChange={jest.fn()}
        />
      );

      expect(screen.getByRole('button')).toHaveTextContent('Mysql');
    });
  });

  describe('multi select', () => {
    const renderMulti = (value: string[], onChange = jest.fn()) => {
      render(
        <ConnectionsFilterButton
          multiple
          label="All service types"
          options={OPTIONS}
          value={value}
          onChange={onChange}
        />
      );

      return onChange;
    };

    it('allows an empty selection, which means no filter', () => {
      const onChange = renderMulti(['Mysql']);

      expect(menuProps.selectionMode).toBe('multiple');
      expect(menuProps.disallowEmptySelection).toBe(false);

      menuProps.onSelectionChange?.(new Set([]));

      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('passes every selected value through', () => {
      const onChange = renderMulti([]);

      menuProps.onSelectionChange?.(new Set(['Mysql', 'Postgres']));

      expect(onChange).toHaveBeenCalledWith(['Mysql', 'Postgres']);
    });

    it('expands the select-all sentinel to the real options', () => {
      const onChange = renderMulti([]);

      // react-aria emits the literal string 'all' for select-all. It satisfies
      // Iterable<React.Key>, so Array.from would split it into ['a','l','l'] and write three
      // values that match no service.
      menuProps.onSelectionChange?.('all');

      expect(onChange).toHaveBeenCalledWith(['Mysql', 'Postgres']);
    });

    it('labels the trigger by count once more than one is selected', () => {
      renderMulti(['Mysql', 'Postgres']);

      expect(screen.getByRole('button')).toHaveTextContent(
        'label.n-selected:2'
      );
    });

    it('falls back to the base label when nothing is selected', () => {
      renderMulti([]);

      expect(screen.getByRole('button')).toHaveTextContent('All service types');
    });

    it('names the selected values in a tooltip, since the count alone does not', () => {
      renderMulti(['Mysql', 'Postgres']);

      expect(
        screen.getByRole('button').closest('[data-tooltip]')
      ).toHaveAttribute('data-tooltip', 'Mysql, Postgres');
    });

    it('has no tooltip when the trigger already names the selection', () => {
      renderMulti(['Mysql']);

      // The mock omits the attribute entirely when the tooltip is disabled, so there is no
      // ancestor carrying it.
      expect(screen.getByRole('button').closest('[data-tooltip]')).toBeNull();
    });

    it('lists selected options first so a selection is visible without scrolling', () => {
      render(
        <ConnectionsFilterButton
          multiple
          label="All"
          options={[
            { label: 'Athena', value: 'Athena' },
            { label: 'Mysql', value: 'Mysql' },
            { label: 'Postgres', value: 'Postgres' },
          ]}
          value={['Postgres']}
          onChange={jest.fn()}
        />
      );

      const rendered = within(screen.getByTestId('menu')).getAllByText(
        /Athena|Mysql|Postgres/
      );

      expect(rendered.map((node) => node.textContent)).toEqual([
        'Postgres',
        'Athena',
        'Mysql',
      ]);
    });
  });

  describe('searchable', () => {
    it('has no search box unless asked for', () => {
      render(
        <ConnectionsFilterButton
          multiple
          label="All"
          options={OPTIONS}
          testId="filter"
          value={[]}
          onChange={jest.fn()}
        />
      );

      expect(screen.queryByTestId('filter-search')).not.toBeInTheDocument();
    });

    it('filters the options by the typed term', () => {
      render(
        <ConnectionsFilterButton
          multiple
          searchable
          label="All"
          options={OPTIONS}
          testId="filter"
          value={[]}
          onChange={jest.fn()}
        />
      );

      fireEvent.change(screen.getByTestId('filter-search'), {
        target: { value: 'post' },
      });

      const menu = within(screen.getByTestId('menu'));

      expect(menu.getByText('Postgres')).toBeInTheDocument();
      expect(menu.queryByText('Mysql')).not.toBeInTheDocument();
    });

    it('keeps a selected option visible while searching for another', () => {
      render(
        <ConnectionsFilterButton
          multiple
          searchable
          label="All"
          options={OPTIONS}
          testId="filter"
          value={['Mysql']}
          onChange={jest.fn()}
        />
      );

      fireEvent.change(screen.getByTestId('filter-search'), {
        target: { value: 'zzz' },
      });

      // The term matches nothing, so nothing is listed — the selection is not exempt from the
      // search, it is only ordered ahead of the rest when it does match.
      expect(
        within(screen.getByTestId('menu')).queryByText('Mysql')
      ).not.toBeInTheDocument();
    });

    // An empty popover is indistinguishable from one that failed to load, so a search matching
    // nothing has to say so.
    it('says so when the term matches nothing', () => {
      render(
        <ConnectionsFilterButton
          multiple
          searchable
          label="All"
          options={OPTIONS}
          testId="filter"
          value={[]}
          onChange={jest.fn()}
        />
      );

      fireEvent.change(screen.getByTestId('filter-search'), {
        target: { value: 'zzz' },
      });

      expect(
        within(screen.getByTestId('menu')).getByText('label.no-options')
      ).toBeInTheDocument();
    });

    // Reopening onto a stale term reads as "this filter has no options".
    it('clears the term when the popover closes', () => {
      render(
        <ConnectionsFilterButton
          multiple
          searchable
          label="All"
          options={OPTIONS}
          testId="filter"
          value={[]}
          onChange={jest.fn()}
        />
      );

      fireEvent.change(screen.getByTestId('filter-search'), {
        target: { value: 'post' },
      });

      expect(
        within(screen.getByTestId('menu')).queryByText('Mysql')
      ).not.toBeInTheDocument();

      act(() => closePopover?.());

      expect(screen.getByTestId('filter-search')).toHaveValue('');
      expect(
        within(screen.getByTestId('menu')).getByText('Mysql')
      ).toBeInTheDocument();
    });

    it('widens the popover to fit the search box, and only then', () => {
      const { rerender } = render(
        <ConnectionsFilterButton
          multiple
          label="All"
          options={OPTIONS}
          testId="filter"
          value={[]}
          onChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('popover')).toHaveClass('tw:min-w-36');

      rerender(
        <ConnectionsFilterButton
          multiple
          searchable
          label="All"
          options={OPTIONS}
          testId="filter"
          value={[]}
          onChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('popover')).toHaveClass('tw:w-64');
    });
  });
});
