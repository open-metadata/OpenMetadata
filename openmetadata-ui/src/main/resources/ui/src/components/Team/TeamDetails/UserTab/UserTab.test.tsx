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
import {
  act,
  findByText,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { OperationPermission } from '../../../../components/PermissionProvider/PermissionProvider.interface';
import { pagingObject } from '../../../../constants/constants';
import { Team } from '../../../../generated/entity/teams/team';
import { User } from '../../../../generated/entity/teams/user';
import { MOCK_MARKETING_TEAM } from '../../../../mocks/Teams.mock';
import { UserTab } from './UserTab.component';
import { UserTabProps } from './UserTab.interface';

const props: UserTabProps = {
  users: MOCK_MARKETING_TEAM.users as User[],
  searchText: '',
  isLoading: 0,
  permission: {
    EditAll: true,
  } as OperationPermission,
  currentTeam: MOCK_MARKETING_TEAM as Team,
  onSearchUsers: jest.fn(),
  onAddUser: jest.fn(),
  paging: pagingObject,
  onChangePaging: jest.fn(),
  currentPage: 1,
  onRemoveUser: jest.fn().mockResolvedValue('removed'),
};
jest.mock(
  '../../../../components/common/error-with-placeholder/ErrorPlaceHolder',
  () => {
    return jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>);
  }
);
jest.mock('../../../../components/common/next-previous/NextPrevious', () => {
  return jest.fn().mockImplementation(() => <div>NextPrevious</div>);
});
jest.mock('../../../../components/common/searchbar/Searchbar', () => {
  return jest.fn().mockImplementation(() => <div>Searchbar</div>);
});
jest.mock('../../../../components/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader</div>);
});
jest.mock(
  '../../../../components/common/entityPageInfo/ManageButton/ManageButton',
  () => {
    return jest.fn().mockImplementation(() => <div>ManageButton</div>);
  }
);
jest.mock(
  '../../../../components/common/UserSelectableList/UserSelectableList.component',
  () => ({
    UserSelectableList: jest
      .fn()
      .mockImplementation(({ children }) => (
        <div data-testid="user-selectable-list">{children}</div>
      )),
  })
);

describe('UserTab', () => {
  it('Component should render', async () => {
    render(
      <BrowserRouter>
        <UserTab {...props} />
      </BrowserRouter>
    );

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(
      await screen.findByTestId('user-selectable-list')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('add-new-user')).toBeInTheDocument();
    expect(await screen.findByText('Searchbar')).toBeInTheDocument();
    expect(await screen.findByText('ManageButton')).toBeInTheDocument();
  });

  it('Error placeholder should visible if there is no data', async () => {
    render(
      <BrowserRouter>
        <UserTab {...props} users={[]} />
      </BrowserRouter>
    );

    expect(await screen.findByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('Loader should visible if data is loading', async () => {
    render(
      <BrowserRouter>
        <UserTab {...props} isLoading={1} />
      </BrowserRouter>
    );

    expect(await screen.findByTestId('skeleton-table')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeInTheDocument();
    expect(
      await screen.findByTestId('user-selectable-list')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('add-new-user')).toBeInTheDocument();
    expect(await screen.findByText('Searchbar')).toBeInTheDocument();
  });

  it('Pagination should visible if total value is greater then 25', async () => {
    render(
      <BrowserRouter>
        <UserTab {...props} paging={{ total: 26 }} />
      </BrowserRouter>
    );

    expect(await screen.findByText('NextPrevious')).toBeInTheDocument();
  });

  it('Remove user flow', async () => {
    render(
      <BrowserRouter>
        <UserTab {...props} />
      </BrowserRouter>
    );
    const removeBtn = await screen.findByTestId('remove-user-btn');

    expect(removeBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(removeBtn);
    });
    const confirmationModal = await screen.findByTestId('confirmation-modal');
    const confirmBtn = await findByText(confirmationModal, 'label.confirm');

    expect(confirmationModal).toBeInTheDocument();
    expect(confirmBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(props.onRemoveUser).toHaveBeenCalledWith(props.users[0].id);
  });
});
