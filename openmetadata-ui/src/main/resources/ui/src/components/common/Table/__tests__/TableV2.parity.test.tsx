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
import { ComponentType } from 'react';
import { useDragAndDrop } from 'react-aria-components';
import TableV2 from '../TableV2';
import { ParityAdapter, runTableParitySuite } from './tableParity.shared';

/**
 * react-aria's `usePress` listens on pointer events, not `click`, so a bare
 * `fireEvent.click` never activates a core Button/MenuItem in jsdom.
 */
const press = (element: HTMLElement) => {
  fireEvent.pointerDown(element, {
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
  });
  fireEvent.pointerUp(element, {
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
  });
  fireEvent.click(element);
};

/** Control access for the ui-core-components DOM. Assertions stay in the shared suite. */
const coreAdapter: ParityAdapter = {
  activate: (element) => press(element),
  clickNextPage: () => {
    fireEvent.click(screen.getByTestId('next'));
  },
  getTextAlign: (el) =>
    el.className.includes('tw:text-right')
      ? 'right'
      : el.className.includes('tw:text-center')
      ? 'center'
      : '',
  isBordered: () =>
    (document.querySelector('table') as HTMLElement).className.includes(
      'border-secondary'
    ),
  getTableLayout: () =>
    (document.querySelector('table') as HTMLElement).classList.contains(
      'tw:table-fixed'
    )
      ? 'fixed'
      : 'auto',
  getIndentPx: (label) => {
    const row = screen
      .getAllByRole('row')
      .find((candidate) => within(candidate).queryByText(label));
    const cell = (row as HTMLElement).querySelector(
      'td, th'
    ) as HTMLElement | null;

    return cell ? parseFloat(cell.style.paddingLeft || '0') : 0;
  },
  openFilter: () => {
    press(screen.getByLabelText('filter'));
  },
  queryPageSizeControl: () => screen.queryByTestId('rows-per-page-dropdown'),
  getSelectAllControl: () =>
    document.querySelector(
      'thead input[type="checkbox"]'
    ) as HTMLElement | null,
  // The core pager has no single root test id; its next control stands in for
  // "a pager is on screen".
  queryPager: () => screen.queryByTestId('next'),
  toggleExpander: (label) => {
    const row = screen
      .getAllByRole('row')
      .find((candidate) => within(candidate).queryByText(label));
    fireEvent.click(within(row as HTMLElement).getByTestId('expand-icon'));
  },
};

runTableParitySuite('TableV2', TableV2, coreAdapter);

/**
 * Not a parity spec — an intentional divergence from legacy. `customPaginationProps`
 * now *requires* `pagination={false}` in the props type, so the pair can only be
 * mismatched at an untyped boundary. The runtime short-circuit is the backstop for
 * that case: AntD would slice the page a second time, TableV2 must not.
 */
describe('TableV2 — parent-owned pagination', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    count: i,
    name: `row-${String(i).padStart(2, '0')}`,
  }));

  const columns = [
    { dataIndex: 'name', key: 'name', title: 'Name' },
    { dataIndex: 'count', key: 'count', title: 'Count' },
  ];

  const customPaginationProps = {
    currentPage: 1,
    pageSize: 50,
    paging: { total: 120 },
    pagingHandler: jest.fn(),
    showPagination: true,
  };

  it('renders every row the parent supplied rather than slicing to a page size', () => {
    render(
      <TableV2
        columns={columns}
        customPaginationProps={customPaginationProps}
        dataSource={rows}
        pagination={false}
        rowKey="name"
      />
    );

    expect(screen.getAllByRole('row')).toHaveLength(rows.length + 1);
  });

  it('still refuses to slice when the pagination contract is bypassed untyped', () => {
    // Mirrors a JS call site, or a `tableProps` spread that TypeScript cannot
    // narrow — the case the props type cannot catch.
    const UntypedTable = TableV2 as unknown as ComponentType<
      Record<string, unknown>
    >;
    render(
      <UntypedTable
        columns={columns}
        customPaginationProps={customPaginationProps}
        dataSource={rows}
        rowKey="name"
      />
    );

    expect(screen.getAllByRole('row')).toHaveLength(rows.length + 1);
  });
});

