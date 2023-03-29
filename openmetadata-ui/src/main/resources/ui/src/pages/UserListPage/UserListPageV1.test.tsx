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
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitForDomChange,
  waitForElement,
} from '@testing-library/react';
import React from 'react';
import { searchData } from 'rest/miscAPI';
import { getUsers } from 'rest/userAPI';
import { GlobalSettingOptions } from '../../constants/GlobalSettings.constants';
import { MOCK_USER_DATA } from './mockUserData';
import UserListPageV1 from './UserListPageV1';

const mockParam = {
  tab: GlobalSettingOptions.USERS,
};

const mockHistory = {
  replace: jest.fn(),
};

const mockLocation = {
  pathname: 'pathname',
  search: '',
};

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => mockParam),
  useHistory: jest.fn().mockImplementation(() => mockHistory),
  useLocation: jest.fn().mockImplementation(() => mockLocation),
}));
jest.mock('rest/userAPI', () => ({
  getUsers: jest.fn().mockImplementation(() =>
    Promise.resolve({
      MOCK_USER_DATA,
    })
  ),
}));
jest.mock('rest/miscAPI', () => ({
  searchData: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: MOCK_USER_DATA,
    })
  ),
}));

jest.mock('components/UserList/UserListV1', () => {
  return jest.fn().mockImplementation((prop) => (
    <div>
      <p>UserList.component</p>
      <button onClick={prop.afterDeleteAction}>afterDeleteAction</button>
      <button onClick={() => prop.onPagingChange('next', 2)}>
        onPagingChange
      </button>
      <input
        data-testid="search-input"
        type="text"
        onChange={(e) => prop.onSearch(e.target.value)}
      />
      <input
        data-testid="show-deleted-toggle"
        type="checkbox"
        onChange={(e) => prop.onShowDeletedUserChange(e.target.checked)}
      />
    </div>
  ));
});
jest.mock('components/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader.component</div>);
});

describe('Test UserListPage component', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render without crashing', async () => {
    render(<UserListPageV1 />);

    const userlist = await screen.findByText('UserList.component');

    expect(userlist).toBeInTheDocument();
  });

  it('getUsers API should not call if its not user/admin page', async () => {
    mockParam.tab = GlobalSettingOptions.WEBHOOK;
    const userAPI = getUsers as jest.Mock;

    render(<UserListPageV1 />);

    const userlist = await screen.findByText('UserList.component');

    expect(userlist).toBeInTheDocument();
    expect(userAPI).not.toHaveBeenCalled();
  });

  it('Component should render without crashing, even if getUsers api send empty response', async () => {
    (getUsers as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: '' })
    );
    render(<UserListPageV1 />);

    const userlist = await screen.findByText('UserList.component');

    expect(userlist).toBeInTheDocument();
  });

  it('handleFetch function should work properly', async () => {
    const userAPI = getUsers as jest.Mock;
    render(<UserListPageV1 />);
    const afterDeleteAction = await screen.findByText('afterDeleteAction');
    const userlist = await screen.findByText('UserList.component');

    expect(afterDeleteAction).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(afterDeleteAction);
    });

    expect(userAPI).toHaveBeenCalled();
    expect(userlist).toBeInTheDocument();
  });

  it('handleSearch function should work properly', async () => {
    const userAPI = getUsers as jest.Mock;
    const searchAPI = searchData as jest.Mock;
    render(<UserListPageV1 />);
    const searchBox = await screen.findByTestId('search-input');
    const userlist = await screen.findByText('UserList.component');

    expect(searchBox).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(searchBox, { target: { value: 'test' } });
    });

    expect(searchAPI.mock.calls[0]).toEqual([
      'test',
      1,
      15,
      'isBot:false',
      '',
      '',
      'user_search_index',
      false,
    ]);

    await waitForElement(async () => {
      const userSearchTerm = new URLSearchParams(window.location.search).get(
        'user'
      );

      return userSearchTerm === 'test';
    });

    expect(searchBox).toHaveValue('test');
    expect(searchAPI).toHaveBeenCalled();

    await act(async () => {
      fireEvent.change(searchBox, { target: { value: '' } });
    });

    waitForDomChange();

    expect(searchBox).toHaveValue('');
    expect(userAPI).toHaveBeenCalled();
    expect(userlist).toBeInTheDocument();
  });

  it('handleSearch function should work properly for Admin', async () => {
    mockParam.tab = GlobalSettingOptions.ADMINS;
    const searchAPI = searchData as jest.Mock;

    render(<UserListPageV1 />);

    const searchBox = await screen.findByTestId('search-input');

    expect(searchBox).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(searchBox, { target: { value: 'test' } });
    });

    expect(searchAPI.mock.calls[0]).toEqual([
      'test',
      1,
      15,
      'isAdmin:true isBot:false',
      '',
      '',
      'user_search_index',
      false,
    ]);

    await waitForElement(async () => {
      const userSearchTerm = new URLSearchParams(window.location.search).get(
        'user'
      );

      return userSearchTerm === 'test';
    });

    expect(searchBox).toHaveValue('test');
    expect(searchAPI).toHaveBeenCalled();
  });

  it('handleShowDeletedUserChange function should work properly', async () => {
    const userAPI = getUsers as jest.Mock;
    render(<UserListPageV1 />);
    const toggle = await screen.findByTestId('show-deleted-toggle');
    const userlist = await screen.findByText('UserList.component');

    expect(toggle).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(toggle).toBeChecked();
    expect(userAPI).toHaveBeenCalled();
    expect(userlist).toBeInTheDocument();
  });

  it('handlePagingChange function should work properly', async () => {
    render(<UserListPageV1 />);

    const userlist = await screen.findByText('UserList.component');
    const paging = await screen.findByText('onPagingChange');

    expect(paging).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(paging);
    });

    expect(getUsers).toHaveBeenCalled();
    expect(userlist).toBeInTheDocument();
  });
});
