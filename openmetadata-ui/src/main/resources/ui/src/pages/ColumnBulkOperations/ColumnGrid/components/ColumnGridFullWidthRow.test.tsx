/*
 *  Copyright 2025 Collate.
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
import { Table } from '@openmetadata/ui-core-components';
import { render } from '@testing-library/react';

// The grid used to render loading/empty as one full-width row whose fixed
// `colSpan` could outlive the column count react-aria's collection holds, which
// threw `Found 7 cells and 3 columns` out of render and blanked the page.

const COLUMNS = [
  { id: 'columnName' },
  { id: 'path' },
  { id: 'description' },
  { id: 'dataType' },
  { id: 'tags' },
  { id: 'glossaryTerms' },
];

const SpanRowTable = ({
  columns,
  spanCount,
}: {
  columns: { id: string }[];
  spanCount: number;
}) => (
  <Table aria-label="grid" selectionMode="multiple">
    <Table.Header columns={columns}>
      {(column) => (
        <Table.Head
          id={column.id}
          isRowHeader={column.id === 'columnName'}
          key={column.id}
          label={column.id}
        />
      )}
    </Table.Header>
    <Table.Body items={[{ id: '__loading' }]}>
      {() => (
        <Table.Row columns={[{ id: 'span' }]} id="__loading">
          {() => <Table.Cell colSpan={spanCount}>loading</Table.Cell>}
        </Table.Row>
      )}
    </Table.Body>
  </Table>
);

const PerColumnRowTable = ({ columns }: { columns: { id: string }[] }) => (
  <Table aria-label="grid" selectionMode="multiple">
    <Table.Header columns={columns}>
      {(column) => (
        <Table.Head
          id={column.id}
          isRowHeader={column.id === 'columnName'}
          key={column.id}
          label={column.id}
        />
      )}
    </Table.Header>
    <Table.Body items={[{ id: 'row-1' }]}>
      {(item) => (
        <Table.Row columns={columns} id={item.id}>
          {(column) => <Table.Cell>{column.id}</Table.Cell>}
        </Table.Row>
      )}
    </Table.Body>
  </Table>
);

describe('full-width rows in a selectable table', () => {
  it('throws when a fixed colSpan outlives the column count the collection holds', () => {
    const { rerender } = render(
      <SpanRowTable columns={COLUMNS} spanCount={COLUMNS.length} />
    );

    expect(() =>
      rerender(
        <SpanRowTable
          columns={COLUMNS.slice(0, 2)}
          spanCount={COLUMNS.length}
        />
      )
    ).toThrow(/Cell count must match column count/);
  });

  it('survives the same change when every cell comes from the column list', () => {
    const { rerender } = render(<PerColumnRowTable columns={COLUMNS} />);

    expect(() =>
      rerender(<PerColumnRowTable columns={COLUMNS.slice(0, 2)} />)
    ).not.toThrow();
  });
});
