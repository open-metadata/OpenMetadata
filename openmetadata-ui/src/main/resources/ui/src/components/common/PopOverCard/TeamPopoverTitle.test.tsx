/*
 *  Copyright 2026 Collate.
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
import { Team } from '../../../generated/entity/teams/team';
import { TeamPopoverTitle } from './TeamPopoverTitle.component';

const mockTeamData = {
  id: 'team-id-1',
  name: 'testTeam',
  displayName: 'Test Team',
} as Team;

const mockPush = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockPush),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.displayName || entity?.name || ''),
}));

describe('TeamPopoverTitle Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render team display name and navigate to team page on click', () => {
    render(
      <TeamPopoverTitle
        profilePicture={<div>ProfilePicture</div>}
        team={mockTeamData}
        teamName="testTeam"
      />
    );

    expect(screen.getByText('Test Team')).toBeInTheDocument();

    screen.getByTestId('team-name').click();

    expect(mockPush).toHaveBeenCalledWith('/settings/members/teams/testTeam');
  });

  it('should fall back to team name when no team data is provided', () => {
    render(
      <TeamPopoverTitle
        profilePicture={<div>ProfilePicture</div>}
        teamName="fallbackTeam"
      />
    );

    expect(screen.getByTestId('team-name')).toHaveTextContent('fallbackTeam');
  });
});
