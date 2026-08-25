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
  queryPageSizeControl: () =>
    screen.queryByTestId('page-size-selection-dropdown'),
  getSelectAllControl: () =>
    document.querySelector(
      'thead input[type="checkbox"]'
    ) as HTMLElement | null,
  queryPager: () => screen.queryByTestId('pagination'),
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

/**
 * TableV2-only: legacy AntD fixes its header by rendering a separate header
 * table rather than by sticking it, so there is no shared class to assert.
 */
describe('TableV2 — sticky header opt-in', () => {
  const renderWith = (props: Record<string, unknown>) =>
    render(
      <TableV2
        columns={[{ dataIndex: 'name', key: 'name', title: 'Name' }]}
        dataSource={[{ name: 'alpha' }]}
        pagination={false}
        rowKey="name"
        {...props}
      />
    );

  const stuck = () =>
    Boolean(document.querySelector('thead')?.className.match(/sticky/));

  it('sticks when scroll.y gives the body its own scroller', () => {
    renderWith({ scroll: { y: 200 } });

    expect(stuck()).toBe(true);
  });

  it('sticks when the call site asks with `sticky`', () => {
    renderWith({ sticky: true });

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
