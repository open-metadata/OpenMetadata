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
import { noop } from 'lodash';
import { OwnerType } from '../../../enums/user.enum';
import { getTeamByName } from '../../../rest/teamsAPI';
import { getUserByName } from '../../../rest/userAPI';
import { renderWithQueryClient } from '../../../test/unit/test-utils';
import { PopoverContent } from './PopoverContent.component';

const mockUserData = {
  name: 'testUser',
  displayName: 'Test User',
  teams: [{ id: '1', name: 'Team 1', deleted: false }],
  roles: [{ id: '1', name: 'Role 1' }],
  isAdmin: true,
};

const mockUpdateUserProfilePics = jest.fn();
const mockStoreState = {
  userProfilePics: { testUser: mockUserData },
  updateUserProfilePics: mockUpdateUserProfilePics,
};

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
  getTeamByName: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../utils/UserDataUtils', () => ({
  getUserWithImage: jest.fn().mockImplementation((user) => user),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.displayName || entity?.name || ''),
}));

jest.mock('../Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <p>Loader</p>);
});

describe('PopoverContent Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loader while loading', () => {
    (getUserByName as jest.Mock).mockImplementationOnce(
      () => new Promise(noop)
    );

    renderWithQueryClient(
      <PopoverContent type={OwnerType.USER} userName="testUser" />
    );

    expect(screen.getByText('Loader')).toBeInTheDocument();
  });

  it('should show no data message when user data is empty', async () => {
    (getUserByName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({})
    );

    renderWithQueryClient(
      <PopoverContent type={OwnerType.USER} userName="testUser" />
    );

    expect(
      await screen.findByText('message.no-data-available')
    ).toBeInTheDocument();
  });

  it('should fetch additional user details with the expected fields', async () => {
    renderWithQueryClient(
      <PopoverContent type={OwnerType.USER} userName="testUser" />
    );

    await waitFor(() =>
      expect(getUserByName).toHaveBeenCalledWith('testUser', {
        fields: ['teams', 'roles', 'profile'],
      })
    );
  });

  it('should mirror the fetched user into the profile-pic store', async () => {
    renderWithQueryClient(
      <PopoverContent type={OwnerType.USER} userName="testUser" />
    );

    await waitFor(() =>
      expect(mockUpdateUserProfilePics).toHaveBeenCalledWith({
        id: 'testUser',
        user: mockUserData,
      })
    );
  });

  it('should not fetch user details for team type', async () => {
    renderWithQueryClient(
      <PopoverContent type={OwnerType.TEAM} userName="testTeam" />
    );

    await waitFor(() => expect(getTeamByName).toHaveBeenCalled());

    expect(getUserByName).not.toHaveBeenCalled();
  });
});
