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
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { HTMLAttributes, ReactNode, TdHTMLAttributes } from 'react';
import type { TableComponentProps } from './Table.interface';
import TableV2 from './TableV2';

const mockSetPreference = jest.fn();

jest.mock('@openmetadata/ui-core-components', () => {
  const React = jest.requireActual('react');
  const TableContext = React.createContext({
    onSelectionChange: (_selection: 'all' | Set<string>) => undefined,
  });

  const Table = ({
    children,
    onSelectionChange,
    'aria-label': ariaLabel,
  }: {
    children: ReactNode;
    onSelectionChange: (selection: 'all' | Set<string>) => void;
    'aria-label'?: string;
  }) => {
    const tableContextValue = React.useMemo(
      () => ({ onSelectionChange }),
      [onSelectionChange]
    );

    return (
      <TableContext.Provider value={tableContextValue}>
        <button
          data-testid="select-all-visible-rows"
          onClick={() => onSelectionChange('all')}>
          select all
        </button>
        <table aria-label={ariaLabel}>{children}</table>
      </TableContext.Provider>
    );
  };
  Table.Header = ({ children }: { children: ReactNode }) => (
    <thead>
      <tr>{children}</tr>
    </thead>
  );
  Table.Head = ({ children }: { children: ReactNode }) => <th>{children}</th>;
  Table.Body = ({ children }: { children: ReactNode }) => (
    <tbody>{children}</tbody>
  );
  const TableRow = ({
    children,
    id,
    hideSelectionCell,
    ...props
  }: HTMLAttributes<HTMLTableRowElement> & {
    id: string;
    hideSelectionCell?: boolean;
  }) => {
    const { onSelectionChange } = React.useContext(TableContext);

    return (
      <tr {...props}>
        {!hideSelectionCell && (
          <td>
            <button
              data-testid={`select-row-${id}`}
              onClick={() => onSelectionChange(new Set([id]))}>
              select {id}
            </button>
          </td>
        )}
        {children as ReactNode}
      </tr>
    );
  };
  Table.Row = TableRow;
  Table.Cell = ({
    children,
    ...props
  }: TdHTMLAttributes<HTMLTableCellElement>) => (
    <td {...props}>{children as ReactNode}</td>
  );

  const Button = ({
    children,
    onClick,
    onPress,
    ...props
  }: Record<string, unknown>) => (
    <button {...props} onClick={(onPress ?? onClick) as () => void}>
      {children as ReactNode}
    </button>
  );

  return {
    MUTED_TABLE_SURFACE_CLASSES: jest.requireActual(
      '@openmetadata/ui-core-components'
    ).MUTED_TABLE_SURFACE_CLASSES,
    Button,
    ButtonUtility: ({
      icon: _icon,
      size: _size,
      ...props
    }: HTMLAttributes<HTMLButtonElement> & {
      icon?: unknown;
      size?: string;
    }) => <button {...props} />,
    Dropdown: {
      Root: ({ children }: { children: ReactNode }) => <>{children}</>,
      Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
      Menu: ({ children }: { children: ReactNode }) => <>{children}</>,
      Section: ({ children }: { children: ReactNode }) => <>{children}</>,
      SectionHeader: ({ children }: { children: ReactNode }) => <>{children}</>,
      Separator: () => null,
    },
    Table,
    Typography: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

jest.mock('../../../hooks/currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: () => ({
    preferences: { selectedEntityTableColumns: {} },
    setPreference: mockSetPreference,
  }),
}));

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: () => ({ type: 'metric' }),
}));

jest.mock('../Loader/Loader', () => () => <div>loading</div>);
jest.mock('../NextPrevious/NextPrevious', () => () => null);
jest.mock('../SearchBarComponent/SearchBar.component', () => () => null);
jest.mock('./DraggableMenu/DraggableMenuItemV2.component', () => () => null);
jest.mock('./ColumnCustomizeDropdown/ColumnCustomizeDropdown', () => () => (
  <div data-testid="column-dropdown" />
));

interface TreeRow {
  id: string;
  name: string;
  value: string;
  children?: TreeRow[];
}

const parent: TreeRow = {
  id: 'parent',
  name: 'Parent metric',
  value: 'covered-value',
  children: [{ id: 'child', name: 'Child metric', value: 'child-value' }],
};
const sibling: TreeRow = {
  id: 'sibling',
  name: 'Sibling metric',
  value: 'sibling-value',
};

const columns: NonNullable<TableComponentProps<TreeRow>['columns']> = [
  {
    dataIndex: 'name',
    key: 'name',
    title: 'Name',
    onCell: (record) => (record.id === 'parent' ? { colSpan: 2 } : {}),
  },
  {
    dataIndex: 'value',
    key: 'value',
    title: 'Value',
    onCell: (record) => (record.id === 'parent' ? { colSpan: 0 } : {}),
  },
];

