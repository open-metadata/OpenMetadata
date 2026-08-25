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

/**
 * Behavioural parity suite shared by `Table` (legacy, antd) and `TableV2`
 * (ui-core-components).
 *
 * The contract: every assertion here is implementation-independent — it checks
 * *what the user sees or gets called back with*, never a framework class name.
 * Where a control's DOM genuinely differs by design (the pager, the expander),
 * the difference is confined to the `ParityAdapter` the runner supplies; the
 * assertion around it stays shared.
 *
 * A spec that cannot be made green against legacy `Table` is a wrong spec, not
 * a legacy bug — drop it rather than "fix" it.
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ComponentType, ReactNode } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { usePersistentStorage } from '../../../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';

/**
 * Structural, so the suite adds no AntD import of its own — the wrapper under
 * test is what owns that dependency. Only the fields these specs exercise.
 */
type ParityColumn = {
  title?: unknown;
  dataIndex?: string;
  key?: string;
  render?: (value: never, record: never, index: number) => unknown;
  sorter?: boolean | ((a: ParityRow, b: ParityRow) => number);
  sortOrder?: 'ascend' | 'descend';
  sortDirections?: ('ascend' | 'descend')[];
  fixed?: 'left' | 'right';
  width?: number;
  ellipsis?: boolean;
  onCell?: (record: never, index: number) => unknown;
  filters?: unknown;
  filterIcon?: unknown;
  filterDropdown?: unknown;
  onFilter?: unknown;
};

export interface ParityRow {
  name: string;
  count: number;
  children?: ParityRow[];
}

export interface ParityAdapter {
  /** Advance the pager one page. */
  clickNextPage: () => void;
  /** Toggle the expander on the row whose first cell reads `label`. */
  toggleExpander: (label: string) => void;
  /** The header "select all" control, or null when the impl renders none. */
  getSelectAllControl: () => HTMLElement | null;
  /** The built-in pager element, or null when none is rendered. */
  queryPager: () => HTMLElement | null;
  /** The built-in pager's page-size control, or null when none is rendered. */
  queryPageSizeControl: () => HTMLElement | null;
  /** Left indentation, in px, applied to a tree row's first cell. */
  getIndentPx: (label: string) => number;
  /** Open the column filter dropdown for the column titled `columnTitle`. */
  openFilter: (columnTitle: string) => void;
  /**
   * Activate a control the way this implementation expects. antd listens on
   * `click`; react-aria's `usePress` listens on pointer events, so a bare click
   * never fires. Activation mechanics differ by design — the assertions around
   * them do not.
   */
  activate: (element: HTMLElement) => void;
}

export const PARITY_ROWS: ParityRow[] = [
  { count: 3, name: 'charlie' },
  { count: 1, name: 'alpha' },
  { count: 2, name: 'bravo' },
];

export const TREE_ROWS: ParityRow[] = [
  {
    children: [{ count: 10, name: 'child-one' }],
    count: 1,
    name: 'parent-one',
  },
  { count: 2, name: 'parent-two' },
];

const nameColumn: ParityColumn = {
  dataIndex: 'name',
  key: 'name',
  title: 'Name',
};

const countColumn: ParityColumn = {
  dataIndex: 'count',
  key: 'count',
  title: 'Count',
};

export const BASE_COLUMNS: ParityColumn[] = [nameColumn, countColumn];

/**
 * First data cell of a row. antd renders `<td role="cell">`; react-aria renders
 * `<td role="rowheader">` for the row-header column and `role="gridcell"` after
 * it — so the lookup is structural, not role-based.
 */
const firstCell = (row: HTMLElement): HTMLElement | null =>
  row.querySelector('td, th:not([scope])');

/** Row labels in render order, ignoring the header row. */
const renderedNames = (): string[] =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => firstCell(row)?.textContent?.trim() ?? '')
    .filter(Boolean);

