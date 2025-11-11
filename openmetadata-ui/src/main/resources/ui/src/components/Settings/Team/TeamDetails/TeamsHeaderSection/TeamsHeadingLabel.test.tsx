/*
 *  Copyright 2024 Collate.
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
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamType } from '../../../../../generated/entity/teams/team';
import { useAuth } from '../../../../../hooks/authHooks';
import { ENTITY_PERMISSIONS } from '../../../../../mocks/Permissions.mock';
import TeamsHeadingLabel from './TeamsHeadingLabel.component';

jest.mock('../../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: { userId: 'test-user' },
  }),
}));
const mockUpdateTeamHandler = jest.fn();

const teamProps = {
  currentTeam: {
    changeDescription: {},
    children: [],
    childrenCount: 0,
    defaultRoles: [],
    deleted: false,
    description: 'Test team description',
    displayName: 'Test Team',
    domain: { id: 'test-domain', type: 'domain' },
    email: 'test-team@test.com',
    fullyQualifiedName: 'test-team',
    href: '/test-team',
    id: 'test-team',
    inheritedRoles: [],
    isJoinable: true,
    name: 'test-team',
    owner: { id: 'test-user', type: 'user' },
    owns: [],
    parents: [],
    policies: [],
    profile: {},
    teamType: TeamType.Organization,
    updatedAt: Date.now(),
    updatedBy: 'test-user',
    userCount: 1,
    users: [{ id: 'test-user', type: 'user' }],
    version: 1,
  },
  updateTeamHandler: mockUpdateTeamHandler,
  entityPermissions: ENTITY_PERMISSIONS,
};

describe('TeamsHeadingLabel', () => {
  it('should render Teams Heading Label', async () => {
    await act(async () => {
      render(<TeamsHeadingLabel {...teamProps} />);
    });
    const teamHeading = screen.getByTestId('team-heading');

    expect(teamHeading).toHaveTextContent('Test Team');
  });

  it('should handle edit team name', () => {
    const { getByTestId } = render(<TeamsHeadingLabel {...teamProps} />);
    const editButton = getByTestId('edit-team-name');
    fireEvent.click(editButton);
    const teamNameInput = getByTestId('team-name-input');

    expect(teamNameInput).toBeInTheDocument();
  });

  it('should handle save team name', async () => {
    render(<TeamsHeadingLabel {...teamProps} />);

    const editButton = screen.getByTestId('edit-team-name');
    fireEvent.click(editButton);

    const saveButton = screen.getByTestId('saveAssociatedTag');
    await waitFor(async () => {
      await userEvent.click(saveButton);

      expect(mockUpdateTeamHandler).toHaveBeenCalled();
    });
  });

  it('should handle cancel team name edit', async () => {
    const { getByTestId, queryByTestId } = render(
      <TeamsHeadingLabel {...teamProps} />
    );
    const editButton = getByTestId('edit-team-name');
    fireEvent.click(editButton);

    const cancelButton = getByTestId('cancelAssociatedTag');
    await waitFor(async () => {
      await userEvent.click(cancelButton);

      expect(queryByTestId('team-name-input')).not.toBeInTheDocument();
    });
  });

  it('should not allow editing team name if user does not have permission', () => {
    (useAuth as jest.Mock).mockReturnValue({ isAdminUser: false });
    const { queryByTestId } = render(<TeamsHeadingLabel {...teamProps} />);
    const editButton = queryByTestId('edit-team-name');

    expect(editButton).not.toBeInTheDocument();
  });
});
