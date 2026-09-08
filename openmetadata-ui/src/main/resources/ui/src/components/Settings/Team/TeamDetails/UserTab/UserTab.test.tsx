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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OperationPermission } from '../../../../../context/PermissionProvider/PermissionProvider.interface';
import { Team, TeamType } from '../../../../../generated/entity/teams/team';
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
  return jest
    .fn()
    .mockImplementation(({ onSearch }: { onSearch?: (t: string) => void }) => (
      <button data-testid="user-searchbar" onClick={() => onSearch?.('ali')}>
        Searchbar
      </button>
    ));
});
jest.mock('../../../../../rest/searchAPI', () => ({
  searchQuery: jest
    .fn()
    .mockResolvedValue({ hits: { hits: [], total: { value: 0 } } }),
}));
jest.mock(
  '../../../../common/EntityPageInfos/ManageButton/ManageButton',
  () => {
    return jest
      .fn()
      .mockImplementation(
        ({ extraDropdownContent }: { extraDropdownContent?: unknown[] }) => (
          <div>
            ManageButton
            {(extraDropdownContent as { key: string }[] | undefined)?.map(
              (item) => (
                <div data-testid={item.key} key={item.key} />
              )
            )}
          </div>
        )
      );
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

  describe('Import/Export permission gating', () => {
    it('should show both export and import options when user has EditAll permission', async () => {
      render(
        <BrowserRouter>
          <UserTab
            {...props}
            permission={{ EditAll: true } as OperationPermission}
          />
        </BrowserRouter>
      );

      expect(await screen.findByTestId('export-button')).toBeInTheDocument();
      expect(screen.getByTestId('import-button')).toBeInTheDocument();
    });

    it('should hide the import option when EditAll permission is missing', async () => {
      render(
        <BrowserRouter>
          <UserTab
            {...props}
            permission={{ EditAll: false } as OperationPermission}
          />
        </BrowserRouter>
      );

      expect(await screen.findByTestId('export-button')).toBeInTheDocument();
      expect(screen.queryByTestId('import-button')).not.toBeInTheDocument();
    });
  });

  describe('Non-Group team behavior', () => {
    const nonGroupTeam = {
      ...MOCK_MARKETING_TEAM,
      teamType: TeamType.Department,
      descendantTeams: [{ id: 'sub-group-1', type: 'team' }],
    } as Team;

    it('should show the export option but hide import and add-user for a non-Group team', async () => {
      render(
        <BrowserRouter>
          <UserTab
            {...props}
            currentTeam={nonGroupTeam}
            permission={{ EditAll: true } as OperationPermission}
          />
        </BrowserRouter>
      );

      // Export lets a non-Group team export the users rolled up from its sub-groups.
      expect(await screen.findByTestId('export-button')).toBeInTheDocument();
      // Adding users (import / add) is only allowed on Group teams.
      expect(screen.queryByTestId('import-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('add-new-user')).not.toBeInTheDocument();
    });

    it('should show the add-user action for a Group team', async () => {
      render(
        <BrowserRouter>
          <UserTab
            {...props}
            currentTeam={
              { ...MOCK_MARKETING_TEAM, teamType: TeamType.Group } as Team
            }
            permission={{ EditAll: true } as OperationPermission}
          />
        </BrowserRouter>
      );

      expect(await screen.findByTestId('add-new-user')).toBeInTheDocument();
      expect(screen.getByTestId('import-button')).toBeInTheDocument();
    });

    it('should scope the users search to the team and its descendant teams', async () => {
      const { searchQuery } = jest.requireMock('../../../../../rest/searchAPI');
      render(
        <BrowserRouter>
          <UserTab {...props} currentTeam={nonGroupTeam} />
        </BrowserRouter>
      );

      fireEvent.click(await screen.findByTestId('user-searchbar'));

      await waitFor(() => expect(searchQuery).toHaveBeenCalled());
      const queryFilter = JSON.stringify(
        searchQuery.mock.calls[0][0].queryFilter
      );

      // The team itself and its descendant team are both in the teams.id filter.
      expect(queryFilter).toContain(nonGroupTeam.id);
      expect(queryFilter).toContain('sub-group-1');
    });
  });
});
