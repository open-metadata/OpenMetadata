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

import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { act } from 'react-test-renderer';
import { GlobalSettingOptions } from '../../constants/GlobalSettings.constants';
import { getUsers } from '../../rest/userAPI';
import { MOCK_USER_DATA } from './MockUserPageData';
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

jest.mock('../../rest/userAPI', () => ({
  ...jest.requireActual('../../rest/userAPI'),
  getUsers: jest.fn().mockImplementation(() =>
    Promise.resolve({
      ...MOCK_USER_DATA,
    })
  ),
  updateUser: jest.fn(),
}));

jest.mock('../../rest/miscAPI', () => ({
  searchData: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: MOCK_USER_DATA,
    })
  ),
}));

jest.mock('../../components/common/Table/Table', () => {
  return jest.fn().mockImplementation(() => <table>mockTable</table>);
});

jest.mock('../../components/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader.component</div>);
});

describe('Test UserListPage component', () => {
  it('users api should called on initial load', async () => {
    const { findByTestId } = render(<UserListPageV1 />);

    const deletedSwitch = await findByTestId('show-deleted');

    expect(deletedSwitch).toBeInTheDocument();
    expect(deletedSwitch).not.toBeChecked();

    expect(getUsers).toHaveBeenCalled();
  });

  it('should call getUser with deleted flag on clicking showDeleted switch', async () => {
    const { findByTestId } = render(<UserListPageV1 />);

    expect(getUsers).toHaveBeenCalledWith({
      fields: 'profile,teams,roles',
      isAdmin: undefined,
      isBot: false,
      limit: 15,
    });

    const deletedSwitch = await findByTestId('show-deleted');

    expect(deletedSwitch).toBeInTheDocument();

    act(() => {
      fireEvent.click(deletedSwitch);
    });

    expect(getUsers).toHaveBeenCalledWith({
      fields: 'profile,teams,roles',
      include: 'deleted',
      isAdmin: false,
      isBot: false,
      limit: 15,
    });
  });

  it('should render searchbar', async () => {
    const { findByTestId } = render(<UserListPageV1 />);

    expect(getUsers).toHaveBeenCalledWith({
      fields: 'profile,teams,roles',
      isAdmin: undefined,
      isBot: false,
      limit: 15,
    });

    const searchBar = await findByTestId('search-bar-container');

    expect(searchBar).toBeInTheDocument();
  });
});
