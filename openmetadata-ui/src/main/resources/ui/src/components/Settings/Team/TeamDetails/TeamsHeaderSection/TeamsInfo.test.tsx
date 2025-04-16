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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TeamType } from '../../../../../generated/entity/teams/team';
import { useAuth } from '../../../../../hooks/authHooks';
import { ENTITY_PERMISSIONS } from '../../../../../mocks/Permissions.mock';
import TeamsInfo from './TeamsInfo.component';

const mockTeam = {
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
};

jest.mock('../../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockImplementation(() => <div>OwnerLabel</div>),
}));

jest.mock('../../../../common/DomainLabel/DomainLabel.component', () => ({
  DomainLabel: jest.fn().mockImplementation(() => <div>DomainLabel</div>),
}));

jest.mock('./TeamsSubscription.component', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <div>TeamsSubscription</div>),
}));

jest.mock('../../../../common/TeamTypeSelect/TeamTypeSelect.component', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <div>TeamTypeSelect</div>),
}));

jest.mock('../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: { id: 'test-user' },
  }),
}));

const mockEntityPermissions = { ...ENTITY_PERMISSIONS };

const mockUpdateTeamHandler = jest.fn();
const teamProps = {
  parentTeams: [],
  isGroupType: false,
  childTeamsCount: 0,
  currentTeam: mockTeam,
  entityPermissions: mockEntityPermissions,
  isTeamDeleted: false,
  updateTeamHandler: mockUpdateTeamHandler,
};

describe('TeamsInfo', () => {
  it('should render TeamsInfo', async () => {
    await act(async () => {
      render(<TeamsInfo {...teamProps} />);
    });
    const domainLabel = screen.getByText('DomainLabel');
    const userCount = screen.getByTestId('team-user-count');

    expect(domainLabel).toBeInTheDocument();
    expect(userCount).toContainHTML('1');
  });

  it('should handle edit team email', () => {
    const { getByTestId } = render(<TeamsInfo {...teamProps} />);
    const editButton = getByTestId('edit-email');
    fireEvent.click(editButton);
    const teamEmailInput = getByTestId('email-input');

    expect(teamEmailInput).toBeInTheDocument();
  });

  it('should handle save team email', async () => {
    const { getByTestId } = render(<TeamsInfo {...teamProps} />);
    const editButton = getByTestId('edit-email');
    fireEvent.click(editButton);
    const saveButton = getByTestId('save-edit-email');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockUpdateTeamHandler).toHaveBeenCalled();
  });

  it('should handle cancel team email edit', async () => {
    const { getByTestId } = render(<TeamsInfo {...teamProps} />);
    const editButton = getByTestId('edit-email');
    fireEvent.click(editButton);
    const cancelButton = getByTestId('cancel-edit-email');
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(screen.queryByTestId('email-input')).not.toBeInTheDocument();
  });

  it('should not render edit button if team type is organization', () => {
    const { queryByTestId } = render(<TeamsInfo {...teamProps} />);

    expect(queryByTestId('edit-team-type-icon')).not.toBeInTheDocument();
  });

  it('should not render edit button if team type is group & isGroupType is true', () => {
    const { queryByTestId } = render(
      <TeamsInfo
        {...teamProps}
        isGroupType
        currentTeam={{ ...mockTeam, teamType: TeamType.Group }}
      />
    );

    expect(queryByTestId('edit-team-type-icon')).not.toBeInTheDocument();
  });

  it('should render edit button if team type is not group and organization', () => {
    const { queryByTestId } = render(
      <TeamsInfo
        {...teamProps}
        currentTeam={{ ...mockTeam, teamType: TeamType.BusinessUnit }}
      />
    );

    expect(queryByTestId('edit-team-type-icon')).toBeInTheDocument();
  });

  it('should not show edit button if user does not have permission', () => {
    (useAuth as jest.Mock).mockReturnValue({ isAdminUser: false });

    mockEntityPermissions.EditAll = false;
    const { queryByTestId } = render(<TeamsInfo {...teamProps} />);
    const ownerLabel = queryByTestId('edit-email');

    expect(ownerLabel).not.toBeInTheDocument();
  });
});