/**
 * TableV2-only: legacy AntD has the same weakness here, so requiring both to
 * pass would be asking legacy to be better than it is. `getCheckboxProps` was
 * evaluated against the whole filtered dataset while rows were keyed by their
 * position within the page, so with no `rowKey` the disabled set pointed at the
 * wrong rows on every page after the first.
 */
describe('TableV2 — disabled rows on a later page', () => {
  it('disables the row the call site asked for, not its page-relative twin', () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      count: i,
      name: `row-${i}`,
    }));
    render(
      <TableV2
        columns={[
          { dataIndex: 'name', key: 'name', title: 'Name' },
          { dataIndex: 'count', key: 'count', title: 'Count' },
        ]}
        dataSource={rows}
        pagination={{ pageSize: 3 }}
        rowSelection={{
          getCheckboxProps: (record: { name: string }) => ({
            disabled: record.name === 'row-4',
          }),
          onChange: jest.fn(),
        }}
      />
    );
    fireEvent.click(screen.getByTestId('next'));

    const disabled = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).queryByRole('checkbox'))
      .map((box) => Boolean(box && (box as HTMLInputElement).disabled));

    expect(disabled).toEqual([false, true, false]);
  });
});

/** A one-column, one-row table — enough to read a layout decision off the DOM. */
const renderMinimal = (props: Record<string, unknown>) =>
  render(
    <TableV2
      columns={[{ dataIndex: 'name', key: 'name', title: 'Name' }]}
      dataSource={[{ name: 'alpha' }]}
      pagination={false}
      rowKey="name"
      {...props}
    />
  );

/**
 * TableV2-only: legacy AntD fixes its header by rendering a separate header
 * table rather than by sticking it, so there is no shared class to assert.
 */
describe('TableV2 — sticky header opt-in', () => {
  const stuck = () =>
    Boolean(document.querySelector('thead')?.className.match(/sticky/));

  it('sticks when scroll.y gives the body its own scroller', () => {
    renderMinimal({ scroll: { y: 200 } });

    expect(stuck()).toBe(true);
  });

  it('sticks when the call site asks with `sticky`', () => {
    renderMinimal({ sticky: true });

    expect(stuck()).toBe(true);
  });
});

/**
 * TableV2-only: AntD has no cell wrapper at all, so there is nothing to compare
 * against. The wrapper exists to place the tree expander beside the value; when
 * there is no expander it must not lay anything out, or content a cell renders
 * inline (a dropdown, a popover) is sized by it. A Glossary Terms dropdown came
 * out a few pixels wide.
 */
describe('TableV2 — cell content is not boxed without an expander', () => {
  const firstCellWrapper = () =>
    screen.getAllByRole('row')[1].querySelector('td, th')
      ?.firstElementChild as HTMLElement;

  it('does not create a flex box when there is no expander', () => {
    render(
      <TableV2
        columns={[{ dataIndex: 'name', key: 'name', title: 'Name' }]}
        dataSource={[{ name: 'alpha' }]}
        pagination={false}
        rowKey="name"
      />
    );

    expect(firstCellWrapper().className).toContain('tw:contents');
    expect(firstCellWrapper().className).not.toContain('tw:flex');
  });

  it('lays out a row with an expander so the icon sits beside the value', () => {
    render(
      <TableV2
        columns={[{ dataIndex: 'name', key: 'name', title: 'Name' }]}
        dataSource={[{ children: [{ name: 'child' }], name: 'parent' }]}
        expandable={{}}
        pagination={false}
        rowKey="name"
      />
    );

    expect(firstCellWrapper().className).toContain('tw:flex');
  });
});

/**
 * TableV2-only: an `ellipsis` column has to truncate whether or not the row
 * carries an expander, and the two paths lay the value out differently — the
 * expander case puts it in a flex row, the plain case leaves it a block child
 * of the cell. Raised in review: `flex-1` is inert under `display: contents`.
 */
