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
  }: {
    children: ReactNode;
    onSelectionChange: (selection: 'all' | Set<string>) => void;
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
        <table>{children}</table>
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
    ...props
  }: HTMLAttributes<HTMLTableRowElement> & { id: string }) => {
    const { onSelectionChange } = React.useContext(TableContext);

    return (
      <tr {...props}>
        <td>
          <button
            data-testid={`select-row-${id}`}
            onClick={() => onSelectionChange(new Set([id]))}>
            select {id}
          </button>
        </td>
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
    Button,
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
});
