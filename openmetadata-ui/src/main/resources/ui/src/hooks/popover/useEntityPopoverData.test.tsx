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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { OwnerType } from '../../enums/user.enum';
import { getTeamByName } from '../../rest/teamsAPI';
import { getUserByName } from '../../rest/userAPI';
import { useEntityPopoverData } from './useEntityPopoverData';

const mockUser = { name: 'testUser', displayName: 'Test User', teams: [] };
const mockTeam = { name: 'testTeam', displayName: 'Test Team', userCount: 3 };
const mockUpdateUserProfilePics = jest.fn();
const mockStoreState = {
  userProfilePics: {},
  updateUserProfilePics: mockUpdateUserProfilePics,
};

jest.mock('../../rest/userAPI', () => ({
  getUserByName: jest.fn().mockImplementation(() => Promise.resolve(mockUser)),
}));

jest.mock('../../rest/teamsAPI', () => ({
  getTeamByName: jest.fn().mockImplementation(() => Promise.resolve(mockTeam)),
}));

jest.mock('../../utils/UserDataUtils', () => ({
  getUserWithImage: jest.fn().mockImplementation((user) => user),
}));

jest.mock('../useApplicationStore', () => ({
  useApplicationStore: jest
    .fn()
    .mockImplementation((selector) =>
      selector ? selector(mockStoreState) : mockStoreState
    ),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useEntityPopoverData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch team details with team fields for team type', async () => {
    const { result } = renderHook(
      () => useEntityPopoverData('testTeam', OwnerType.TEAM),
      { wrapper }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getTeamByName).toHaveBeenCalledWith('testTeam', {
      fields: ['parents', 'userCount'],
    });
    expect(getUserByName).not.toHaveBeenCalled();
    expect(result.current.data).toEqual(mockTeam);
    expect(mockUpdateUserProfilePics).not.toHaveBeenCalled();
  });

  it('should fetch user details and mirror to the store for user type', async () => {
    const { result } = renderHook(
      () => useEntityPopoverData('testUser', OwnerType.USER),
      { wrapper }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getUserByName).toHaveBeenCalledWith('testUser', {
      fields: ['teams', 'roles', 'profile'],
    });
    expect(getTeamByName).not.toHaveBeenCalled();
    expect(result.current.data).toEqual(mockUser);
    expect(mockUpdateUserProfilePics).toHaveBeenCalledWith({
      id: 'testUser',
      user: mockUser,
    });
  });

  it('should not fetch when name is empty', async () => {
    const { result } = renderHook(
      () => useEntityPopoverData('', OwnerType.USER),
      { wrapper }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getUserByName).not.toHaveBeenCalled();
    expect(getTeamByName).not.toHaveBeenCalled();
  });
});