describe('TableV2 — ellipsis columns', () => {
  const longRow = {
    count: 1,
    name: 'a-very-long-value-that-should-be-clipped',
  };

  const valueDiv = () =>
    screen
      .getAllByRole('row')[1]
      .querySelector('td, th')
      ?.querySelector('div.tw\\:truncate') as HTMLElement;

  it('truncates without an expander, and drops the inert flex classes', () => {
    render(
      <TableV2
        columns={[
          { dataIndex: 'name', ellipsis: true, key: 'name', title: 'Name' },
        ]}
        dataSource={[longRow]}
        pagination={false}
        rowKey="name"
      />
    );

    expect(valueDiv()).toBeInTheDocument();
    expect(valueDiv().className).not.toContain('tw:flex-1');
  });

  it('keeps the flex classes when an expander shares the cell', () => {
    render(
      <TableV2
        columns={[
          { dataIndex: 'name', ellipsis: true, key: 'name', title: 'Name' },
        ]}
        dataSource={[{ ...longRow, children: [{ count: 2, name: 'child' }] }]}
        expandable={{}}
        pagination={false}
        rowKey="name"
      />
    );

    expect(valueDiv().className).toContain('tw:flex-1');
    expect(valueDiv().className).toContain('tw:min-w-0');
  });
});

/**
 * Divergence by design. The legacy wrapper hardcoded `tableLayout="fixed"`
 * *after* its prop spread, so a call site could not ask for anything else.
 * TableV2 keeps fixed as the default — that is what every table it inherits
 * was laid out with — but lets the tables that came straight from AntD, and
 * were sized by their content, say so.
 */
describe('TableV2 — column layout opt-out', () => {
  const layout = () =>
    (document.querySelector('table') as HTMLElement).classList.contains(
      'tw:table-fixed'
    )
      ? 'fixed'
      : 'auto';

  it('sizes columns by content when the call site asks for auto', () => {
    renderMinimal({ tableLayout: 'auto' });

    expect(layout()).toBe('auto');
  });

  it('keeps fixed for resizable columns even when auto is requested', () => {
    // An auto table re-solves its own widths, which swallows the drag.
    renderMinimal({ resizableColumns: true, tableLayout: 'auto' });

    expect(layout()).toBe('fixed');
  });
});

/**
 * TableV2-only. Legacy resizing came from `react-antd-column-resize`, which
 * sizes columns from measured widths — in jsdom every measurement is 0 and it
 * renders no handle at all, so there is nothing on the legacy side to compare
 * against. React Aria's resizer is declarative and does render.
 *
 * These also guard the packaging: the resizer reads state the table publishes
 * through React Aria context, so a duplicated `react-aria-components` copy
 * makes rendering throw "Wrap your <Table> in a <ResizableTableContainer>"
 * with the container present in the tree.
 */
describe('TableV2 — column resizing', () => {
  const renderResizable = (props: Record<string, unknown> = {}) =>
    render(
      <TableV2
        resizableColumns
        columns={[
          { dataIndex: 'name', key: 'name', title: 'Name', width: 200 },
          { dataIndex: 'count', key: 'count', title: 'Count', width: 200 },
        ]}
        dataSource={[{ count: 1, name: 'alpha' }]}
        pagination={false}
        rowKey="name"
        {...props}
      />
    );

  const resizers = () =>
    document.querySelectorAll('[class*="cursor-col-resize"]');

  it('renders without the container error', () => {
    expect(() => renderResizable()).not.toThrow();
  });

  it('gives every column a resize handle', () => {
    renderResizable();

    expect(resizers()).toHaveLength(2);
  });

  it('renders no handle when resizing is off', () => {
    render(
      <TableV2
        columns={[{ dataIndex: 'name', key: 'name', title: 'Name' }]}
        dataSource={[{ name: 'alpha' }]}
        pagination={false}
        rowKey="name"
      />
    );

    expect(resizers()).toHaveLength(0);
  });

  it('keeps a fixed layout so a drag is not re-solved away', () => {
    renderResizable();

    expect(
      (document.querySelector('table') as HTMLElement).classList.contains(
        'tw:table-fixed'
      )
    ).toBe(true);
  });
});

/**
 * TableV2-only by design. Legacy row drag and drop was assembled per call site
 * out of `components.body.row` and react-dnd; React Aria owns it here through
 * `dragAndDropHooks`, so the two have no shared DOM to assert against. What
 * matters is that the call site's own HTML5 drag handlers are dropped when
 * React Aria is in charge — two drag implementations on one row fight — and
 * kept when it is not.
 */
