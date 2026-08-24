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
  jest.fn().mockImplementation(() => <span data-testid="loader">loader</span>)
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

const renderProps = {
  renderColumnNameCell: jest.fn(() => <span>name</span>),
  renderPathCell: jest.fn(() => <span>path</span>),
  renderDescriptionCell: jest.fn(() => <span>desc</span>),
  renderTagsCell: jest.fn(() => <span>tags</span>),
  renderGlossaryTermsCell: jest.fn(() => <span>glossary</span>),
};

describe('ColumnGridTableRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the row and delegates each cell to its render adapter', () => {
    render(
      <ColumnGridTableRow
        entity={mockEntity}
        isSelected={false}
        tableColumns={mockTableColumns}
        {...renderProps}
      />
    );

    expect(screen.getByTestId('column-row-test_col')).toBeInTheDocument();
    expect(screen.getByTestId('column-name-cell')).toBeInTheDocument();
    expect(screen.getByTestId('column-description-cell')).toBeInTheDocument();
    expect(renderProps.renderColumnNameCell).toHaveBeenCalledWith(mockEntity);
    expect(renderProps.renderDescriptionCell).toHaveBeenCalledWith(mockEntity);
    expect(renderProps.renderTagsCell).toHaveBeenCalledWith(mockEntity);
    expect(renderProps.renderGlossaryTermsCell).toHaveBeenCalledWith(
      mockEntity
    );
    // dataType is rendered from the entity directly, not via an adapter.
    expect(screen.getByText('VARCHAR')).toBeInTheDocument();
  });

  it('shows the refetch loader on the column-name cell when isPendingRefetch', () => {
    render(
      <ColumnGridTableRow
        isPendingRefetch
        entity={mockEntity}
        isSelected={false}
        tableColumns={[{ id: 'columnName' }]}
        {...renderProps}
      />
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('marks the row as parent or child based on the entity', () => {
    const { rerender } = render(
      <ColumnGridTableRow
        entity={mockEntity}
        isSelected={false}
        tableColumns={mockTableColumns}
        {...renderProps}
      />
    );

    expect(screen.getByTestId('column-row-test_col')).toHaveAttribute(
      'data-row-type',
      'parent'
    );

    rerender(
      <ColumnGridTableRow
        showParentChildColors
        entity={{ ...mockEntity, parentId: 'p1' } as ColumnGridRowData}
        isSelected={false}
        tableColumns={mockTableColumns}
        {...renderProps}
      />
    );

    expect(screen.getByTestId('column-row-test_col')).toHaveAttribute(
      'data-row-type',
      'child'
    );
  });
});
