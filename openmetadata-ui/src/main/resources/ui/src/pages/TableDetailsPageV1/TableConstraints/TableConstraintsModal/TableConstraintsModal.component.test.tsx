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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TABLE_CONSTRAINTS_TYPE_OPTIONS } from '../../../../constants/Table.constants';
import {
  ConstraintType,
  DataType,
  Table,
} from '../../../../generated/entity/data/table';
import { searchQuery } from '../../../../rest/searchAPI';
import TableConstraintsModal from './TableConstraintsModal.component';

const mockOnSave = jest.fn().mockResolvedValue(undefined);
const mockOnClose = jest.fn();
const mockSearchQuery = searchQuery as jest.MockedFunction<typeof searchQuery>;

const mockTableDetails = {
  service: {
    name: 'repro_cluster_service',
  },
  columns: [
    {
      name: 'Entity_ID',
      dataType: DataType.Int,
    },
    {
      name: 'Entity_Type',
      dataType: DataType.Int,
    },
  ],
} as Table;

const mockConstraint: Table['tableConstraints'] = [
  {
    constraintType: ConstraintType.ClusterKey,
    columns: ['Entity_ID', 'Entity_Type'],
  },
];

jest.mock('../../../../utils/EntityUtils', () => ({
  getBreadcrumbsFromFqn: jest
    .fn()
    .mockImplementation(() => [
      { name: 'service' },
      { name: 'database' },
      { name: 'schema' },
      { name: 'table' },
      { name: 'column' },
    ]),
}));

jest.mock('../../../../utils/ServiceUtils', () => ({
  getServiceNameQueryFilter: jest.fn().mockImplementation(() => ''),
}));

jest.mock('../../../../utils/StringsUtils', () => ({
  escapeESReservedCharacters: jest.fn().mockImplementation((value) => value),
  getEncodedFqn: jest.fn().mockImplementation((value) => value),
}));

jest.mock('../../../../utils/TableUtils', () => ({
  createTableConstraintObject: jest
    .fn()
    .mockImplementation((constraints, type) =>
      Array.isArray(constraints) && constraints.length > 0
        ? [{ columns: constraints, constraintType: type }]
        : []
    ),
  getColumnOptionsFromTableColumn: jest.fn().mockImplementation((columns) =>
    (columns ?? []).map((column: { name: string }) => ({
      label: column.name,
      value: column.name,
    }))
  ),
}));

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({ hits: { hits: [] } }),
}));

describe('TableConstraintsModal', () => {
  beforeEach(() => {
    mockOnSave.mockClear();
    mockOnClose.mockClear();
    mockSearchQuery.mockClear();
  });

  it('includes cluster key in available constraint types', () => {
    expect(
      TABLE_CONSTRAINTS_TYPE_OPTIONS.some(
        ({ value }) => value === ConstraintType.ClusterKey
      )
    ).toBe(true);
  });

  it('preserves cluster key constraints on save', async () => {
    render(
      <TableConstraintsModal
        constraint={mockConstraint}
        tableDetails={mockTableDetails}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByTestId('save-btn'));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            constraintType: ConstraintType.ClusterKey,
            columns: ['Entity_ID', 'Entity_Type'],
          }),
        ])
      );
    });

    expect(mockSearchQuery).not.toHaveBeenCalled();
  });
});