export const runTableParitySuite = (
  suiteName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TableComponent: ComponentType<any>,
  adapter: ParityAdapter
) => {
  // Both column-customize menus are react-dnd draggables, so every render needs
  // a drag-drop context — the same wrapper the real pages provide.
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DndProvider backend={HTML5Backend}>{children}</DndProvider>
  );

  const renderTable = (props: Record<string, unknown> = {}) =>
    render(
      <TableComponent
        columns={BASE_COLUMNS}
        dataSource={PARITY_ROWS}
        pagination={false}
        rowKey="name"
        {...props}
      />,
      { wrapper }
    );

  // The column-visibility preference is a persisted zustand store keyed by the
  // signed-in user. Without a current user every write is a no-op, so the
  // customize-columns specs would exercise a path production never takes; and
  // without the reset one spec's selection leaks into the next.
  beforeEach(() => {
    useApplicationStore.setState({
      currentUser: {
        email: 'parity-user@open-metadata.org',
        id: 'parity-user-id',
        name: 'parity-user',
      },
    });
    usePersistentStorage.setState({ preferences: {} });
  });

  describe(`${suiteName} — render`, () => {
    it('renders one row per record', () => {
      renderTable();

      expect(renderedNames()).toEqual(['charlie', 'alpha', 'bravo']);
    });

    it('renders every column title', () => {
      renderTable();

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Count')).toBeInTheDocument();
    });

    it('renders custom render() output in place of the raw value', () => {
      renderTable({
        columns: [
          { ...nameColumn, render: (value: string) => `<${value}>` },
          countColumn,
        ],
      });

      expect(screen.getByText('<alpha>')).toBeInTheDocument();
    });

    it('passes value, record and row index to render()', () => {
      const render_ = jest.fn().mockReturnValue('cell');
      renderTable({
        columns: [{ ...nameColumn, render: render_ }, countColumn],
      });

      expect(render_).toHaveBeenCalledWith('charlie', PARITY_ROWS[0], 0);
      expect(render_).toHaveBeenCalledWith('bravo', PARITY_ROWS[2], 2);
    });

    it('renders a real placeholder, not bare text, when there is no data', () => {
      // AntD fell back to its own <Empty> illustration. A table that renders
      // only the words "no data" reads as a broken row, not an empty state.
      const { container } = renderTable({ dataSource: [] });
      const body = container.querySelector('tbody') as HTMLElement;

      expect(body.querySelector('svg')).toBeInTheDocument();
    });

    it('shows locale.emptyText when there is no data', () => {
      renderTable({ dataSource: [], locale: { emptyText: 'nothing here' } });

      expect(screen.getByText('nothing here')).toBeInTheDocument();
    });

    it('shows a loader while loading', () => {
      renderTable({ loading: true });

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('accepts the object form of loading', () => {
      renderTable({ loading: { spinning: true } });

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });
  });

  describe(`${suiteName} — sorting`, () => {
    const sortedColumns: ParityColumn[] = [
      { ...nameColumn, sorter: (a, b) => a.name.localeCompare(b.name) },
      countColumn,
    ];

    it('sorts ascending on the first header click', () => {
      renderTable({ columns: sortedColumns });
      fireEvent.click(screen.getByText('Name'));

      expect(renderedNames()).toEqual(['alpha', 'bravo', 'charlie']);
    });

    it('sorts descending on the second header click', () => {
      renderTable({ columns: sortedColumns });
      fireEvent.click(screen.getByText('Name'));
      fireEvent.click(screen.getByText('Name'));

      expect(renderedNames()).toEqual(['charlie', 'bravo', 'alpha']);
    });

    it('honours a controlled sortOrder without any interaction', () => {
      renderTable({
        columns: [{ ...sortedColumns[0], sortOrder: 'descend' }, countColumn],
      });

      expect(renderedNames()).toEqual(['charlie', 'bravo', 'alpha']);
    });

    it('leaves order untouched and reports the sorter when sorter is true', () => {
      const onChange = jest.fn();
      renderTable({
        columns: [{ ...nameColumn, sorter: true }, countColumn],
        onChange,
      });
      fireEvent.click(screen.getByText('Name'));

      expect(renderedNames()).toEqual(['charlie', 'alpha', 'bravo']);
      expect(onChange).toHaveBeenCalled();
      expect(onChange.mock.calls[0][2]).toEqual(
        expect.objectContaining({ order: 'ascend' })
      );
    });
  });

  describe(`${suiteName} — pagination`, () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      count: i,
      name: `row-${String(i).padStart(2, '0')}`,
    }));

    it('renders every row when pagination is false', () => {
      renderTable({ dataSource: many, pagination: false });

      expect(renderedNames()).toHaveLength(12);
    });

    it('limits the page to pageSize', () => {
      renderTable({ dataSource: many, pagination: { pageSize: 5 } });

      expect(renderedNames()).toHaveLength(5);
      expect(renderedNames()[0]).toBe('row-00');
    });

    it('shows the next page when the pager advances', () => {
      renderTable({ dataSource: many, pagination: { pageSize: 5 } });
      act(() => adapter.clickNextPage());

      expect(renderedNames()[0]).toBe('row-05');
    });

    it('hides the pager for a single page when hideOnSinglePage is set', () => {
      renderTable({
        dataSource: PARITY_ROWS,
        pagination: { hideOnSinglePage: true, pageSize: 10 },
      });

      expect(adapter.queryPager()).toBeNull();
    });

    it('renders the pager when there is more than one page', () => {
      renderTable({ dataSource: many, pagination: { pageSize: 5 } });

      expect(adapter.queryPager()).not.toBeNull();
    });
  });

  /**
   * A parent that fetches one page at a time hands over only that page and
   * reports the real size through `total`. The rows in hand must be rendered
   * as-is, and the page change has to reach `onChange` — that callback *is*
   * the refetch.
   */
  describe(`${suiteName} — server-driven pagination`, () => {
    const pageOne = Array.from({ length: 5 }, (_, i) => ({
      count: i,
      name: `row-${String(i).padStart(2, '0')}`,
    }));

    const serverPagination = {
      current: 1,
      pageSize: 5,
      total: 40,
    };

    it('renders the fetched page without re-slicing it', () => {
      renderTable({
        dataSource: pageOne,
        pagination: serverPagination,
      });

      expect(renderedNames()).toHaveLength(5);
      expect(renderedNames()[0]).toBe('row-00');
    });

    it('shows a pager sized from total, not from the rows in hand', () => {
      renderTable({
        dataSource: pageOne,
        pagination: serverPagination,
      });

      expect(adapter.queryPager()).not.toBeNull();
    });

    it('reports the next page through onChange so the parent can refetch', () => {
      const onChange = jest.fn();
      renderTable({
        dataSource: pageOne,
        onChange,
        pagination: serverPagination,
      });

      act(() => adapter.clickNextPage());

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toEqual(
        expect.objectContaining({ current: 2 })
      );
    });

    it('keeps showing the fetched rows after the page advances', () => {
      renderTable({
        dataSource: pageOne,
        onChange: jest.fn(),
        pagination: serverPagination,
      });

      act(() => adapter.clickNextPage());

      // The parent has not refetched in this test, so the same rows stay —
      // what must not happen is an empty page from a second client-side slice.
      expect(renderedNames()).toHaveLength(5);
    });
  });

  describe(`${suiteName} — selection`, () => {
    it('renders a checkbox per row plus the select-all control', () => {
      renderTable({ rowSelection: { onChange: jest.fn() } });

      expect(screen.getAllByRole('checkbox')).toHaveLength(
        PARITY_ROWS.length + 1
      );
    });

    it('reports the selected key and record', () => {
      const onChange = jest.fn();
      renderTable({ rowSelection: { onChange } });
      const rowCheckbox = within(screen.getAllByRole('row')[1]).getByRole(
        'checkbox'
      );
      fireEvent.click(rowCheckbox);

      expect(onChange).toHaveBeenCalled();
      expect(onChange.mock.calls[0][0]).toEqual(['charlie']);
      expect(onChange.mock.calls[0][1]).toEqual([PARITY_ROWS[0]]);
    });

    // AntD renders `input[type=radio]`; React Aria keeps checkbox semantics for
    // table selection and swaps only the visual. The contract that matters to a
    // user is the same either way: one row at a time, and no select-all.
    it('replaces the previous pick when the selection type is radio', () => {
      const onChange = jest.fn();
      renderTable({ rowSelection: { onChange, type: 'radio' } });
      const rows = screen.getAllByRole('row').slice(1);
      fireEvent.click(rows[0].querySelector('input') as HTMLElement);
      fireEvent.click(rows[1].querySelector('input') as HTMLElement);

      expect(onChange.mock.calls.at(-1)?.[0]).toEqual(['alpha']);
    });

    it('offers no select-all control when the selection type is radio', () => {
      renderTable({ rowSelection: { onChange: jest.fn(), type: 'radio' } });

      expect(document.querySelector('thead input')).toBeNull();
    });

    it('disables the control for rows blocked by getCheckboxProps', () => {
      renderTable({
        rowSelection: {
          getCheckboxProps: (record: ParityRow) => ({
            disabled: record.name === 'alpha',
          }),
          onChange: jest.fn(),
        },
      });
      const alphaRow = screen
        .getAllByRole('row')
        .find((row) => within(row).queryByText('alpha'));

      expect(
        within(alphaRow as HTMLElement).getByRole('checkbox')
      ).toBeDisabled();
    });

    it('selects every row on the current page from the select-all control', () => {
      const onChange = jest.fn();
      renderTable({ rowSelection: { onChange } });
      const selectAll = adapter.getSelectAllControl();
      fireEvent.click(selectAll as HTMLElement);

      expect(onChange.mock.calls[0][0]).toEqual(['charlie', 'alpha', 'bravo']);
    });
  });

  describe(`${suiteName} — expandable`, () => {
    it('hides child rows until the parent is expanded', () => {
      renderTable({ dataSource: TREE_ROWS, expandable: {} });

      expect(renderedNames()).toEqual(['parent-one', 'parent-two']);
    });

    it('reveals child rows when the parent is expanded', () => {
      renderTable({ dataSource: TREE_ROWS, expandable: {} });
      act(() => adapter.toggleExpander('parent-one'));

      expect(renderedNames()).toEqual([
        'parent-one',
        'child-one',
        'parent-two',
      ]);
    });

    it('honours controlled expandedRowKeys', () => {
      renderTable({
        dataSource: TREE_ROWS,
        expandable: { expandedRowKeys: ['parent-one'] },
      });

      expect(renderedNames()).toContain('child-one');
    });

    it('calls onExpand with the new state and the record', () => {
      const onExpand = jest.fn();
      renderTable({ dataSource: TREE_ROWS, expandable: { onExpand } });
      act(() => adapter.toggleExpander('parent-one'));

      expect(onExpand).toHaveBeenCalledWith(true, TREE_ROWS[0]);
    });
  });

  describe(`${suiteName} — column extras`, () => {
    it('renders a footer', () => {
      renderTable({ footer: () => 'footer-content' });

      expect(screen.getByText('footer-content')).toBeInTheDocument();
    });

    it('forwards onRow click and double click', () => {
      const onClick = jest.fn();
      const onDoubleClick = jest.fn();
      renderTable({ onRow: () => ({ onClick, onDoubleClick }) });
      const firstRow = screen.getAllByRole('row')[1];
      fireEvent.click(firstRow);
      fireEvent.doubleClick(firstRow);

      expect(onClick).toHaveBeenCalled();
      expect(onDoubleClick).toHaveBeenCalled();
    });

    it('forwards onCell props to the rendered cell', () => {
      renderTable({
        columns: [
          { ...nameColumn, onCell: () => ({ 'data-testid': 'tagged-cell' }) },
          countColumn,
        ],
      });

      expect(screen.getAllByTestId('tagged-cell')).toHaveLength(
        PARITY_ROWS.length
      );
    });

    it('applies a fixed column as sticky', () => {
      renderTable({ columns: [{ ...nameColumn, fixed: 'left' }, countColumn] });
      const cell = firstCell(screen.getAllByRole('row')[1]);

      expect(cell).toHaveStyle({ position: 'sticky' });
    });
  });

  describe(`${suiteName} — duplicate column keys`, () => {
    // AntD renders both columns; React Aria uses the key as a collection id, so
    // a duplicate used to collapse the column and throw on the cell count.
    it('renders every column even when two share a key', () => {
      renderTable({
        columns: [nameColumn, { ...countColumn, key: 'name' }],
      });
      const cells = screen.getAllByRole('row')[1].querySelectorAll('td, th');

      expect(cells).toHaveLength(2);
    });
  });

  describe(`${suiteName} — row key colliding with a column key`, () => {
    // Schema tables render an entity's columns as rows, so a row keyed `name`
    // alongside a `name` column is routine. React Aria keys rows and columns in
    // one namespace, and the column used to vanish.
    it('keeps the column when a row key matches it', () => {
      renderTable({
        dataSource: [
          { count: 1, name: 'name' },
          { count: 2, name: 'other' },
        ],
      });
      const cells = screen.getAllByRole('row')[1].querySelectorAll('td, th');

      expect(cells).toHaveLength(2);
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
  });

  describe(`${suiteName} — duplicate row keys`, () => {
    // A rowKey built from fields that repeat (ListViewTab keys executions by
    // name-status-key) yields duplicates. AntD renders every row; React Aria
    // used to keep only the first.
    it('renders every row even when their keys collide', () => {
      renderTable({
        dataSource: [
          { count: 1, name: 'dup' },
          { count: 2, name: 'dup' },
          { count: 3, name: 'other' },
        ],
      });

      expect(screen.getAllByRole('row')).toHaveLength(4);
    });
  });

  describe(`${suiteName} — key collisions the reviewer flagged`, () => {
    it('does not let a fabricated id collide with a real key', () => {
      // ['dup', 'dup', 'dup-1'] — a naive counter turns the second row into
      // 'dup-1' and it collides with the third.
      renderTable({
        dataSource: [
          { count: 1, name: 'dup' },
          { count: 2, name: 'dup' },
          { count: 3, name: 'dup-1' },
        ],
      });

      expect(screen.getAllByRole('row')).toHaveLength(4);
    });

    it('reports only the row that was selected when keys collide', () => {
      const onChange = jest.fn();
      renderTable({
        dataSource: [
          { count: 1, name: 'dup' },
          { count: 2, name: 'dup' },
        ],
        rowSelection: { onChange },
      });
      const secondRow = screen.getAllByRole('row')[2];
      fireEvent.click(secondRow.querySelector('input') as HTMLElement);

      expect(onChange.mock.calls.at(-1)?.[1]).toHaveLength(1);
      expect(onChange.mock.calls.at(-1)?.[1][0]).toEqual({
        count: 2,
        name: 'dup',
      });
    });
  });

  describe(`${suiteName} — sticky header`, () => {
    // A header stuck by default sat above whatever the page drew over the
    // table afterwards — the notification-templates drawer opened underneath
    // its own list header.
    const stuck = () =>
      Boolean(document.querySelector('thead')?.className.match(/sticky/));

    it('does not stick the header unless asked', () => {
      renderTable();

      expect(stuck()).toBe(false);
    });
  });

  describe(`${suiteName} — container`, () => {
    it('applies containerClassName to the outer container', () => {
      const { container } = renderTable({ containerClassName: 'outer-marker' });

      expect(container.querySelector('.outer-marker')).toBeInTheDocument();
    });

    it('applies className somewhere in the rendered output', () => {
      const { container } = renderTable({ className: 'inner-marker' });

      expect(container.querySelector('.inner-marker')).toBeInTheDocument();
    });
  });

  describe(`${suiteName} — search and custom pagination`, () => {
    it('renders the searchbar when searchProps is given', () => {
      renderTable({ searchProps: { onSearch: jest.fn() } });

      expect(screen.getByTestId('searchbar')).toBeInTheDocument();
    });

    it('renders custom pagination when showPagination is true', () => {
      renderTable({
        customPaginationProps: {
          currentPage: 1,
          pageSize: 10,
          paging: { total: 30 },
          pagingHandler: jest.fn(),
          showPagination: true,
        },
      });

      expect(screen.getByTestId('pagination')).toBeInTheDocument();
    });

    it('hides custom pagination when showPagination is false', () => {
      renderTable({
        customPaginationProps: {
          currentPage: 1,
          pageSize: 10,
          paging: { total: 30 },
          pagingHandler: jest.fn(),
          showPagination: false,
        },
      });

      expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
    });
  });

  describe(`${suiteName} — pagination, round 2`, () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      count: i,
      name: `row-${String(i).padStart(2, '0')}`,
    }));

    it('offers a page-size control when showSizeChanger is set', () => {
      renderTable({
        dataSource: many,
        pagination: { pageSize: 5, showSizeChanger: true },
      });

      expect(adapter.queryPageSizeControl()).not.toBeNull();
    });

    it('falls back to page 1 when the data shrinks below the current page', () => {
      const { rerender } = renderTable({
        dataSource: many,
        pagination: { pageSize: 5 },
      });
      act(() => adapter.clickNextPage());

      expect(renderedNames()[0]).toBe('row-05');

      rerender(
        <TableComponent
          columns={BASE_COLUMNS}
          dataSource={many.slice(0, 3)}
          pagination={{ pageSize: 5 }}
          rowKey="name"
        />
      );

      expect(renderedNames()).toEqual(['row-00', 'row-01', 'row-02']);
    });

    it('renders the shared page-size control for customPaginationProps', () => {
      renderTable({
        customPaginationProps: {
          currentPage: 1,
          onShowSizeChange: jest.fn(),
          pageSize: 10,
          pageSizeOptions: [10, 25, 50],
          paging: { total: 30 },
          pagingHandler: jest.fn(),
          showPagination: true,
        },
      });

      expect(
        screen.getByTestId('page-size-selection-dropdown')
      ).toBeInTheDocument();
    });
  });

  describe(`${suiteName} — expandable, round 2`, () => {
    it('renders expandedRowRender output when the row is expanded', () => {
      renderTable({
        expandable: {
          expandedRowKeys: ['charlie'],
          expandedRowRender: (record: ParityRow) => (
            <span>{`detail-${record.name}`}</span>
          ),
        },
      });

      expect(screen.getByText('detail-charlie')).toBeInTheDocument();
    });

    it('omits the expander for rows rowExpandable rejects', () => {
      renderTable({
        expandable: {
          expandedRowRender: (record: ParityRow) => <span>{record.name}</span>,
          rowExpandable: () => false,
        },
      });

      expect(screen.queryAllByTestId('expand-icon')).toHaveLength(0);
    });

    it('widens child indentation as indentSize grows', () => {
      const { unmount } = renderTable({
        dataSource: TREE_ROWS,
        expandable: { expandedRowKeys: ['parent-one'] },
      });
      const defaultIndent = adapter.getIndentPx('child-one');
      unmount();

      renderTable({
        dataSource: TREE_ROWS,
        expandable: { expandedRowKeys: ['parent-one'] },
        indentSize: 48,
      });

      expect(adapter.getIndentPx('child-one')).toBeGreaterThan(defaultIndent);
    });
  });

  describe(`${suiteName} — sorting, round 2`, () => {
    it('starts descending when sortDirections lists descend first', () => {
      renderTable({
        columns: [
          {
            ...nameColumn,
            sortDirections: ['descend', 'ascend'],
            sorter: (a: ParityRow, b: ParityRow) =>
              a.name.localeCompare(b.name),
          },
          countColumn,
        ],
      });
      fireEvent.click(screen.getByText('Name'));

      expect(renderedNames()).toEqual(['charlie', 'bravo', 'alpha']);
    });
  });

  describe(`${suiteName} — column filters`, () => {
    const filterColumns = [
      {
        ...nameColumn,
        filterDropdown: ({ confirm }: { confirm: () => void }) => (
          <button data-testid="filter-apply" onClick={() => confirm()}>
            apply
          </button>
        ),
        filterIcon: () => <span data-testid="filter-icon">f</span>,
        onFilter: (value: unknown, record: ParityRow) =>
          record.name === String(value),
      },
      countColumn,
    ];

    it('renders the custom filter icon', () => {
      renderTable({ columns: filterColumns });

      expect(screen.getByTestId('filter-icon')).toBeInTheDocument();
    });

    it('opens the custom filter dropdown', () => {
      renderTable({ columns: filterColumns });
      act(() => adapter.openFilter('Name'));

      expect(screen.getByTestId('filter-apply')).toBeInTheDocument();
    });
  });

  describe(`${suiteName} — customize columns`, () => {
    const customizeProps = {
      defaultVisibleColumns: ['name'],
      entityType: 'parityTest',
      staticVisibleColumns: ['name'],
    };

    it('renders the customize control when both column lists are given', () => {
      renderTable(customizeProps);

      expect(screen.getByTestId('column-dropdown')).toBeInTheDocument();
    });

    it('hides a column that is neither static nor default-visible', () => {
      renderTable(customizeProps);

      expect(
        screen.queryByRole('columnheader', { hidden: true, name: /Count/ })
      ).not.toBeInTheDocument();
    });

    it('lists the hideable columns in the dropdown', () => {
      renderTable(customizeProps);
      act(() => adapter.activate(screen.getByTestId('column-dropdown')));

      expect(screen.getByTestId('column-menu-item-count')).toBeInTheDocument();
    });

    it('reveals a column when it is selected in the dropdown', () => {
      renderTable(customizeProps);
      act(() => adapter.activate(screen.getByTestId('column-dropdown')));
      // Both menu items put the testid on the drag container and the toggle on
      // the button inside it.
      act(() =>
        adapter.activate(
          within(screen.getByTestId('column-menu-item-count')).getByRole(
            'button'
          )
        )
      );

      // `hidden: true` because a react-aria popover marks the rest of the page
      // `aria-hidden` while it is open, and the flag outlives the menu in jsdom.
      // The assertion is about column visibility, not aria state.
      expect(
        screen.getByRole('columnheader', { hidden: true, name: /Count/ })
      ).toBeInTheDocument();
    });
  });

  describe(`${suiteName} — selection, round 2`, () => {
    it('reflects controlled selectedRowKeys as checked', () => {
      renderTable({
        rowSelection: { onChange: jest.fn(), selectedRowKeys: ['alpha'] },
      });
      const alphaRow = screen
        .getAllByRole('row')
        .find((row) => within(row).queryByText('alpha'));

      expect(
        within(alphaRow as HTMLElement).getByRole('checkbox')
      ).toBeChecked();
    });
  });

  describe(`${suiteName} — fixed columns, round 2`, () => {
    // NOTE: the *offset* of the second fixed column cannot be asserted here —
    // antd computes it from measured widths, which jsdom reports as 0, so
    // legacy yields `left: 0px` too. TableV2's hardcoded `left: 0` for every
    // left-fixed column stays a review/visual item (plan ref C1).
    it('keeps every column fixed to the same side sticky', () => {
      renderTable({
        columns: [
          { ...nameColumn, fixed: 'left', width: 150 },
          { ...countColumn, fixed: 'left', width: 120 },
        ],
        scroll: { x: 800 },
      });
      const cells = screen.getAllByRole('row')[1].querySelectorAll('td, th');

      expect(cells[0]).toHaveStyle({ position: 'sticky' });
      expect(cells[1]).toHaveStyle({ position: 'sticky' });
    });
  });
};
