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

import {
  findAllByText,
  findByTestId,
  render,
  screen,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getQueriesList } from 'rest/queryAPI';
import { MOCK_QUERIES, MOCK_QUERIES_ES_DATA } from '../../mocks/Queries.mock';
import TableQueries from './TableQueries';
import { TableQueriesProp } from './TableQueries.interface';

const mockTableQueriesProp: TableQueriesProp = {
  tableId: 'id',
};

jest.mock('./QueryCard', () => {
  return jest.fn().mockReturnValue(<p>QueryCard</p>);
});
jest.mock('components/common/next-previous/NextPrevious', () => {
  return jest.fn().mockImplementation(() => <div>NextPrevious.component</div>);
});
jest.mock('./TableQueryRightPanel/TableQueryRightPanel.component', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>TableQueryRightPanel.component</div>);
});
jest.mock('rest/queryAPI', () => ({
  ...jest.requireActual('rest/queryAPI'),
  getQueriesList: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ data: MOCK_QUERIES, paging: { total: 2 } })
    ),
}));
jest.mock('components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermission: jest.fn(),
    permissions: {
      query: {
        Create: true,
      },
    },
  })),
}));
jest.mock('rest/miscAPI', () => ({
  getSearchedUsers: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [] })),
}));

describe('Test TableQueries Component', () => {
  it('Check if TableQueries component has all child elements', async () => {
    render(<TableQueries {...mockTableQueriesProp} />, {
      wrapper: MemoryRouter,
    });
    const queriesContainer = await screen.findByTestId('queries-container');
    const rightPanel = await screen.findByText(
      'TableQueryRightPanel.component'
    );
    const addQueryBtn = await screen.findByTestId('add-query-btn');

    expect(queriesContainer).toBeInTheDocument();
    expect(rightPanel).toBeInTheDocument();
    expect(addQueryBtn).toBeInTheDocument();
  });

  it('All the query should render', async () => {
    const queriesLength = MOCK_QUERIES_ES_DATA?.length || 0;
    const { container } = render(<TableQueries {...mockTableQueriesProp} />, {
      wrapper: MemoryRouter,
    });
    const queriesContainer = await findByTestId(container, 'queries-container');
    const queryCards = await findAllByText(queriesContainer, /QueryCard/i);

    expect(queriesContainer).toBeInTheDocument();
    expect(queryCards).toHaveLength(queriesLength);
  });

  it('Error placeholder should display if there is no data', async () => {
    (getQueriesList as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: [],
        paging: { total: 0 },
      })
    );
    render(<TableQueries {...mockTableQueriesProp} />, {
      wrapper: MemoryRouter,
    });
    const queryCards = screen.queryAllByText('QueryCard');
    const noDataPlaceholder = await screen.findByTestId('no-queries');

    expect(queryCards).toHaveLength(0);
    expect(noDataPlaceholder).toBeInTheDocument();
  });

  it('If paging count is more than 10, pagination should be visible', async () => {
    (getQueriesList as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: MOCK_QUERIES,
        paging: { total: 11 },
      })
    );
    render(<TableQueries {...mockTableQueriesProp} />, {
      wrapper: MemoryRouter,
    });
    const pagingComponent = await screen.findByText('NextPrevious.component');

    expect(pagingComponent).toBeInTheDocument();
  });
});
