/*
 *  Copyright 2021 Collate
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

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TeamsAndUsersProps } from '../../interface/teamsAndUsers.interface';
import TeamsAndUsers from './TeamsAndUsers.component';
import { MOCK_SELECTED_TEAM } from './TeamsAndUsers.mock';

const mockProps: TeamsAndUsersProps = {
  hasAccess: false,
  isUsersLoading: false,
  isTeamMemberLoading: false,
  isTeamVisible: false,
  activeUserTab: undefined,
  activeUserTabHandler: jest.fn(),
  users: [],
  admins: [],
  selectedUserList: [],
  bots: [],
  teams: [],
  currentTeam: MOCK_SELECTED_TEAM,
  currentTeamUsers: [],
  teamUserPagin: { total: 0 },
  currentTeamUserPage: 0,
  teamUsersSearchText: '',
  isDescriptionEditable: false,
  isRightPannelLoading: false,
  errorNewTeamData: undefined,
  isAddingTeam: false,
  createNewTeam: jest.fn(),
  handleAddTeam: jest.fn(),
  onNewTeamDataChange: jest.fn(),
  updateTeamHandler: jest.fn(),
  handleDeleteUser: jest.fn(),
  handleTeamUsersSearchAction: jest.fn(),
  teamUserPaginHandler: jest.fn(),
  changeCurrentTeam: jest.fn(),
  descriptionHandler: jest.fn(),
  onDescriptionUpdate: jest.fn(),
  handleJoinTeamClick: jest.fn(),
  handleLeaveTeamClick: jest.fn(),
  isAddingUsers: false,
  getUniqueUserList: jest.fn(),
  addUsersToTeam: jest.fn(),
  handleAddUser: jest.fn(),
  removeUserFromTeam: jest.fn(),
  handleUserSearchTerm: jest.fn(),
  userSearchTerm: '',
  handleAddNewUser: jest.fn(),
  afterDeleteAction: jest.fn(),
};

jest.mock(
  '../containers/PageLayout',
  () =>
    ({
      children,
      leftPanel,
    }: {
      children: React.ReactNode;
      leftPanel: React.ReactNode;
    }) =>
      (
        <div data-testid="PageLayout">
          <div data-testid="left-panel-content">{leftPanel}</div>
          {children}
        </div>
      )
);

jest.mock('../common/non-admin-action/NonAdminAction', () => {
  return jest
    .fn()
    .mockImplementation(({ children }) => (
      <p data-testid="non-admin-action">{children}</p>
    ));
});

jest.mock('../UserDetails/UserDetails', () => {
  return jest.fn().mockReturnValue(<div>UserDetails.component</div>);
});

jest.mock('../TeamDetails/TeamDetails', () => {
  return jest.fn().mockReturnValue(<div>TeamDetails.component</div>);
});

jest.mock('../../pages/teams/AddUsersModal', () => {
  return jest.fn().mockReturnValue(<div>AddUsersModal.component</div>);
});

jest.mock('../Loader/Loader', () => {
  return jest.fn().mockReturnValue(<div>Loader.component</div>);
});

describe('TeamsAndUsers component test', () => {
  it('TeamsAndUsers component should render properly', async () => {
    render(<TeamsAndUsers {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    const PageLayout = await screen.findByTestId('PageLayout');
    const leftPanel = await screen.findByTestId('left-panel-content');

    expect(PageLayout).toBeInTheDocument();
    expect(leftPanel).toBeInTheDocument();
  });

  it('TeamDetails component should be visible', async () => {
    render(<TeamsAndUsers {...mockProps} isTeamVisible />, {
      wrapper: MemoryRouter,
    });

    const PageLayout = await screen.findByTestId('PageLayout');
    const leftPanel = await screen.findByTestId('left-panel-content');
    const teams = await screen.findByText('TeamDetails.component');

    expect(PageLayout).toBeInTheDocument();
    expect(leftPanel).toBeInTheDocument();
    expect(teams).toBeInTheDocument();
  });

  it('addUserModal component should be visible', async () => {
    render(<TeamsAndUsers {...mockProps} isAddingUsers />, {
      wrapper: MemoryRouter,
    });

    const PageLayout = await screen.findByTestId('PageLayout');
    const leftPanel = await screen.findByTestId('left-panel-content');
    const addUser = await screen.findByText('AddUsersModal.component');

    expect(PageLayout).toBeInTheDocument();
    expect(leftPanel).toBeInTheDocument();
    expect(addUser).toBeInTheDocument();
  });

  it('addUserModal component with name should be visible', async () => {
    render(
      <TeamsAndUsers
        {...mockProps}
        isAddingUsers
        currentTeam={{ ...MOCK_SELECTED_TEAM, displayName: undefined }}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const PageLayout = await screen.findByTestId('PageLayout');
    const leftPanel = await screen.findByTestId('left-panel-content');
    const addUser = await screen.findByText('AddUsersModal.component');

    expect(PageLayout).toBeInTheDocument();
    expect(leftPanel).toBeInTheDocument();
    expect(addUser).toBeInTheDocument();
  });

  it('CTA Should work properly', async () => {
    render(<TeamsAndUsers {...mockProps} hasAccess />, {
      wrapper: MemoryRouter,
    });

    const PageLayout = await screen.findByTestId('PageLayout');
    const leftPanel = await screen.findByTestId('left-panel-content');
    const addTeam = await screen.findByTestId('add-team-button');
    const addUser = await screen.findByTestId('add-user-button');

    fireEvent.click(addTeam);

    expect(PageLayout).toBeInTheDocument();
    expect(leftPanel).toBeInTheDocument();
    expect(addTeam).toBeInTheDocument();
    expect(addUser).toBeInTheDocument();
  });

  it('Loading should be visible if provided true', async () => {
    render(<TeamsAndUsers {...mockProps} isRightPannelLoading />, {
      wrapper: MemoryRouter,
    });

    const PageLayout = await screen.findByTestId('PageLayout');
    const leftPanel = await screen.findByTestId('left-panel-content');
    const addUser = await screen.findByText('Loader.component');

    expect(PageLayout).toBeInTheDocument();
    expect(leftPanel).toBeInTheDocument();
    expect(addUser).toBeInTheDocument();
    expect(screen.queryByText('TeamDetails.component')).not.toBeInTheDocument();
    expect(screen.queryByText('UserDetails.component')).not.toBeInTheDocument();
  });
});
