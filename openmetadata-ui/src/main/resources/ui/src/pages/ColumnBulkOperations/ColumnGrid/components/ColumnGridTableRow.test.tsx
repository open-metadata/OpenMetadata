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
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ColumnGridRowData } from '../ColumnGrid.interface';
import { ColumnGridTableRow } from './ColumnGridTableRow';

const ROW_TEST_ID = 'column-row-test_col';
const CELL_TEXT = {
  columnName: 'name',
  path: 'path',
  description: 'desc',
  tags: 'tags',
  glossaryTerms: 'glossary',
};

jest.mock('@openmetadata/ui-core-components', () => ({
  Table: {
    Row: ({
      children,
      columns,
      ...props
    }: {
      children: (col: { id: string }) => React.ReactNode;
      columns: { id: string }[];
      [key: string]: unknown;
    }) => (
      <div
        data-row-type={props['data-row-type'] as string}
        data-testid={props['data-testid'] as string}>
        {columns.map((col) => (
          <React.Fragment key={col.id}>{children(col)}</React.Fragment>
        ))}
      </div>
    ),
    Cell: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
      [key: string]: unknown;
    }) => <div data-testid={props['data-testid'] as string}>{children}</div>,
  },
}));

jest.mock('../../../../components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <span data-testid="loader" />)
);

const mockEntity = {
  id: 'col-1',
  columnName: 'test_col',
  dataType: 'VARCHAR',
} as ColumnGridRowData;

const mockTableColumns = [
  { id: 'columnName' },
  { id: 'path' },
  { id: 'description' },
  { id: 'dataType' },
  { id: 'tags' },
  { id: 'glossaryTerms' },
];

const cellSlots = [
  <ColumnGridTableRow.Cell columnId="columnName" key="columnName">
    <span>{CELL_TEXT.columnName}</span>
  </ColumnGridTableRow.Cell>,
  <ColumnGridTableRow.Cell columnId="path" key="path">
    <span>{CELL_TEXT.path}</span>
  </ColumnGridTableRow.Cell>,
  <ColumnGridTableRow.Cell columnId="description" key="description">
    <span>{CELL_TEXT.description}</span>
  </ColumnGridTableRow.Cell>,
  <ColumnGridTableRow.Cell columnId="tags" key="tags">
    <span>{CELL_TEXT.tags}</span>
  </ColumnGridTableRow.Cell>,
  <ColumnGridTableRow.Cell columnId="glossaryTerms" key="glossaryTerms">
    <span>{CELL_TEXT.glossaryTerms}</span>
  </ColumnGridTableRow.Cell>,
];

describe('ColumnGridTableRow', () => {
  it('places each supplied cell slot in its matching column', () => {
    render(
      <ColumnGridTableRow
        entity={mockEntity}
        isSelected={false}
        tableColumns={mockTableColumns}>
        {cellSlots}
      </ColumnGridTableRow>
    );

    expect(screen.getByTestId(ROW_TEST_ID)).toBeInTheDocument();
    expect(screen.getByTestId('column-name-cell')).toBeInTheDocument();
    expect(screen.getByTestId('column-description-cell')).toBeInTheDocument();
    expect(screen.getByText(CELL_TEXT.columnName)).toBeInTheDocument();
    expect(screen.getByText(CELL_TEXT.description)).toBeInTheDocument();
    expect(screen.getByText(CELL_TEXT.tags)).toBeInTheDocument();
    expect(screen.getByText(CELL_TEXT.glossaryTerms)).toBeInTheDocument();
    // dataType is rendered from the entity directly, not via a cell slot.
    expect(screen.getByText('VARCHAR')).toBeInTheDocument();
  });

  it('shows the refetch loader on the column-name cell when isPendingRefetch', () => {
    render(
      <ColumnGridTableRow
        isPendingRefetch
        entity={mockEntity}
        isSelected={false}
        tableColumns={[{ id: 'columnName' }]}>
        <ColumnGridTableRow.Cell columnId="columnName">
          <span>{CELL_TEXT.columnName}</span>
        </ColumnGridTableRow.Cell>
      </ColumnGridTableRow>
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('marks the row as parent or child based on the entity', () => {
    const { rerender } = render(
      <ColumnGridTableRow
        entity={mockEntity}
        isSelected={false}
        tableColumns={mockTableColumns}>
        {cellSlots}
      </ColumnGridTableRow>
    );

    expect(screen.getByTestId(ROW_TEST_ID)).toHaveAttribute(
      'data-row-type',
      'parent'
    );

    rerender(
      <ColumnGridTableRow
        showParentChildColors
        entity={{ ...mockEntity, parentId: 'p1' } as ColumnGridRowData}
        isSelected={false}
        tableColumns={mockTableColumns}>
        {cellSlots}
      </ColumnGridTableRow>
    );

    expect(screen.getByTestId(ROW_TEST_ID)).toHaveAttribute(
      'data-row-type',
      'child'
    );
  });
});
