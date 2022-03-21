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
  findAllByText,
  findByTestId,
  queryAllByText,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import TableQueries from './TableQueries';

const mockQueriesData = [
  {
    query: 'select products from raw_product_catalog',
    duration: 0.309,
    user: {
      id: 'd4785e53-bbdb-4dbd-b368-009fdb50c2c6',
      type: 'user',
      name: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      href: 'http://localhost:8585/api/v1/users/d4785e53-bbdb-4dbd-b368-009fdb50c2c6',
    },
    vote: 1,
    checksum: '0232b0368458aadb29230ccc531462c9',
  },
  {
    query: 'select platform from raw_product_catalog',
    duration: 0.278,
    user: {
      id: 'e3a25263-2998-4c2c-9c94-ac278dbf5423',
      type: 'user',
      name: 'adam_matthews2',
      displayName: 'Adam Matthews',
      href: 'http://localhost:8585/api/v1/users/e3a25263-2998-4c2c-9c94-ac278dbf5423',
    },
    vote: 1,
    checksum: 'c54eb291adfb4a26a9816c83ba025711',
  },
  {
    query: 'select store_address from raw_product_catalog',
    duration: 0.333,
    user: {
      id: 'c61ce751-b11d-43c1-917a-5a2530d5ba3f',
      type: 'user',
      name: 'aaron_warren5',
      displayName: 'Aaron Warren',
      href: 'http://localhost:8585/api/v1/users/c61ce751-b11d-43c1-917a-5a2530d5ba3f',
    },
    vote: 1,
    checksum: 'e4aa67aec0fc9727b45d2d4e0fbaeef6',
  },
  {
    query: 'select last_order_date from raw_product_catalog',
    duration: 0.381,
    user: {
      id: 'c61ce751-b11d-43c1-917a-5a2530d5ba3f',
      type: 'user',
      name: 'aaron_warren5',
      displayName: 'Aaron Warren',
      href: 'http://localhost:8585/api/v1/users/c61ce751-b11d-43c1-917a-5a2530d5ba3f',
    },
    vote: 1,
    checksum: 'de2d10bb7f14cb3f679984dbfa986af2',
  },
  {
    query: 'select first_order_date from raw_product_catalog',
    duration: 0.125,
    user: {
      id: 'e3a25263-2998-4c2c-9c94-ac278dbf5423',
      type: 'user',
      name: 'adam_matthews2',
      displayName: 'Adam Matthews',
      href: 'http://localhost:8585/api/v1/users/e3a25263-2998-4c2c-9c94-ac278dbf5423',
    },
    vote: 1,
    checksum: '74faee70cbae02b5b412e8258a3aa1a4',
  },
  {
    query: 'select comments from raw_product_catalog',
    duration: 0.845,
    user: {
      id: '66d521c8-837b-49fe-bfc1-1178bbae2e83',
      type: 'user',
      name: 'aaron_singh2',
      displayName: 'Aaron Singh',
      href: 'http://localhost:8585/api/v1/users/66d521c8-837b-49fe-bfc1-1178bbae2e83',
    },
    vote: 1,
    checksum: '741f958a2762170708f29f96d1639601',
  },
];

const mockTableQueriesProp = {
  queries: mockQueriesData,
};

jest.mock('./QueryCard', () => {
  return jest.fn().mockReturnValue(<p>QueryCard</p>);
});

describe('Test TableQueries Component', () => {
  it('Check if TableQueries component has all child elements', async () => {
    const { container } = render(<TableQueries {...mockTableQueriesProp} />, {
      wrapper: MemoryRouter,
    });
    const queriesContainer = await findByTestId(container, 'queries-container');

    expect(queriesContainer).toBeInTheDocument();
  });

  it('Check if TableQueries component has n query card', async () => {
    const queriesLength = mockQueriesData.length;
    const { container } = render(<TableQueries {...mockTableQueriesProp} />, {
      wrapper: MemoryRouter,
    });
    const queriesContainer = await findByTestId(container, 'queries-container');
    const queryCards = await findAllByText(queriesContainer, /QueryCard/i);

    expect(queriesContainer).toBeInTheDocument();
    expect(queryCards).toHaveLength(queriesLength);
  });

  it('Check if TableQueries component has queries as undefined', async () => {
    const { container } = render(
      <TableQueries {...mockTableQueriesProp} queries={undefined} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const queryCards = queryAllByText(container, /QueryCard/i);
    const noQueries = await findByTestId(container, 'no-queries');

    expect(queryCards).toHaveLength(0);
    expect(noQueries).toBeInTheDocument();
  });

  it('Check if TableQueries component has queries as empty list', async () => {
    const { container } = render(
      <TableQueries {...mockTableQueriesProp} queries={[]} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const queryCards = queryAllByText(container, /QueryCard/i);
    const noQueries = await findByTestId(container, 'no-queries');

    expect(queryCards).toHaveLength(0);
    expect(noQueries).toBeInTheDocument();
  });
});
