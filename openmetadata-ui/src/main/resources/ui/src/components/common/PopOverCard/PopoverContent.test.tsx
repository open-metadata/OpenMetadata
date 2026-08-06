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

import { act, render, screen } from '@testing-library/react';
import { noop } from 'lodash';
import { OwnerType } from '../../../enums/user.enum';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { getUserByName } from '../../../rest/userAPI';
import { PopoverContent } from './PopoverContent.component';

const mockUserData = {
  name: 'testUser',
  displayName: 'Test User',
  teams: [{ id: '1', name: 'Team 1', deleted: false }],
  roles: [{ id: '1', name: 'Role 1' }],
  isAdmin: true,
};

const mockUpdateUserProfilePics = jest.fn();

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    userProfilePics: { testUser: mockUserData },
    updateUserProfilePics: mockUpdateUserProfilePics,
  })),
}));

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: jest
    .fn()
    .mockImplementation(() => [null, null, mockUserData]),
}));

jest.mock('../../../rest/userAPI', () => ({
  getUserByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockUserData)),
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

  it('should show loader while loading', async () => {
    (useUserProfile as jest.Mock).mockImplementation(() => [null, null, {}]);
    (getUserByName as jest.Mock).mockImplementationOnce(
      () => new Promise(noop)
    );

    render(<PopoverContent type={OwnerType.USER} userName="testUser" />);

    expect(screen.getByText('Loader')).toBeInTheDocument();
  });

  it('should show no data message when user data is empty', async () => {
    (useUserProfile as jest.Mock).mockImplementation(() => [null, null, {}]);
    (getUserByName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({})
    );

    await act(async () => {
      render(<PopoverContent type={OwnerType.USER} userName="testUser" />);
    });

    expect(screen.getByText('message.no-data-available')).toBeInTheDocument();
  });

  it('should fetch additional user details when needed', async () => {
    const mockUser = { name: 'testUser', teams: null };
    (useUserProfile as jest.Mock).mockImplementation(() => [
      null,
      null,
      mockUser,
    ]);

    await act(async () => {
      render(<PopoverContent type={OwnerType.USER} userName="testUser" />);
    });

    expect(getUserByName).toHaveBeenCalledWith('testUser', {
      fields: ['teams', 'roles', 'profile'],
    });
  });

  it('should not fetch additional details for team type', async () => {
    await act(async () => {
      render(<PopoverContent type={OwnerType.TEAM} userName="testUser" />);
    });

    expect(getUserByName).not.toHaveBeenCalled();
  });
});
