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
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OperationPermission } from '../../../../../context/PermissionProvider/PermissionProvider.interface';
import { Team } from '../../../../../generated/entity/teams/team';
import { MOCK_MARKETING_TEAM } from '../../../../../mocks/Teams.mock';
import { getUsers } from '../../../../../rest/userAPI';
import { UserTab } from './UserTab.component';
import { UserTabProps } from './UserTab.interface';

const mockOnRemoveUser = jest.fn().mockResolvedValue('removed');

const props: UserTabProps = {
  permission: {
    EditAll: true,
  } as OperationPermission,
  currentTeam: MOCK_MARKETING_TEAM as Team,
  onAddUser: jest.fn(),
  onRemoveUser: mockOnRemoveUser,
};
jest.mock('../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>);
});
jest.mock('../../../../common/NextPrevious/NextPrevious', () => {
  return jest.fn().mockImplementation(() => <div>NextPrevious</div>);
});
jest.mock('../../../../common/SearchBarComponent/SearchBar.component', () => {
  return jest.fn().mockImplementation(() => <div>Searchbar</div>);
});
jest.mock(
  '../../../../common/EntityPageInfos/ManageButton/ManageButton',
  () => {
    return jest.fn().mockImplementation(() => <div>ManageButton</div>);
  }
);
jest.mock(
  '../../../../common/UserSelectableList/UserSelectableList.component',
  () => ({
    UserSelectableList: jest
      .fn()
      .mockImplementation(({ children }) => (
        <div data-testid="user-selectable-list">{children}</div>
      )),
  })
);

jest.mock('../../../../../utils/Users.util', () => ({
  commonUserDetailColumns: jest.fn().mockImplementation(() => [
    { title: 'label.users', dataIndex: 'users' },
    {
      title: 'label.team-plural',
      dataIndex: 'teams',
      key: 'teams',
    },
  ]),
}));

jest.mock('../../../../../rest/userAPI', () => ({
  getUsers: jest.fn().mockResolvedValue({
    data: [{ id: 'test', name: 'testing' }],
    paging: { total: 10 },
  }),
}));

describe('UserTab', () => {
  it('Component should render', async () => {
    render(
      <BrowserRouter>
        <UserTab {...props} />
      </BrowserRouter>
    );

    expect(getUsers).toHaveBeenCalledWith({
      fields: 'roles',
      limit: 15,
      team: 'Marketing',
    });
    expect(
      await screen.findByTestId('user-selectable-list')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('add-new-user')).toBeInTheDocument();
    expect(await screen.findByText('Searchbar')).toBeInTheDocument();
    expect(await screen.findByText('ManageButton')).toBeInTheDocument();
  });

  it('Error placeholder should visible if there is no data', async () => {
    (getUsers as jest.Mock).mockRejectedValueOnce({
      data: [],
      paging: { total: 0 },
    });
    render(
      <BrowserRouter>
        <UserTab {...props} />
      </BrowserRouter>
    );

    expect(await screen.findByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('Loader should visible if data is loading', async () => {
    render(
      <BrowserRouter>
        <UserTab {...props} />
      </BrowserRouter>
    );

    expect(screen.getByText('label.users')).toBeInTheDocument();
    expect(screen.queryByText('label.team-plural')).not.toBeInTheDocument();
    expect(
      await screen.findByTestId('user-selectable-list')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('add-new-user')).toBeInTheDocument();
    expect(await screen.findByText('Searchbar')).toBeInTheDocument();
  });

  it('Pagination should visible if total value is greater then 25', async () => {
    (getUsers as jest.Mock).mockResolvedValueOnce({
      data: [{ id: 'test', name: 'testing' }],
      paging: { total: 30 },
    });
    render(
      <BrowserRouter>
        <UserTab {...props} />
      </BrowserRouter>
    );

    expect(await screen.findByText('NextPrevious')).toBeInTheDocument();
  });
});
