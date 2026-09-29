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
import { getTeamByName } from '../../../rest/teamsAPI';
import { renderWithQueryClient } from '../../../test/unit/test-utils';
import { TeamPopoverContent } from './TeamPopoverContent.component';

const mockTeamData = {
  id: 'team-id-1',
  name: 'testTeam',
  displayName: 'Test Team',
  description: 'Team description',
  teamType: 'Group',
  userCount: 5,
  parents: [{ id: 'parent-1', name: 'parentTeam', displayName: 'Parent Team' }],
};

jest.mock('../../../rest/teamsAPI', () => ({
  getTeamByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockTeamData)),
}));

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.displayName || entity?.name || ''),
}));

jest.mock('../Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <p>Loader</p>);
});

jest.mock('../RichTextEditor/RichTextEditorPreviewNew', () => {
  return jest.fn().mockImplementation(({ markdown }) => <div>{markdown}</div>);
});

describe('TeamPopoverContent Component', () => {
  it('should render team details after fetch', async () => {
    renderWithQueryClient(<TeamPopoverContent teamName="testTeam" />);

    expect(
      await screen.findByTestId('team-popover-content')
    ).toBeInTheDocument();
    expect(getTeamByName).toHaveBeenCalledWith('testTeam', {
      fields: ['parents', 'userCount'],
    });
    expect(screen.getByText('Team description')).toBeInTheDocument();
    expect(screen.getByTestId('team-type')).toHaveTextContent('Group');
    expect(screen.getByTestId('team-user-count')).toHaveTextContent(
      '5 label.user-plural'
    );
    expect(screen.getByTestId('team-parents')).toBeInTheDocument();
    expect(screen.getByText('Parent Team')).toBeInTheDocument();
  });

  it('should show no data message when team fetch fails', async () => {
    (getTeamByName as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(new Error('not found'))
    );

    renderWithQueryClient(<TeamPopoverContent teamName="missingTeam" />);

    expect(
      await screen.findByText('message.no-data-available')
    ).toBeInTheDocument();
  });

  it('should use singular user label when team has one user', async () => {
    (getTeamByName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ ...mockTeamData, userCount: 1 })
    );

    renderWithQueryClient(<TeamPopoverContent teamName="singleUserTeam" />);

    expect(await screen.findByTestId('team-user-count')).toHaveTextContent(
      '1 label.user'
    );
  });

  it('should show no description placeholder when description is empty', async () => {
    (getTeamByName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ ...mockTeamData, description: undefined })
    );

    renderWithQueryClient(<TeamPopoverContent teamName="noDescriptionTeam" />);

    expect(await screen.findByText('label.no-description')).toBeInTheDocument();
  });
});
