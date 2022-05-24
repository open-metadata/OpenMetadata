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

import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { TeamDetailsProp } from '../../interface/teamsAndUsers.interface';
import TeamDetails from './TeamDetails';

const mockTeams = [
  {
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
  {
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
  },
];

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
  currentTeamUsers: [
    {
      id: '011bdb24-90a7-4a97-ba66-24002adb2b12',
      type: 'user',
      name: 'aaron_johnson0',
      fullyQualifiedName: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      deleted: false,
      href: 'http://localhost:8585/api/v1/users/011bdb24-90a7-4a97-ba66-24002adb2b12',
    },
    {
      id: '2a31e452-2061-4517-af35-0ace16161cde',
      type: 'user',
      name: 'aaron_singh2',
      fullyQualifiedName: 'aaron_singh2',
      displayName: 'Aaron Singh',
      deleted: false,
      href: 'http://localhost:8585/api/v1/users/2a31e452-2061-4517-af35-0ace16161cde',
    },
  ],
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

jest.mock('../common/TabsPane/TabsPane', () => {
  return jest.fn().mockReturnValue(<p>TabsPane.component</p>);
});

describe('TeamDetails component test', () => {
  it('TeamDetails should render properly', async () => {
    render(<TeamDetails {...(mockProps as unknown as TeamDetailsProp)} />);

    const teamContainer = await screen.findByTestId('team-details-container');
    const tab = await screen.findByText('TabsPane.component');
    const description = await screen.findByText('Description.component');
    const header = await screen.findByTestId('header');

    expect(teamContainer).toBeInTheDocument();
    expect(tab).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(
      within(header).getByText(mockProps.currentTeam.displayName)
    ).toBeInTheDocument();
  });
});