describe('TableV2 — row drag and drop', () => {
  const bodyRow = () => screen.getAllByRole('row')[1] as HTMLElement;

  const renderWithHooks = (onRow?: () => Record<string, unknown>) => {
    const Harness = () => {
      const { dragAndDropHooks } = useDragAndDrop({ getItems: () => [] });

      return (
        <TableV2
          columns={[{ dataIndex: 'name', key: 'name', title: 'Name' }]}
          dataSource={[{ name: 'alpha' }]}
          dragAndDropHooks={dragAndDropHooks}
          pagination={false}
          rowKey="name"
          onRow={onRow}
        />
      );
    };

    return render(<Harness />);
  };

  it('makes rows draggable when dragAndDropHooks is supplied', () => {
    renderWithHooks();

    expect(bodyRow()).toHaveAttribute('draggable', 'true');
  });

  it('leaves rows undraggable without them', () => {
    render(
      <TableV2
        columns={[{ dataIndex: 'name', key: 'name', title: 'Name' }]}
        dataSource={[{ name: 'alpha' }]}
        pagination={false}
        rowKey="name"
      />
    );

    expect(bodyRow()).not.toHaveAttribute('draggable', 'true');
  });

  it('does not honour native drag handlers passed through onRow', () => {
    // React Aria's Row owns drag and drop; a call site that needs draggable
    // rows supplies dragAndDropHooks rather than HTML5 handlers. Pinned so the
    // limitation is discovered here rather than in the browser.
    const onDragStart = jest.fn();
    render(
      <TableV2
        columns={[{ dataIndex: 'name', key: 'name', title: 'Name' }]}
        dataSource={[{ name: 'alpha' }]}
        pagination={false}
        rowKey="name"
        onRow={() => ({ onDragStart })}
      />
    );

    fireEvent.dragStart(bodyRow());

    expect(onDragStart).not.toHaveBeenCalled();
  });
});

/**
 * TableV2-only: legacy AntD masks the table with its own `Spin` wrapper, so
 * there is no shared DOM to assert. What matters here is that the overlay is
 * anchored — an `inset-0` overlay with no positioned ancestor escapes to the
 * viewport, dims the whole page and centres its spinner away from the rows it
 * is meant to be masking.
 */
describe('TableV2 — loading overlay is anchored to the table', () => {
  it('gives the overlay a positioned ancestor', () => {
    render(
      <TableV2
        loading
        columns={[{ dataIndex: 'name', key: 'name', title: 'Name' }]}
        dataSource={[{ name: 'alpha' }]}
        pagination={false}
        rowKey="name"
      />
    );

    const overlay = document.querySelector('[class*="inset-0"]');

    expect(overlay).not.toBeNull();
    expect((overlay as HTMLElement).parentElement?.className).toContain(
      'tw:relative'
    );
  });
});

/**
 * TableV2-only: legacy AntD pads its own `.ant-table-placeholder` cell, so the
 * padding lives in a class this suite cannot compare against. What matters is
 * that a call site's placeholder is padded like the built-in one — dropping
 * the wrapper crowds the empty state against the header.
 */
describe('TableV2 — empty state padding', () => {
  const renderEmpty = (props: Record<string, unknown> = {}) =>
    render(
      <TableV2
        columns={[{ dataIndex: 'name', key: 'name', title: 'Name' }]}
        dataSource={[]}
        pagination={false}
        rowKey="name"
        {...props}
      />
    );

  const padded = (el: Element | null) =>
    Boolean(el?.closest('[class*="py-8"]'));

  it('pads the placeholder a call site supplies', () => {
    renderEmpty({
      locale: { emptyText: <span data-testid="mine">Nothing here</span> },
    });

    expect(padded(screen.getByTestId('mine'))).toBe(true);
  });

  it('pads the built-in placeholder too', () => {
    renderEmpty();

    expect(padded(screen.getByText('label.no-data'))).toBe(true);
  });
});

/**
 * TableV2-only: legacy AntD leaves wrapping to its own stylesheet, so there is
 * no shared class to compare. The contract here is that a cell confines its
 * content — an unbreakable string in a width-constrained column must wrap
 * rather than overflow onto the column beside it.
 */
