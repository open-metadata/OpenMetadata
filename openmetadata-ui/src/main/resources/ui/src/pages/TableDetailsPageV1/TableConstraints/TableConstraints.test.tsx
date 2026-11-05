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

import { render, screen } from '@testing-library/react';
import { ConstraintType, Table } from '../../../generated/entity/data/table';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { tableConstraintRendererBasedOnType } from '../../../utils/TableUtils';
import TableConstraints from './TableConstraints';

const mockOnUpdate = jest.fn().mockResolvedValue(undefined);

let mockGenericContextProps = {
  data: {
    tableConstraints: [
      {
        constraintType: ConstraintType.ClusterKey,
        columns: ['Entity_ID', 'Entity_Type'],
      },
    ],
  } as Table,
  permissions: {
    ...DEFAULT_ENTITY_PERMISSION,
    EditAll: false,
  },
  onUpdate: mockOnUpdate,
};

jest.mock('../../../utils/FqnUtils', () => ({
  getPartialNameFromTableFQN: jest.fn().mockImplementation((value) => value),
}));

jest.mock('../../../utils/EntityUtilClassBase', () => ({
  getEntityLink: jest.fn().mockImplementation(() => '#'),
}));

jest.mock('../../../utils/TableUtils', () => ({
  tableConstraintRendererBasedOnType: jest
    .fn()
    .mockImplementation((constraintType, columns) => (
      <div data-testid={`${constraintType}-container`} key={constraintType}>
        {(columns ?? []).join(',')}
      </div>
    )),
}));

jest.mock(
  './TableConstraintsModal/TableConstraintsModal.component',
  () => () => <div />
);

jest.mock(
  '../../../components/Customization/GenericProvider/GenericContext',
  () => ({
    ...jest.requireActual(
      '../../../components/Customization/GenericProvider/GenericContext'
    ),
    useGenericContext: jest
      .fn()
      .mockImplementation(() => mockGenericContextProps),
  })
);

const mockTableConstraintRendererBasedOnType =
  tableConstraintRendererBasedOnType as jest.MockedFunction<
    typeof tableConstraintRendererBasedOnType
  >;

describe('TableConstraints', () => {
  beforeEach(() => {
    mockTableConstraintRendererBasedOnType.mockClear();
    mockGenericContextProps = {
      data: {
        tableConstraints: [
          {
            constraintType: ConstraintType.ClusterKey,
            columns: ['Entity_ID', 'Entity_Type'],
          },
        ],
      } as Table,
      permissions: {
        ...DEFAULT_ENTITY_PERMISSION,
        EditAll: false,
      },
      onUpdate: mockOnUpdate,
    };
  });

  it('renders cluster key constraints in table details', () => {
    render(<TableConstraints renderAsExpandableCard={false} />);

    expect(
      screen.getByTestId(`${ConstraintType.ClusterKey}-container`)
    ).toBeInTheDocument();
    expect(mockTableConstraintRendererBasedOnType).toHaveBeenCalledWith(
      ConstraintType.ClusterKey,
      ['Entity_ID', 'Entity_Type']
    );
  });

  it('shows the edit-constraint button when EditAll is granted and constraints exist', () => {
    mockGenericContextProps = {
      ...mockGenericContextProps,
      permissions: { ...DEFAULT_ENTITY_PERMISSION, EditAll: true },
    };

    render(<TableConstraints />);

    expect(
      screen.getByTestId('edit-table-constraint-button')
    ).toBeInTheDocument();
  });

  it('shows the add-constraint button when EditAll is granted and no constraints exist', () => {
    mockGenericContextProps = {
      ...mockGenericContextProps,
      data: { tableConstraints: [] } as unknown as Table,
      permissions: { ...DEFAULT_ENTITY_PERMISSION, EditAll: true },
    };

    render(<TableConstraints />);

    expect(
      screen.getByTestId('table-constraints-add-button')
    ).toBeInTheDocument();
  });

  it('hides the edit-constraint button when the table is deleted, even with EditAll granted', () => {
    mockGenericContextProps = {
      ...mockGenericContextProps,
      data: {
        ...mockGenericContextProps.data,
        deleted: true,
      } as Table,
      permissions: { ...DEFAULT_ENTITY_PERMISSION, EditAll: true },
    };

    render(<TableConstraints />);

    expect(
      screen.queryByTestId('edit-table-constraint-button')
    ).not.toBeInTheDocument();
  });
});
