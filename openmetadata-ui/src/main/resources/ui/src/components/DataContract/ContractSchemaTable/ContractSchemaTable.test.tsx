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
import { Column } from '../../../generated/entity/data/table';
import ContractSchemaTable from './ContractSchemaTabe.component';

// Mock the usePaging hook
jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: () => ({
    currentPage: 1,
    pageSize: 10,
    handlePageChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
    showPagination: true,
    paging: { total: 0 },
    handlePagingChange: jest.fn(),
  }),
}));

// Mock Table component
jest.mock('../../common/Table/Table', () => {
  return function MockTable({ dataSource, customPaginationProps, columns }) {
    return (
      <div data-testid="schema-table">
        <div data-testid="pagination-props">
          {JSON.stringify(customPaginationProps)}
        </div>
        <div data-testid="data-rows">{dataSource?.length || 0} rows</div>
        <div data-testid="columns">{columns?.length || 0} columns</div>
      </div>
    );
  };
});

const mockSchemaDetail: Column[] = [
  {
    name: 'id',
    dataType: 'INTEGER',
    constraint: 'PRIMARY_KEY',
  } as Column,
  {
    name: 'name',
    dataType: 'VARCHAR',
    constraint: 'NOT_NULL',
  } as Column,
  {
    name: 'email',
    dataType: 'VARCHAR',
  } as Column,
];

describe('ContractSchemaTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render schema table with pagination', () => {
    render(<ContractSchemaTable schemaDetail={mockSchemaDetail} />);

    expect(screen.getByTestId('schema-table')).toBeInTheDocument();
    expect(screen.getByTestId('data-rows')).toHaveTextContent('3 rows');
    expect(screen.getByTestId('columns')).toHaveTextContent('3 columns');
  });

  it('should pass pagination props to Table component', () => {
    render(<ContractSchemaTable schemaDetail={mockSchemaDetail} />);

    const paginationProps = screen.getByTestId('pagination-props');
    const props = JSON.parse(paginationProps.textContent || '{}');

    expect(props).toHaveProperty('currentPage', 1);
    expect(props).toHaveProperty('showPagination', true);
    expect(props).toHaveProperty('pageSize', 10);
    expect(props).toHaveProperty('isNumberBased', true);
    expect(props).toHaveProperty('isLoading', false);
    expect(props).toHaveProperty('pagingHandler');
    expect(props).toHaveProperty('onShowSizeChange');
  });

  it('should handle empty schema detail', () => {
    render(<ContractSchemaTable schemaDetail={[]} />);

    expect(screen.getByTestId('schema-table')).toBeInTheDocument();
    expect(screen.getByTestId('data-rows')).toHaveTextContent('0 rows');
  });

  it('should use default page size of 10', () => {
    render(<ContractSchemaTable schemaDetail={mockSchemaDetail} />);

    const paginationProps = screen.getByTestId('pagination-props');
    const props = JSON.parse(paginationProps.textContent || '{}');

    expect(props.pageSize).toBe(10);
  });

  it('should update paging total based on schema detail length', () => {
    render(<ContractSchemaTable schemaDetail={mockSchemaDetail} />);

    const paginationProps = screen.getByTestId('pagination-props');
    const props = JSON.parse(paginationProps.textContent || '{}');

    expect(props.paging.total).toBe(mockSchemaDetail.length);
  });
});