describe('TableV2 tree regressions', () => {
  it('selects expanded children and every visible tree row', () => {
    const onChange = jest.fn();
    render(
      <TableV2
        columns={columns}
        dataSource={[parent, sibling]}
        expandable={{}}
        pagination={false}
        rowKey="id"
        rowSelection={{ onChange }}
      />
    );

    fireEvent.click(screen.getAllByTestId('expand-icon')[0]);

    expect(screen.getByText('Child metric')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('select-row-child'));

    expect(onChange).toHaveBeenLastCalledWith(
      ['child'],
      [expect.objectContaining({ id: 'child' })],
      { type: 'multiple' }
    );

    fireEvent.click(screen.getByTestId('select-all-visible-rows'));

    expect(onChange).toHaveBeenLastCalledWith(
      ['parent', 'child', 'sibling'],
      [
        expect.objectContaining({ id: 'parent' }),
        expect.objectContaining({ id: 'child' }),
        expect.objectContaining({ id: 'sibling' }),
      ],
      { type: 'multiple' }
    );
  });

  it('skips a colSpan-zero covered cell without shifting following rows', () => {
    render(
      <TableV2
        columns={columns}
        dataSource={[parent, sibling]}
        expandable={{ defaultExpandAllRows: true }}
        pagination={false}
        rowKey="id"
      />
    );

    const parentRow = screen.getByText('Parent metric').closest('tr');

    expect(parentRow).not.toBeNull();
    expect(screen.queryByText('covered-value')).not.toBeInTheDocument();
    expect(within(parentRow as HTMLElement).getAllByRole('cell')).toHaveLength(
      2
    );
    expect(screen.getByText('sibling-value')).toBeInTheDocument();
  });

  it('lets containerClassName override the default container border', () => {
    const { container } = render(
      <TableV2
        columns={columns}
        containerClassName="tw:border-subtle"
        dataSource={[sibling]}
        pagination={false}
        rowKey="id"
      />
    );

    const wrapper = container.querySelector('.table-container');

    expect(wrapper).toHaveClass('tw:border-subtle');
    expect(wrapper).not.toHaveClass('tw:border-utility-gray-200');
  });

  it('keeps the row hover fill off the empty-state row', () => {
    const { container } = render(
      <TableV2
        columns={columns}
        dataSource={[]}
        pagination={false}
        rowKey="id"
      />
    );

    const wrapper = container.querySelector('.table-container');

    expect(wrapper).toHaveClass(
      'tw:[&_tbody:not([data-empty])_tr:hover_td]:bg-secondary'
    );
    expect(wrapper).not.toHaveClass('tw:[&_tbody_tr:hover_td]:bg-secondary');
  });

  it('swaps the default border and hover for the muted surface', () => {
    const { container } = render(
      <TableV2
        columns={columns}
        dataSource={[sibling]}
        pagination={false}
        rowKey="id"
        variant="muted"
      />
    );

    const wrapper = container.querySelector('.table-container');

    expect(wrapper).toHaveClass(
      'tw:bg-primary_alt!',
      'tw:dark:border-primary',
      'tw:[&_tbody:not(table_table_tbody):not([data-empty])>tr:hover>td]:bg-primary_hover'
    );
    expect(wrapper).not.toHaveClass('tw:border-utility-gray-200');
    expect(wrapper).not.toHaveClass(
      'tw:[&_tbody:not([data-empty])_tr:hover_td]:bg-secondary'
    );
  });
});

/**
 * Regression for the select-all + getCheckboxProps interaction (introduced in
 * commit 2e08857). When the user clicks select-all, React Aria delivers the
 * literal `'all'` sentinel; TableV2 must materialise it against the same
 * `disabledRowKeys` set it wired into `disabledKeys`, mirroring both AntD's
 * `useSelection` (which filters disabled rows out of `recordKeys`) and
 * react-stately's own `SelectionManager.selectedKeys` (which gates every key
 * through `canSelectItem`). Otherwise `getCheckboxProps`-disabled rows are
 * reported to `rowSelection.onChange` as selected — and once a controlled
 * `selectedRowKeys` echoes them back, react-aria renders them as checked and
 * stuck (with `disabledBehavior="selection"` they cannot be unchecked).
 *
 * The shared parity suite covers the real-header path; this block covers the
 * edge cases it does not — an expanded tree, a Set containing a disabled id,
 * and the `preserveSelectedRowKeys` re-merge — through the same
 * `onSelectionChange` mock plumbing the rest of this file relies on.
 */
