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

import { screen, waitFor } from '@testing-library/react';
import { OwnerType } from '../../../enums/user.enum';
import { getTeamByName } from '../../../rest/teamsAPI';
import { getUserByName } from '../../../rest/userAPI';
import { renderWithQueryClient } from '../../../test/unit/test-utils';
import { PopoverTitle } from './PopoverTitle.component';

const mockUserData = {
  name: 'testUser',
  displayName: 'Test User',
};

const mockPush = jest.fn();
const mockUpdateUserProfilePics = jest.fn();
const mockStoreState = {
  userProfilePics: {},
  updateUserProfilePics: mockUpdateUserProfilePics,
};

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockPush),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest
    .fn()
    .mockImplementation((selector) =>
      selector ? selector(mockStoreState) : mockStoreState
    ),
}));

jest.mock('../../../rest/userAPI', () => ({
  getUserByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockUserData)),
}));

jest.mock('../../../rest/teamsAPI', () => ({
  getTeamByName: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ name: 'testTeam', displayName: 'Test Team' })
    ),
}));

jest.mock('../../../utils/UserDataUtils', () => ({
  getUserWithImage: jest.fn().mockImplementation((user) => user),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.displayName || entity?.name || ''),
}));

describe('PopoverTitle Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
  });

  it('should render user name and display name correctly', async () => {
    renderWithQueryClient(
      <PopoverTitle
        profilePicture={<div>ProfilePicture</div>}
        type={OwnerType.USER}
        userName="testUser"
      />
    );

    expect(await screen.findByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('testUser')).toBeInTheDocument();
  });

  it('should navigate using name instead of display name when clicking display name', async () => {
    renderWithQueryClient(
      <PopoverTitle
        profilePicture={<div>ProfilePicture</div>}
        type={OwnerType.USER}
        userName="testUser"
      />
    );

    (await screen.findByText('Test User')).click();

    expect(mockPush).toHaveBeenCalledWith('/users/testUser');
  });

  it('should show only userName when displayName is not available', async () => {
    (getUserByName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ name: 'testUser' })
    );

    renderWithQueryClient(
      <PopoverTitle
        profilePicture={<div>ProfilePicture</div>}
        type={OwnerType.USER}
        userName="testUser"
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('user-name')).toHaveTextContent('testUser')
    );

    expect(screen.queryByText('Test User')).not.toBeInTheDocument();
  });

  it('should navigate to team details path when type is TEAM', async () => {
    renderWithQueryClient(
      <PopoverTitle
        profilePicture={<div>ProfilePicture</div>}
        type={OwnerType.TEAM}
        userName="testTeam"
      />
    );

    (await screen.findByText('Test Team')).click();

    expect(getTeamByName).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/settings/members/teams/testTeam');
    expect(mockPush).not.toHaveBeenCalledWith('/users/testTeam');
  });

  it('should navigate to user profile path when type is USER', async () => {
    renderWithQueryClient(
      <PopoverTitle
        profilePicture={<div>ProfilePicture</div>}
        type={OwnerType.USER}
        userName="testUser"
      />
    );

    (await screen.findByText('Test User')).click();

    expect(mockPush).toHaveBeenCalledWith('/users/testUser');
  });
});
