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

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { useAuth } from '../../../../hooks/authHooks';
import { USER_DATA, USER_TEAMS } from '../../../../mocks/User.mock';
import UserProfileTeams from './UserProfileTeams.component';
import { UserProfileTeamsProps } from './UserProfileTeams.interface';

const mockPropsData: UserProfileTeamsProps = {
  teams: [],
  updateUserDetails: jest.fn(),
};

jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../../../utils/CommonUtils', () => ({
  getNonDeletedTeams: jest.fn(),
}));

jest.mock('../../../../components/InlineEdit/InlineEdit.component', () => {
  return jest.fn().mockReturnValue(<p>InlineEdit</p>);
});

jest.mock('../../../common/Chip/Chip.component', () => {
  return jest.fn().mockReturnValue(<p>Chip</p>);
});

jest.mock('../../../../components/TeamsSelectable/TeamsSelectable', () => {
  return jest.fn().mockReturnValue(<p>TeamsSelectable</p>);
});

describe('Test User Profile Teams Component', () => {
  it('should render user profile teams component', async () => {
    render(<UserProfileTeams {...mockPropsData} />);

    expect(screen.getByTestId('user-team-card-container')).toBeInTheDocument();
  });

  it('should render teams if data available', async () => {
    render(<UserProfileTeams {...mockPropsData} teams={USER_DATA.teams} />);

    expect(screen.getByTestId('user-team-card-container')).toBeInTheDocument();

    expect(screen.getByTestId('edit-teams-button')).toBeInTheDocument();

    expect(await screen.findAllByText('Chip')).toHaveLength(1);
  });

  it('should render teams select input  on edit click', async () => {
    render(<UserProfileTeams {...mockPropsData} teams={USER_DATA.teams} />);

    expect(screen.getByTestId('user-team-card-container')).toBeInTheDocument();

    const editButton = screen.getByTestId('edit-teams-button');

    expect(editButton).toBeInTheDocument();

    fireEvent.click(editButton);

    expect(screen.getByText('InlineEdit')).toBeInTheDocument();
  });

  it('should not render edit button to non admin user', async () => {
    (useAuth as jest.Mock).mockImplementation(() => ({
      isAdminUser: false,
    }));

    render(<UserProfileTeams {...mockPropsData} teams={USER_TEAMS} />);

    expect(screen.getByTestId('user-team-card-container')).toBeInTheDocument();

    expect(screen.queryByTestId('edit-teams-button')).not.toBeInTheDocument();
  });
});
