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

import { findByTestId, findByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import QueryCard from './QueryCard';

const mockQueryData = {
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
};

jest.mock('../schema-editor/SchemaEditor', () => {
  return jest.fn().mockReturnValue(<p>SchemaEditor</p>);
});

describe('Test QueryCard Component', () => {
  it('Check if QueryCard has all child elements', async () => {
    const { container } = render(<QueryCard query={mockQueryData} />, {
      wrapper: MemoryRouter,
    });
    const queryHeader = await findByTestId(container, 'query-header');
    const query = await findByText(container, /SchemaEditor/i);
    const copyQueryButton = await findByTestId(container, 'copy-query');

    expect(queryHeader).toBeInTheDocument();
    expect(query).toBeInTheDocument();
    expect(copyQueryButton).toBeInTheDocument();
  });
});
