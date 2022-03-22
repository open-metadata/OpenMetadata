/*
 *  Copyright 2021 Collate
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

import {
  findAllByTestId,
  findByTestId,
  queryAllByTestId,
  queryByTestId,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import CustomNode from './CustomNode.component';

const mockTableColumns = [
  {
    name: 'product_id',
    displayName: 'product_id',
    dataType: 'NUMERIC',
    dataTypeDisplay: 'numeric',
    description:
      'Unique identifier for the product. This column is the primary key for this table.',
    fullyQualifiedName: 'bigquery_gcp.shopify.dim_product.product_id',
    constraint: 'PRIMARY_KEY',
    ordinalPosition: 1,
  },
  {
    name: 'shop_id',
    displayName: 'shop_id',
    dataType: 'NUMERIC',
    dataTypeDisplay: 'numeric',
    description:
      'ID of the store. This column is a foreign key reference to the shop_id column in the dim_shop table.',
    fullyQualifiedName: 'bigquery_gcp.shopify.dim_product.shop_id',
    ordinalPosition: 2,
  },
  {
    name: 'title',
    displayName: 'title',
    dataType: 'VARCHAR',
    dataLength: 100,
    dataTypeDisplay: 'varchar',
    description: 'Name of the product.',
    fullyQualifiedName: 'bigquery_gcp.shopify.dim_product.title',
    ordinalPosition: 3,
  },
  {
    name: 'vendor',
    displayName: 'vendor',
    dataType: 'VARCHAR',
    dataLength: 100,
    dataTypeDisplay: 'varchar',
    description:
      'Name of the manufacturer, wholesaler, or other vendor of the product.',
    fullyQualifiedName: 'bigquery_gcp.shopify.dim_product.vendor',
    ordinalPosition: 4,
  },
  {
    name: 'created_at',
    displayName: 'created_at',
    dataType: 'TIMESTAMP',
    dataTypeDisplay: 'timestamp',
    description:
      'Date (ISO 8601) and time (UTC) when the product was added to the store. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
    fullyQualifiedName: 'bigquery_gcp.shopify.dim_product.created_at',
    ordinalPosition: 5,
  },
  {
    name: 'deleted_at',
    displayName: 'deleted_at',
    dataType: 'TIMESTAMP',
    dataTypeDisplay: 'timestamp',
    description:
      'Date (ISO 8601) and time (UTC) when the product was deleted. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
    fullyQualifiedName: 'bigquery_gcp.shopify.dim_product.deleted_at',
    ordinalPosition: 6,
  },
];

const mockCustomNodeProp = {
  type: 'default',
  isConnectable: false,
  data: {
    label: <p>label</p>,
    columns: mockTableColumns,
    isNewNode: undefined,
  },
};

jest.mock('../../utils/TableUtils', () => ({
  getConstraintIcon: jest.fn(),
}));

jest.mock('react-flow-renderer', () => ({
  Handle: jest.fn().mockReturnValue(<span>Handle</span>),
  Position: {
    Left: 'left',
    Top: 'top',
    Right: 'right',
    Bottom: 'bottom',
  },
}));

describe('Test CustomNode Component', () => {
  it('Check if CustomNode has all child elements', async () => {
    const { container } = render(<CustomNode {...mockCustomNodeProp} />, {
      wrapper: MemoryRouter,
    });

    const nodeLabel = await findByTestId(container, 'node-label');
    const labelSeparator = await findByTestId(container, 'label-separator');
    const tableColumns = await findAllByTestId(container, 'column');

    expect(nodeLabel).toBeInTheDocument();
    expect(labelSeparator).toBeInTheDocument();
    expect(tableColumns).toHaveLength(mockTableColumns.length);
  });

  it('Check if CustomNode has data columns as undefined', async () => {
    const { container } = render(
      <CustomNode
        {...mockCustomNodeProp}
        data={{ ...mockCustomNodeProp.data, columns: undefined }}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const nodeLabel = await findByTestId(container, 'node-label');
    const labelSeparator = queryByTestId(container, 'label-separator');
    const tableColumns = queryAllByTestId(container, 'column');

    expect(nodeLabel).toBeInTheDocument();
    expect(labelSeparator).not.toBeInTheDocument();
    expect(tableColumns).toHaveLength(0);
  });
});