describe('TableV2 select-all excludes getCheckboxProps-disabled rows', () => {
  it('excludes disabled rows even with a tree expanded', () => {
    const onChange = jest.fn();
    render(
      <TableV2
        columns={columns}
        dataSource={[parent, sibling]}
        expandable={{}}
        pagination={false}
        rowKey="id"
        rowSelection={{
          getCheckboxProps: (record: TreeRow) => ({
            disabled: record.id === 'child',
          }),
          onChange,
        }}
      />
    );

    fireEvent.click(screen.getAllByTestId('expand-icon')[0]);
    fireEvent.click(screen.getByTestId('select-all-visible-rows'));

    expect(onChange).toHaveBeenLastCalledWith(
      ['parent', 'sibling'],
      [
        expect.objectContaining({ id: 'parent' }),
        expect.objectContaining({ id: 'sibling' }),
      ],
      { type: 'multiple' }
    );
  });

  it('filters a Set selection that contains a disabled id', () => {
    // react-stately never surfaces a disabled id in the Set branch under real
    // interaction, but the wrapper resolves the Set through the same path, so
    // an echo through `preserveSelectedRowKeys` (or any future caller driving
    // onSelectionChange directly) must still drop disabled rows here.
    const onChange = jest.fn();
    render(
      <TableV2
        columns={columns}
        dataSource={[parent, sibling]}
        pagination={false}
        rowKey="id"
        rowSelection={{
          getCheckboxProps: (record: TreeRow) => ({
            disabled: record.id === 'parent',
          }),
          onChange,
        }}
      />
    );

    fireEvent.click(screen.getByTestId('select-row-parent'));

    expect(onChange).toHaveBeenLastCalledWith([], [], { type: 'multiple' });
  });

  it('preserveSelectedRowKeys does not re-add the disabled rows on the current page', () => {
    // The disabled row's key is on the current page, so the re-merge's
    // `!currentPageKeys.has(...)` filter drops it from `preservedKeys`; with
    // the resolve-side filter also dropping it from current-page selection,
    // the disabled row cannot survive a select-all under either path.
    const onChange = jest.fn();
    render(
      <TableV2
        columns={columns}
        dataSource={[parent, sibling]}
        pagination={false}
        rowKey="id"
        rowSelection={{
          getCheckboxProps: (record: TreeRow) => ({
            disabled: record.id === 'parent',
          }),
          onChange,
          preserveSelectedRowKeys: true,
          selectedRowKeys: ['parent'],
        }}
      />
    );

    fireEvent.click(screen.getByTestId('select-all-visible-rows'));

    expect(onChange).toHaveBeenLastCalledWith(
      ['sibling'],
      [expect.objectContaining({ id: 'sibling' })],
      { type: 'multiple' }
    );
  });
});

describe('TableV2 extension props', () => {
  it('hands the customize control to a custom toolbar instead of the default row', () => {
    render(
      <TableV2
        columns={columns}
        dataSource={[sibling]}
        defaultVisibleColumns={['value']}
        pagination={false}
        renderToolbar={(columnCustomize) => (
          <div data-testid="custom-toolbar">{columnCustomize}</div>
        )}
        rowKey="id"
        staticVisibleColumns={['name']}
      />
    );

    expect(
      within(screen.getByTestId('custom-toolbar')).getByTestId(
        'column-dropdown'
      )
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('column-dropdown')).toHaveLength(1);
  });

  it('passes no customize control when column customization is off', () => {
    const renderToolbar = jest.fn(() => <div data-testid="custom-toolbar" />);
    render(
      <TableV2
        columns={columns}
        dataSource={[sibling]}
        pagination={false}
        renderToolbar={renderToolbar}
        rowKey="id"
      />
    );

    expect(renderToolbar).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId('custom-toolbar')).toBeInTheDocument();
  });

  it('renders full-width rows across every column without a selection cell', () => {
    render(
      <TableV2
        aria-label="Metrics"
        columns={columns}
        dataSource={[sibling, { id: 'section', name: '', value: '' }]}
        fullWidthRowRender={(record) =>
          record.id === 'section' ? 'Section header' : null
        }
        pagination={false}
        rowKey="id"
        rowSelection={{}}
      />
    );

    const sectionCell = screen.getByText('Section header').closest('td');

    expect(screen.getByRole('table', { name: 'Metrics' })).toBeInTheDocument();
    expect(sectionCell).toHaveAttribute('colspan', '3');
    expect(sectionCell?.closest('tr')).toHaveAttribute(
      'data-row-key',
      'section'
    );
    expect(screen.queryByTestId('select-row-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('select-row-sibling')).toBeInTheDocument();
  });
});