describe('TableV2 — cells confine their content', () => {
  it('lets a long unbreakable value break inside its own cell', () => {
    render(
      <TableV2
        columns={[
          { dataIndex: 'name', key: 'name', title: 'Name', width: 250 },
          { dataIndex: 'other', key: 'other', title: 'Other' },
        ]}
        dataSource={[{ name: 't'.repeat(160), other: 'x' }]}
        pagination={false}
        rowKey="name"
      />
    );

    const cell = screen.getAllByRole('row')[1].querySelector('td, th');

    expect((cell as HTMLElement).className).toContain('tw:break-words');
  });
});

/**
 * TableV2-only: AntD renders its own numbered pager, the core one is a
 * different control, so there is no shared DOM to compare. What matters is
 * that both ways of changing the page reach the parent — for a server-paged
 * table `onChange` is the only signal it has to refetch on.
 */
describe('TableV2 — the pager reaches the parent', () => {
  const renderPaged = (onChange: jest.Mock) =>
    render(
      <TableV2
        columns={[{ dataIndex: 'name', key: 'name', title: 'Name' }]}
        dataSource={[{ name: 'alpha' }]}
        pagination={{
          current: 1,
          pageSize: 10,
          pageSizeOptions: ['10', '25'],
          showSizeChanger: true,
          total: 40,
        }}
        rowKey="name"
        onChange={onChange}
      />
    );

  it('reports a page change', () => {
    const onChange = jest.fn();
    renderPaged(onChange);

    fireEvent.click(screen.getByTestId('next'));

    expect(onChange.mock.calls[0][0]).toEqual(
      expect.objectContaining({ current: 2 })
    );
  });

  it('reports a page-size change', () => {
    const onChange = jest.fn();
    renderPaged(onChange);

    // The test id sits on the Select wrapper; its button is the trigger.
    press(
      within(screen.getByTestId('rows-per-page-dropdown')).getByRole('button')
    );
    press(screen.getByTestId('rows-per-page-option-25'));

    expect(onChange.mock.calls[0][0]).toEqual(
      expect.objectContaining({ pageSize: 25 })
    );
  });
});

/**
 * TableV2-only: AntD sizes columns through a `<col>` element, so there is no
 * shared attribute to compare. What matters is that it sets no per-column
 * min-width — a percentage floor rounds up on every column and the total then
 * exceeds the container, raising a scrollbar on a table that fits.
 */
describe('TableV2 — column width floors', () => {
  const renderWith = (width: number | string) => {
    render(
      <TableV2
        columns={[
          { dataIndex: 'a', key: 'a', title: 'A', width },
          { dataIndex: 'b', key: 'b', title: 'B' },
        ]}
        dataSource={[{ a: '1', b: '2' }]}
        pagination={false}
        rowKey="a"
      />
    );

    return document.querySelector('thead th') as HTMLElement;
  };

  it('floors a pixel width so the column keeps its size', () => {
    expect(renderWith(250).style.minWidth).toBe('250px');
  });

  it('leaves a percentage width unfloored', () => {
    expect(renderWith('32%').style.minWidth).toBe('');
  });
});

/**
 * TableV2-only: AntD sets no vertical-align at all, so its cells take the
 * browser default for a `td`, which centres them. jsdom does not apply that UA
 * rule, so there is nothing to read off the legacy side — the contract is that
 * TableV2 does not override it in the other direction.
 */
describe('TableV2 — cells centre their content vertically', () => {
  it('does not top-align by default', () => {
    render(
      <TableV2
        columns={[{ dataIndex: 'name', key: 'name', title: 'Name' }]}
        dataSource={[{ name: 'alpha' }]}
        pagination={false}
        rowKey="name"
      />
    );

    const cell = screen.getAllByRole('row')[1].querySelector('td, th');

    expect((cell as HTMLElement).className).toContain('tw:align-middle');
    expect((cell as HTMLElement).className).not.toContain('tw:align-top');
  });

  it('still lets a call site choose its own alignment', () => {
    render(
      <TableV2
        cellClassName="tw:p-2 tw:align-top"
        columns={[{ dataIndex: 'name', key: 'name', title: 'Name' }]}
        dataSource={[{ name: 'alpha' }]}
        pagination={false}
        rowKey="name"
      />
    );

    const cell = screen.getAllByRole('row')[1].querySelector('td, th');

    expect((cell as HTMLElement).className).toContain('tw:align-top');
  });
});
