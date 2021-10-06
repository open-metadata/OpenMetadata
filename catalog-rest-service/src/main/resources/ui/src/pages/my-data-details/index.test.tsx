/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { getAllByTestId, getByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import MyDataDetailsPage from './index';

const mockUserTeam = [
  {
    description: 'description',
    displayName: 'displayName',
    href: 'href',
    id: 'id',
    name: 'name',
    type: 'type',
  },
  {
    description: 'description',
    displayName: 'displayName',
    href: 'href',
    id: 'id',
    name: 'name',
    type: 'type',
  },
];

jest.mock('../../components/my-data-details/ManageTab', () => {
  return jest.fn().mockReturnValue(<p>ManageTab</p>);
});

jest.mock('../../components/common/description/Description', () => {
  return jest.fn().mockReturnValue(<p>Description</p>);
});

jest.mock('../../components/my-data-details/SchemaTab', () => {
  return jest.fn().mockReturnValue(<p>SchemaTab</p>);
});

jest.mock('../../utils/CommonUtils', () => ({
  addToRecentViewed: jest.fn(),
  getCurrentUserId: jest.fn().mockReturnValue('CurrentUserId'),
  getPartialNameFromFQN: jest.fn().mockReturnValue('PartialNameFromFQN'),
  // getTableFQNFromColumnFQN: jest.fn().mockReturnValue('TableFQNFromColumnFQN'),
  getUserTeams: () => mockUserTeam,
}));

describe('Test MyDataDetailsPage page', () => {
  // Rewrite this test as component has actual data from api and api is not mocked here
  it('Checks if the page has all the proper components rendered', () => {
    const { container } = render(<MyDataDetailsPage />, {
      wrapper: MemoryRouter,
    });
    const followButton = getByTestId(container, 'follow-button');
    const relatedTables = getByTestId(container, 'related-tables-container');
    const tabs = getAllByTestId(container, 'tab');

    expect(followButton).toBeInTheDocument();
    expect(relatedTables).toBeInTheDocument();
    // we only have 2 for now => schema and manage
    expect(tabs.length).toBe(3);
  });
});
