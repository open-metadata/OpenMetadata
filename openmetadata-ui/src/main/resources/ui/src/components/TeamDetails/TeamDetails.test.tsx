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
import { TeamDetailsProp } from '../../interface/teamsAndUsers.interface';
import TeamDetails from './TeamDetails';
import { mockTeams, MOCK_USER } from './TeamDetails.mock';

const mockProps = {
  currentTeam: {
    id: '8754b53f-15cd-4d9a-af52-bdb3a2abff61',
    name: 'Cloud_Infra',
    fullyQualifiedName: 'Cloud_Infra',
    displayName: 'Cloud_Infra',
    description: 'This is Cloud_Infra description.',
    version: 0.3,
    updatedAt: 1653388025589,
    updatedBy: 'anonymous',
    href: 'http://localhost:8585/api/v1/teams/8754b53f-15cd-4d9a-af52-bdb3a2abff61',
    users: [],
  },
  teams: mockTeams,
  currentTeamUsers: MOCK_USER,
  teamUserPagin: { total: 0 },
  currentTeamUserPage: 0,
  teamUsersSearchText: '',
  isDescriptionEditable: false,
  isTeamMemberLoading: false,
  hasAccess: false,
  errorNewTeamData: undefined,
  isAddingTeam: false,
  handleAddTeam: jest.fn(),
  onNewTeamDataChange: jest.fn(),
  descriptionHandler: jest.fn(),
  onDescriptionUpdate: jest.fn(),
  handleTeamUsersSearchAction: jest.fn(),
  updateTeamHandler: jest.fn(),
  createNewTeam: jest.fn(),
  teamUserPaginHandler: jest.fn(),
  handleAddUser: jest.fn(),
  afterDeleteAction: jest.fn(),
  removeUserFromTeam: jest.fn(),
  handleJoinTeamClick: jest.fn(),
  handleLeaveTeamClick: jest.fn(),
};

jest.mock('../common/non-admin-action/NonAdminAction', () => {
  return jest
    .fn()
    .mockImplementation(({ children }) => (
      <p data-testid="no-admin">{children}</p>
    ));
});

jest.mock('../../pages/teams/UserCard', () => {
  return jest.fn().mockReturnValue(<p>UserCardComponent</p>);
});

jest.mock('../common/description/Description', () => {
  return jest.fn().mockReturnValue(<p>Description.component</p>);
});

jest.mock('../Modals/FormModal', () => {
  return jest.fn().mockReturnValue(<p>FormModal.component</p>);
});

jest.mock('./Form', () => {
  return jest.fn().mockReturnValue(<p>Form.component</p>);
});

jest.mock('../Modals/ConfirmationModal/ConfirmationModal', () => {
  return jest.fn().mockReturnValue(<p>ConfirmationModal.component</p>);
});

jest.mock('../ManageTab/ManageTab.component', () => {
  return jest.fn().mockReturnValue(<p>ManageTab.component</p>);
});

const mockTabHandler = jest.fn().mockImplementation((fn, value) => fn(value));

jest.mock('../common/TabsPane/TabsPane', () => {
  return jest.fn().mockImplementation(({ setActiveTab }) => (
    <div>
      <p>TabsPane.component</p>
      <button
        data-testid="assets-btn"
        onClick={() => mockTabHandler(setActiveTab, 2)}>
        assets
      </button>
      <button
        data-testid="roles-btn"
        onClick={() => mockTabHandler(setActiveTab, 3)}>
        roles
      </button>
    </div>
  ));
});

jest.mock('../../AppState', () => {
  const mockUser = {
    id: '011bdb24-90a7-4a97-ba66-24002adb2b12',
    type: 'user',
    name: 'aaron_johnson0',
    fullyQualifiedName: 'aaron_johnson0',
    displayName: 'Aaron Johnson',
    deleted: false,
    href: 'http://localhost:8585/api/v1/users/011bdb24-90a7-4a97-ba66-24002adb2b12',
    teams: [{ id: '8754b53f-15cd-4d9a-af52-bdb3a2abffss' }],
  };

  return {
    getCurrentUserDetails: jest.fn().mockReturnValue(mockUser),
    userDetails: undefined,
    nonSecureUserDetails: mockUser,
  };
});

jest.mock('../../hooks/authHooks', () => {
  return {
    useAuth: jest
      .fn()
      .mockReturnValue({ userPermissions: jest.fn().mockReturnValue(true) }),
  };
});

jest.mock('../../utils/CommonUtils', () => {
  return {
    hasEditAccess: jest.fn().mockReturnValue(true),
  };
});

describe('TeamDetails component test', () => {
  it('TeamDetails should render properly', async () => {
    render(<TeamDetails {...(mockProps as unknown as TeamDetailsProp)} />);

    const teamContainer = await screen.findByTestId('team-details-container');
    const tab = await screen.findByText('TabsPane.component');
    const description = await screen.findByText('Description.component');
    const teamHeading = await screen.findByTestId('team-heading');

    expect(teamContainer).toBeInTheDocument();
    expect(tab).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(teamHeading).toBeInTheDocument();
  });

  it('Join team should be visible if user is not part of selected team', async () => {
    render(
      <TeamDetails {...(mockProps as unknown as TeamDetailsProp)} hasAccess />
    );

    const teamContainer = await screen.findByTestId('team-details-container');
    const joinTeam = await screen.findByTestId('join-teams');

    expect(teamContainer).toBeInTheDocument();
    expect(joinTeam).toBeInTheDocument();
  });

  it('Leave team should be visible if user is part of selected team', async () => {
    render(
      <TeamDetails
        {...(mockProps as unknown as TeamDetailsProp)}
        hasAccess
        currentTeam={{
          id: '8754b53f-15cd-4d9a-af52-bdb3a2abffss',
          name: 'Customer_Support',
          fullyQualifiedName: 'Customer_Support',
          displayName: 'Customer_Support',
          description: 'This is Customer_Support description.',
          version: 0.3,
          updatedAt: 1653388025589,
          updatedBy: 'anonymous',
          href: 'test',
          users: [],
        }}
      />
    );

    const teamContainer = await screen.findByTestId('team-details-container');
    const leaveTeam = await screen.findByTestId('leave-team-button');

    expect(teamContainer).toBeInTheDocument();
    expect(leaveTeam).toBeInTheDocument();
  });

  it('Assets tab should work properly', async () => {
    render(<TeamDetails {...(mockProps as unknown as TeamDetailsProp)} />, {
      wrapper: MemoryRouter,
    });

    const teamContainer = await screen.findByTestId('team-details-container');
    const assets = await screen.findByTestId('assets-btn');

    expect(teamContainer).toBeInTheDocument();
    expect(assets).toBeInTheDocument();

    fireEvent.click(assets);

    expect(mockTabHandler).toBeCalledTimes(1);
  });

  it('Roles tab should work properly', async () => {
    render(<TeamDetails {...(mockProps as unknown as TeamDetailsProp)} />, {
      wrapper: MemoryRouter,
    });

    const teamContainer = await screen.findByTestId('team-details-container');
    const assets = await screen.findByTestId('assets-btn');

    expect(teamContainer).toBeInTheDocument();
    expect(assets).toBeInTheDocument();

    fireEvent.click(assets);

    expect(mockTabHandler).toBeCalledTimes(1);
  });
});
