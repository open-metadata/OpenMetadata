/*
 *  Copyright 2022 Collate.
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

import { findByTestId, findByText, render } from '@testing-library/react';
import { Query } from 'generated/entity/data/query';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import QueryCard from './QueryCard';
import { QueryCardProp } from './TableQueries.interface';

const mockQueryData = {
  query: `SELECT
order_month,
order_day,
COUNT(DISTINCT order_id) AS num_orders,
COUNT(book_id) AS num_books,
SUM(price) AS total_price,
SUM(COUNT(book_id)) OVER (
  PARTITION BY order_month
  ORDER BY order_day
) AS running_total_num_books,
LAG(COUNT(book_id), 7) OVER (ORDER BY order_day) AS prev_books
FROM (
  SELECT
  DATE_FORMAT(co.order_date, '%Y-%m') AS order_month,
  DATE_FORMAT(co.order_date, '%Y-%m-%d') AS order_day,
  co.order_id,
  ol.book_id,
  ol.price
  FROM cust_order co
  INNER JOIN order_line ol ON co.order_id = ol.order_id
) sub
GROUP BY order_month, order_day
ORDER BY order_day ASC;`,
  duration: 0.309,
  users: [
    {
      id: 'd4785e53-bbdb-4dbd-b368-009fdb50c2c6',
      type: 'user',
      name: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      href: 'http://localhost:8585/api/v1/users/d4785e53-bbdb-4dbd-b368-009fdb50c2c6',
    },
  ],
  checksum: '0232b0368458aadb29230ccc531462c9',
} as Query;

jest.mock('../schema-editor/SchemaEditor', () => {
  return jest.fn().mockReturnValue(<p>SchemaEditor</p>);
});
jest.mock('./QueryCardExtraOption/QueryCardExtraOption.component', () => {
  return jest.fn().mockReturnValue(<>QueryCardExtraOption</>);
});
jest.mock('./QueryUsedByOtherTable/QueryUsedByOtherTable.component', () => {
  return jest.fn().mockReturnValue(<>QueryUsedByOtherTable</>);
});

const mockProps: QueryCardProp = {
  query: mockQueryData,
  tableId: 'id',
  permission: DEFAULT_ENTITY_PERMISSION,
  onQuerySelection: jest.fn(),
  onQueryUpdate: jest.fn(),
  onUpdateVote: jest.fn(),
};

const mockProps: QueryCardProp = {
  query: mockQueryData,
  tableId: 'id',
  permission: DEFAULT_ENTITY_PERMISSION,
  onQuerySelection: jest.fn(),
  onQueryUpdate: jest.fn(),
  onUpdateVote: jest.fn(),
};

describe('Test QueryCard Component', () => {
  it('Check if QueryCard has all child elements', async () => {
    const { container } = render(<QueryCard {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    const query = await findByText(container, /SchemaEditor/i);
    const queryCardExtraOption = await findByText(
      container,
      'QueryCardExtraOption'
    );
    const queryUsedByOtherTable = await findByText(
      container,
      'QueryUsedByOtherTable'
    );

    const expandButton = await findByTestId(
      container,
      'query-entity-expand-button'
    );

    expect(queryUsedByOtherTable).toBeInTheDocument();
    expect(query).toBeInTheDocument();
    expect(queryCardExtraOption).toBeInTheDocument();
    expect(expandButton).toBeInTheDocument();
  });
});
