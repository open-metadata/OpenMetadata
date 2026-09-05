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
  return jest
    .fn()
    .mockImplementation(({ permission }: { permission?: boolean }) => (
      <div data-permission={String(permission)}>ErrorPlaceHolder</div>
    ));
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

  // Task 8 Batch 3: editUserPermission's raw `permission.EditAll || permission.EditUsers` ->
  // can(Operation.EditUsers) (getDerivedPermissionFlags). Documented explicit-deny-wins
  // behavior change (Task 6 Finding 1 / Task 8 Batch 2 precedent): an explicit
  // `EditUsers: false` now wins over a bare `EditAll: true` grant, where the old raw OR
  // granted regardless. The 'Component should render' test above already covers the
  // EditAll-fallback grant case (permission: { EditAll: true }, no EditUsers key) via the
  // remove-user-btn's enabled state.
  describe('editUserPermission (explicit-deny-wins)', () => {
    it('disables the remove-user button when EditUsers is explicitly false, even with EditAll true', async () => {
      render(
        <BrowserRouter>
          <UserTab
            {...props}
            permission={
              { EditAll: true, EditUsers: false } as OperationPermission
            }
          />
        </BrowserRouter>
      );

      expect(await screen.findByTestId('remove-user-btn')).toBeDisabled();
    });

    it('enables the remove-user button via EditAll when EditUsers is not present', async () => {
      render(
        <BrowserRouter>
          <UserTab
            {...props}
            permission={{ EditAll: true } as OperationPermission}
          />
        </BrowserRouter>
      );

      expect(await screen.findByTestId('remove-user-btn')).toBeEnabled();
    });
  });

  // Task 8 Batch 3 review round, Finding 3 (Important): the ASSIGN ErrorPlaceHolder's
  // `permission` prop hard-branches (`if (!permission) return <PermissionErrorPlaceholder />`),
  // replacing the whole assign-users UI (including the Add button, which is separately
  // disabled via its own `disabled={!editUserPermission || isTeamDeleted}`) with a misleading
  // "no access" message. Old code passed raw, ungated `permission.EditAll ||
  // permission.EditUsers` here. Fixed via `ungatedFlags.can(Operation.EditUsers)` instead of
  // the deleted-gated `editUserPermission`.
  describe('ErrorPlaceHolder permission prop (ungated for deleted teams)', () => {
    const GROUP_TEAM = {
      ...MOCK_MARKETING_TEAM,
      teamType: TeamType.Group,
    } as Team;

    it('keeps the assign-users UI reachable for a deleted team when EditAll is true', async () => {
      (getUsers as jest.Mock).mockResolvedValueOnce({
        data: [],
        paging: { total: 0 },
      });

      render(
        <BrowserRouter>
          <UserTab
            {...props}
            currentTeam={{ ...GROUP_TEAM, deleted: true }}
            permission={{ EditAll: true } as OperationPermission}
          />
        </BrowserRouter>
      );

      expect(await screen.findByText('ErrorPlaceHolder')).toHaveAttribute(
        'data-permission',
        'true'
      );
    });

    it('still denies via explicit deny when EditUsers is explicitly false, even with EditAll true', async () => {
      (getUsers as jest.Mock).mockResolvedValueOnce({
        data: [],
        paging: { total: 0 },
      });

      render(
        <BrowserRouter>
          <UserTab
            {...props}
            currentTeam={{ ...GROUP_TEAM, deleted: true }}
            permission={
              { EditAll: true, EditUsers: false } as OperationPermission
            }
          />
        </BrowserRouter>
      );

      expect(await screen.findByText('ErrorPlaceHolder')).toHaveAttribute(
        'data-permission',
        'false'
      );
    });
  });
});
