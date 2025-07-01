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
import { TypeComputedProps } from '@inovua/reactdatagrid-community/types';
import { act, render, screen } from '@testing-library/react';
import { MutableRefObject } from 'react';
import TableTypePropertyEditTable from './TableTypePropertyEditTable';
import { TableTypePropertyEditTableProps } from './TableTypePropertyEditTable.interface';

const mockDataSource: { value: Record<string, string>[] } = {
  value: [
    {
      name: 'Property 1',
      value: 'Value 1',
      id: '0',
    },
  ],
};

const mockDataGridRefObj: {
  value: MutableRefObject<TypeComputedProps | null>;
} = {
  value: { current: null },
};

const props: TableTypePropertyEditTableProps = {
  columns: ['name', 'value'],
  dataSource: mockDataSource.value,
  gridRef: mockDataGridRefObj.value,
  handleEditGridRef: jest
    .fn()
    .mockImplementation((data: Record<string, string>[]) => {
      mockDataSource.value = data;
    }),
  handleEditDataSource: jest
    .fn()
    .mockImplementation((data: MutableRefObject<TypeComputedProps | null>) => {
      mockDataGridRefObj.value = data;
    }),
};

describe('TableTypePropertyEditTable', () => {
  it('should render the table with given columns and dataSource', async () => {
    await act(async () => {
      render(<TableTypePropertyEditTable {...props} />);
    });

    expect(screen.getByText('Property 1')).toBeInTheDocument();
    expect(screen.getByText('Value 1')).toBeInTheDocument();
  });
});
