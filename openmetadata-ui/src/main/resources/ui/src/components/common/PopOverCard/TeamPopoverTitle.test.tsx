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

import { screen } from '@testing-library/react';
import { renderWithQueryClient } from '../../../test/unit/test-utils';
import { TeamPopoverTitle } from './TeamPopoverTitle.component';

const mockTeamData = {
  id: 'team-id-1',
  name: 'testTeam',
  displayName: 'Test Team',
};

const mockPush = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockPush),
}));

jest.mock('../../../rest/teamsAPI', () => ({
  getTeamByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockTeamData)),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.displayName || entity?.name || ''),
}));

describe('TeamPopoverTitle Component', () => {
  it('should render team display name and navigate to team page on click', async () => {
    mockPush.mockClear();

    renderWithQueryClient(
      <TeamPopoverTitle
        profilePicture={<div>ProfilePicture</div>}
        teamName="testTeam"
      />
    );

    expect(await screen.findByText('Test Team')).toBeInTheDocument();

    screen.getByTestId('team-name').click();

    expect(mockPush).toHaveBeenCalledWith('/settings/members/teams/testTeam');
  });

  it('should fall back to team name before data loads', () => {
    renderWithQueryClient(
      <TeamPopoverTitle
        profilePicture={<div>ProfilePicture</div>}
        teamName="fallbackTeam"
      />
    );

    expect(screen.getByTestId('team-name')).toHaveTextContent('fallbackTeam');
  });
});
