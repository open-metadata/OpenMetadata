/*
 *  Copyright 2023 Collate.
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

import { cleanup, render, screen } from '@testing-library/react';
import { MOCK_USER_DATA } from 'pages/UserListPage/mockUserData';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react-test-renderer';
import UserListV1 from './UserListV1';

jest.mock('rest/userAPI', () => ({
  updateUser: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../generated/api/teams/createUser', () => ({
  CreateUser: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../common/DeleteWidget/DeleteWidgetModal', () => {
  return jest.fn().mockImplementation(() => <div>DeleteWidgetModal</div>);
});

jest.mock('../common/error-with-placeholder/ErrorPlaceHolder', () => {
  return jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>);
});

jest.mock('../common/next-previous/NextPrevious', () => {
  return jest.fn().mockImplementation(() => <div>NextPrevious</div>);
});

jest.mock('../header/PageHeader.component', () => {
  return jest.fn().mockImplementation(() => <div>PageHeader</div>);
});

jest.mock('../Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader</div>);
});

jest.mock('../common/searchbar/Searchbar', () => {
  return jest
    .fn()
    .mockImplementation((prop) => (
      <input
        data-testid="search-input"
        type="text"
        onChange={(e) => prop.onSearch(e.target.value)}
      />
    ));
});

const mockFunction = jest.fn();

const MOCK_PROPS_DATA = {
  data: MOCK_USER_DATA.data,
  paging: MOCK_USER_DATA.paging,
  searchTerm: '',
  currentPage: 1,
  isDataLoading: false,
  showDeletedUser: false,
  onSearch: mockFunction,
  onShowDeletedUserChange: mockFunction,
  onPagingChange: mockFunction,
  afterDeleteAction: mockFunction,
  isAdminPage: false,
};

describe('Test UserListV1 component', () => {
  beforeEach(() => {
    cleanup();
  });

  it('Should render component', async () => {
    await act(async () => {
      render(<UserListV1 {...MOCK_PROPS_DATA} />, {
        wrapper: MemoryRouter,
      });
    });

    const userListComponent = await screen.findByTestId(
      'user-list-v1-component'
    );
    const pageHeader = await screen.findByText('PageHeader');

    expect(userListComponent).toBeInTheDocument();
    expect(pageHeader).toBeInTheDocument();
  });

  it('Should render ErrorPlaceHolder', async () => {
    await act(async () => {
      render(<UserListV1 {...MOCK_PROPS_DATA} data={[]} />, {
        wrapper: MemoryRouter,
      });
    });

    const emptyComponent = await screen.findByText('ErrorPlaceHolder');

    expect(emptyComponent).toBeInTheDocument();
  });

  it('Should render Users table', async () => {
    await act(async () => {
      render(<UserListV1 {...MOCK_PROPS_DATA} />, {
        wrapper: MemoryRouter,
      });
    });

    const userListComponent = await screen.findByTestId(
      'user-list-v1-component'
    );

    expect(userListComponent).toBeInTheDocument();

    const table = await screen.findByTestId('user-list-table');

    expect(table).toBeInTheDocument();

    const userName = await screen.findByText('label.username');
    const teams = await screen.findByText('label.team-plural');
    const role = await screen.findByText('label.role-plural');

    expect(userName).toBeInTheDocument();
    expect(teams).toBeInTheDocument();
    expect(role).toBeInTheDocument();

    const rows = await screen.findAllByRole('row');

    expect(rows).toHaveLength(MOCK_PROPS_DATA.data.length + 1);
  });

  it('Should not render data when bot is search', async () => {
    await act(async () => {
      render(<UserListV1 {...MOCK_PROPS_DATA} data={[]} searchTerm="bot" />, {
        wrapper: MemoryRouter,
      });
    });

    const userListComponent = await screen.findByTestId(
      'user-list-v1-component'
    );

    expect(userListComponent).toBeInTheDocument();

    const table = await screen.findByTestId('user-list-table');

    const noDataTable = await screen.findByText('No data');

    expect(table).toBeInTheDocument();
    expect(noDataTable).toBeInTheDocument();
  });
});
