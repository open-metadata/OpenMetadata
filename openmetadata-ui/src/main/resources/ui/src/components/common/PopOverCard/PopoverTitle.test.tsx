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
import { OwnerType } from '../../../enums/user.enum';
import { User } from '../../../generated/entity/teams/user';
import { PopoverTitle } from './PopoverTitle.component';

const mockUserData = {
  name: 'testUser',
  displayName: 'Test User',
} as User;

const mockPush = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockPush),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.displayName || entity?.name || ''),
}));

describe('PopoverTitle Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render user name and display name correctly', () => {
    render(
      <PopoverTitle
        profilePicture={<div>ProfilePicture</div>}
        type={OwnerType.USER}
        user={mockUserData}
        userName="testUser"
      />
    );

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('testUser')).toBeInTheDocument();
  });

  it('should show only userName when displayName is not available', () => {
    render(
      <PopoverTitle
        profilePicture={<div>ProfilePicture</div>}
        type={OwnerType.USER}
        user={{ name: 'testUser' } as User}
        userName="testUser"
      />
    );

    expect(screen.getByTestId('user-name')).toHaveTextContent('testUser');
    expect(screen.queryByText('Test User')).not.toBeInTheDocument();
  });

  it('should fall back to the userName prop when no user data is provided', () => {
    render(
      <PopoverTitle
        profilePicture={<div>ProfilePicture</div>}
        type={OwnerType.USER}
        userName="testUser"
      />
    );

    expect(screen.getByText('testUser')).toBeInTheDocument();
  });

  it('should navigate to team details path when type is TEAM', () => {
    render(
      <PopoverTitle
        profilePicture={<div>ProfilePicture</div>}
        type={OwnerType.TEAM}
        user={{ name: 'testTeam', displayName: 'Test Team' } as User}
        userName="testTeam"
      />
    );

    screen.getByText('Test Team').click();

    expect(mockPush).toHaveBeenCalledWith('/settings/members/teams/testTeam');
    expect(mockPush).not.toHaveBeenCalledWith('/users/testTeam');
  });

  it('should navigate to user profile path when type is USER', () => {
    render(
      <PopoverTitle
        profilePicture={<div>ProfilePicture</div>}
        type={OwnerType.USER}
        user={mockUserData}
        userName="testUser"
      />
    );

    screen.getByText('Test User').click();

    expect(mockPush).toHaveBeenCalledWith('/users/testUser');
  });
});
