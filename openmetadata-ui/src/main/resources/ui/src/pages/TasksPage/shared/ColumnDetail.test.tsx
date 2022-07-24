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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { Column } from '../../../generated/entity/data/table';
import ColumnDetail from './ColumnDetail';

const mockColumnData = {
  name: 'products',
  dataType: 'ARRAY',
  arrayDataType: 'STRUCT',
  dataLength: 1,
  dataTypeDisplay:
    'array<struct<product_id:character varying(24),price:int,onsale:boolean,tax:int,weight:int,others:int,vendor:character varying(64), stock:int>>',
  description: '**Column for storing product data.**',
  fullyQualifiedName:
    'sample_data.ecommerce_db.shopify.raw_product_catalog.products',
  tags: [
    {
      tagFQN: 'PersonalData.Personal',
      description:
        'Data that can be used to directly or indirectly identify a person.',
      source: 'Tag',
      labelType: 'Manual',
      state: 'Confirmed',
    },
  ],
  constraint: 'NULL',
  ordinalPosition: 2,
} as Column;

jest.mock('../../../components/common/Ellipses/Ellipses', () =>
  jest.fn().mockImplementation(({ children }) => {
    return <p>{children}</p>;
  })
);

describe('Test column detail component', () => {
  it('Should render the component', async () => {
    render(<ColumnDetail column={mockColumnData} />);

    const container = await screen.findByTestId('column-details');

    const columnType = await screen.findByTestId('column-type');

    const columnTags = await screen.findByTestId('column-tags');

    expect(container).toBeInTheDocument();
    expect(columnType).toBeInTheDocument();
    expect(columnTags).toBeInTheDocument();
  });

  it('Should not render the component if column is empty object', async () => {
    render(<ColumnDetail column={{} as Column} />);

    const container = screen.queryByTestId('column-details');

    const columnType = screen.queryByTestId('column-type');

    const columnTags = screen.queryByTestId('column-tags');

    expect(container).not.toBeInTheDocument();
    expect(columnType).not.toBeInTheDocument();
    expect(columnTags).not.toBeInTheDocument();
  });
});
