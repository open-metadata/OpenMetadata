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
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { Column, DataType } from '../../../generated/entity/data/table';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import ContractSchemaTable from './ContractSchemaTable.component';

jest.mock('../../common/StatusBadge/StatusBadgeV2.component', () => {
  return jest.fn().mockImplementation(() => <p>StatusBadgeV2</p>);
});

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockImplementation(() => ({
    entityType: 'table',
  })),
}));

const mockSchemaDetail: Column[] = [
  {
    name: 'id',
    dataType: DataType.Array,
    constraint: 'PRIMARY_KEY',
  } as Column,
  {
    name: 'name',
    dataType: DataType.Varchar,
    constraint: 'NOT_NULL',
  } as Column,
  {
    name: 'email',
    dataType: DataType.Varchar,
  } as Column,
  {
    name: 'contract',
    dataType: DataType.Varchar,
  } as Column,
  {
    name: 'property',
    dataType: DataType.Varchar,
  } as Column,
  {
    name: 'business',
    dataType: DataType.Varchar,
  } as Column,
];

describe('ContractSchemaTable', () => {
  it('should render ContractSchemaTable', () => {
    render(<ContractSchemaTable schemaDetail={mockSchemaDetail} />);

    expect(screen.getByText('label.name')).toBeInTheDocument();
    expect(screen.getByText('label.type')).toBeInTheDocument();
    expect(screen.getByText('label.constraint-plural')).toBeInTheDocument();
    expect(screen.queryByText('label.column-status')).not.toBeInTheDocument();
    expect(screen.queryByText('StatusBadgeV2')).not.toBeInTheDocument();
  });

  it('should render ColumnStatus column when latestSchemaValidationResult present', () => {
    render(
      <ContractSchemaTable
        latestSchemaValidationResult={{
          failed: 1,
          failedFields: ['name'],
          passed: 5,
          total: 6,
        }}
        schemaDetail={mockSchemaDetail}
      />
    );

    expect(screen.getByText('label.column-status')).toBeInTheDocument();
    expect(screen.getByTestId('schema-column-name-failed')).toBeInTheDocument();
    expect(screen.getByTestId('schema-column-id-success')).toBeInTheDocument();
    expect(
      screen.getByTestId('schema-column-email-success')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('schema-column-contract-success')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('schema-column-property-success')
    ).toBeInTheDocument();

    // Since being on second page
    expect(
      screen.queryByTestId('schema-column-business-success')
    ).not.toBeInTheDocument();
  });

  it('should render schema table with pagination', () => {
    render(<ContractSchemaTable schemaDetail={mockSchemaDetail} />);

    expect(screen.getByTitle('Previous Page')).toBeInTheDocument();
    expect(screen.getByTitle('Next Page')).toBeInTheDocument();
    // Pagination items
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should render SchemaTable Status badge', () => {
    render(
      <ContractSchemaTable
        contractStatus="passed"
        schemaDetail={mockSchemaDetail}
      />
    );

    expect(screen.queryByText('StatusBadgeV2')).toBeInTheDocument();
  });

  it('should render not render Constraint Column when not table entity', () => {
    (useRequiredParams as jest.Mock).mockReturnValue({
      entityType: 'topic',
    });

    render(<ContractSchemaTable schemaDetail={mockSchemaDetail} />);

    expect(
      screen.queryByText('label.constraint-plural')
    ).not.toBeInTheDocument();
  });
});
