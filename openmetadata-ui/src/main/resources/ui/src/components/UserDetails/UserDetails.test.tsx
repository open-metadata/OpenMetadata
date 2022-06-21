/*
 *  Copyright 2022 Collate
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
import { User } from '../../generated/entity/teams/user';
import { Paging } from '../../generated/type/paging';
import UserDetails, { UserDetailsProps } from './UserDetails';

const mockSelectedUserList: User[] = [
  {
    id: 'c46c12e4-9ac1-4e19-ad64-808424202a1a',
    name: 'aaron_johnson1',
    fullyQualifiedName: 'aaron_johnson1',
    displayName: 'Aaron Johnson',
    version: 0.1,
    updatedAt: 1654840577439,
    updatedBy: 'anonymous',
    email: 'aaron_johnson1@gmail.com',
    href: 'http://localhost:8585/api/v1/users/c46c12e4-9ac1-4e19-ad64-808424202a1c',
    isAdmin: false,
    teams: [
      {
        id: 'd9dfc1c5-b911-4a98-8e37-89db193ef9a3',
        type: 'team',
        name: 'Cloud_Infra',
        fullyQualifiedName: 'Cloud_Infra',
        description: 'This is Cloud_Infra description.',
        displayName: 'Cloud_Infra',
        deleted: false,
        href: 'http://localhost:8585/api/v1/teams/d9dfc1c5-b911-4a98-8e37-89db193ef9a3',
      },
      {
        id: '36fa08ff-ce50-4f74-986d-27878dc642b3',
        type: 'team',
        name: 'Finance',
        fullyQualifiedName: 'Finance',
        description: 'This is Finance description.',
        displayName: 'Finance',
        deleted: false,
        href: 'http://localhost:8585/api/v1/teams/36fa08ff-ce50-4f74-986d-27878dc642b3',
      },
    ],
    deleted: false,
    roles: [],
    inheritedRoles: [
      {
        id: '99f67d8c-b3cd-4e5f-9230-1e6b39074e4d',
        type: 'role',
        name: 'DataConsumer',
        fullyQualifiedName: 'DataConsumer',
        description:
          'Users with Data Consumer role use different data assets for their day to day work.',
        displayName: 'Data Consumer',
        deleted: false,
        href: 'http://localhost:8585/api/v1/roles/99f67d8c-b3cd-4e5f-9230-1e6b39074e4d',
      },
    ],
  },
  {
    id: 'c46c12e4-9ac1-4e19-ad64-808424202a1b',
    name: 'aaron_johnson2',
    fullyQualifiedName: 'aaron_johnson2',
    displayName: 'Aaron Johnson',
    version: 0.1,
    updatedAt: 1654840577439,
    updatedBy: 'anonymous',
    email: 'aaron_johnson2@gmail.com',
    href: 'http://localhost:8585/api/v1/users/c46c12e4-9ac1-4e19-ad64-808424202a1c',
    isAdmin: false,
    teams: [
      {
        id: 'd9dfc1c5-b911-4a98-8e37-89db193ef9a3',
        type: 'team',
        name: 'Cloud_Infra',
        fullyQualifiedName: 'Cloud_Infra',
        description: 'This is Cloud_Infra description.',
        displayName: 'Cloud_Infra',
        deleted: false,
        href: 'http://localhost:8585/api/v1/teams/d9dfc1c5-b911-4a98-8e37-89db193ef9a3',
      },
    ],
    deleted: false,
    roles: [],
    inheritedRoles: [
      {
        id: '99f67d8c-b3cd-4e5f-9230-1e6b39074e4d',
        type: 'role',
        name: 'DataConsumer',
        fullyQualifiedName: 'DataConsumer',
        description:
          'Users with Data Consumer role use different data assets for their day to day work.',
        displayName: 'Data Consumer',
        deleted: false,
        href: 'http://localhost:8585/api/v1/roles/99f67d8c-b3cd-4e5f-9230-1e6b39074e4d',
      },
    ],
  },
  {
    id: 'c46c12e4-9ac1-4e19-ad64-808424202a1c',
    name: 'aaron_johnson3',
    fullyQualifiedName: 'aaron_johnson3',
    displayName: 'Aaron Johnson3',
    version: 0.1,
    updatedAt: 1654840577439,
    updatedBy: 'anonymous',
    email: 'aaron_johnson3@gmail.com',
    href: 'http://localhost:8585/api/v1/users/c46c12e4-9ac1-4e19-ad64-808424202a1c',
    isAdmin: false,
    teams: [
      {
        id: 'd9dfc1c5-b911-4a98-8e37-89db193ef9a3',
        type: 'team',
        name: 'Cloud_Infra',
        fullyQualifiedName: 'Cloud_Infra',
        description: 'This is Cloud_Infra description.',
        displayName: 'Cloud_Infra',
        deleted: false,
        href: 'http://localhost:8585/api/v1/teams/d9dfc1c5-b911-4a98-8e37-89db193ef9a3',
      },
    ],
    deleted: false,
    roles: [],
    inheritedRoles: [
      {
        id: '99f67d8c-b3cd-4e5f-9230-1e6b39074e4d',
        type: 'role',
        name: 'DataConsumer',
        fullyQualifiedName: 'DataConsumer',
        description:
          'Users with Data Consumer role use different data assets for their day to day work.',
        displayName: 'Data Consumer',
        deleted: false,
        href: 'http://localhost:8585/api/v1/roles/99f67d8c-b3cd-4e5f-9230-1e6b39074e4d',
      },
    ],
  },
];

const mockUserPaging: Paging = {
  after: 'YW1hbmRhX3lvcms4',
  total: 101,
};

const mockProps: UserDetailsProps = {
  selectedUserList: mockSelectedUserList,
  handleUserSearchTerm: jest.fn(),
  userSearchTerm: '',
  isUsersLoading: false,
  currentUserPage: 1,
  userPaging: mockUserPaging,
  userPagingHandler: jest.fn(),
  handleDeleteUser: jest.fn(),
};

jest.mock('react-router-dom', () => ({
  useHistory: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('../common/error-with-placeholder/ErrorPlaceHolder', () => {
  return jest.fn().mockReturnValue(<p>ErrorPlaceHolder</p>);
});

jest.mock('../common/next-previous/NextPrevious', () => {
  return jest.fn().mockReturnValue(<p>NextPrevious</p>);
});

jest.mock('../common/popover/PopOver', () => {
  return jest.fn().mockReturnValue(<p>PopOver</p>);
});

jest.mock('../common/searchbar/Searchbar', () => {
  return jest.fn().mockReturnValue(<p>Searchbar</p>);
});

jest.mock('../Loader/Loader', () => {
  return jest.fn().mockReturnValue(<p>Loader</p>);
});

jest.mock('../Modals/ConfirmationModal/ConfirmationModal', () => {
  return jest.fn().mockReturnValue(<p>ConfirmationModal</p>);
});

jest.mock('../UserDataCard/UserDataCard', () => {
  return jest.fn().mockImplementation(({ onClick, onDelete }) => (
    <>
      <p>UserDataCard</p>
      <p onClick={() => onClick(mockSelectedUserList[1].name)}>
        handleUserRedirection
      </p>
      <p
        onClick={() =>
          onDelete(
            mockSelectedUserList[1].id,
            mockSelectedUserList[1].displayName
          )
        }>
        handleDeleteUserModal
      </p>
    </>
  ));
});

describe('Test UserDetails component', () => {
  it('Checking if loader is diplaying properly while loading the user list', () => {
    const { getByText } = render(<UserDetails {...mockProps} isUsersLoading />);

    const loader = getByText('Loader');

    expect(loader).toBeInTheDocument();
  });

  it('Checking if all the components are rendering properly after getting list of users', () => {
    const { getByText, getAllByText } = render(<UserDetails {...mockProps} />);

    const searchBar = getByText('Searchbar');
    const userDataCard = getAllByText('UserDataCard');
    const nextPrevious = getByText('NextPrevious');
    const handleUserRedirection = getAllByText('handleUserRedirection');

    expect(searchBar).toBeInTheDocument();
    expect(userDataCard.length).toBe(3);
    expect(nextPrevious).toBeInTheDocument();

    act(() => {
      fireEvent.click(handleUserRedirection[0]);
    });
  });

  it('Checking if conformationModal is showing after delete button clicked', () => {
    const { getAllByText, queryByText } = render(
      <UserDetails {...mockProps} />
    );

    const userDataCard = getAllByText('UserDataCard');
    const handleDeleteUserModal = getAllByText('handleDeleteUserModal');

    expect(userDataCard.length).toBe(3);

    expect(queryByText('ConfirmationModal')).toBeNull();

    act(() => {
      fireEvent.click(handleDeleteUserModal[0]);
    });

    expect(queryByText('ConfirmationModal')).toBeInTheDocument();
  });

  it('Checking if Error is displayed when no users present', () => {
    const { getByText } = render(
      <UserDetails {...mockProps} selectedUserList={[]} />
    );

    const errorPlaceHolder = getByText('ErrorPlaceHolder');

    expect(errorPlaceHolder).toBeInTheDocument();
  });
});
