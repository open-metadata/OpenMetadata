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
