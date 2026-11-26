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
import { renderHook } from '@testing-library/react-hooks';
import { User } from '../../generated/entity/teams/user';
import { getUserByName } from '../../rest/userAPI';
import { useApplicationStore } from '../useApplicationStore';
import { useUserLabel } from './useUserLabel';
import { useUserProfile } from './useUserProfile';

jest.mock('../../rest/userAPI', () => ({
  getUserByName: jest.fn(),
}));

const mockGetUserByName = getUserByName as jest.MockedFunction<
  typeof getUserByName
>;

describe('useUserLabel', () => {
  beforeEach(() => {
    useApplicationStore.setState({ userProfilePics: {} });
    mockGetUserByName.mockReset();
  });

  it('shows the display name once the user loads', async () => {
    mockGetUserByName.mockResolvedValue({
      id: 'u1',
      name: 'jane.doe',
      displayName: 'Jane Doe',
      email: 'jane@example.com',
    } as User);

    const { result, waitFor } = renderHook(() =>
      useUserLabel({ userName: 'jane.doe', enabled: true })
    );

    expect(result.current).toBe('jane.doe');

    await waitFor(() => expect(result.current).toBe('Jane Doe'));
  });

  it('shares one request with the avatar lookup for the same user', async () => {
    mockGetUserByName.mockResolvedValue({
      id: 'u1',
      name: 'jane.doe',
      displayName: 'Jane Doe',
      email: 'jane@example.com',
    } as User);

    const { result, waitFor } = renderHook(() => ({
      label: useUserLabel({ userName: 'jane.doe', enabled: true }),
      avatar: useUserProfile({ permission: true, name: 'jane.doe' }),
    }));

    await waitFor(() => expect(result.current.label).toBe('Jane Doe'));

    expect(mockGetUserByName).toHaveBeenCalledTimes(1);
  });

  it('falls back to the login when the user cannot be loaded', async () => {
    mockGetUserByName.mockRejectedValue({ response: { status: 404 } });

    const { result, waitFor } = renderHook(() =>
      useUserLabel({ userName: 'ghost', enabled: true })
    );

    await waitFor(() =>
      expect(useApplicationStore.getState().userProfilePics.ghost).toBeDefined()
    );

    expect(result.current).toBe('ghost');
  });

  it('falls back to the login when the loaded user has an empty display name', async () => {
    mockGetUserByName.mockResolvedValue({
      id: 'u2',
      name: 'blank.user',
      displayName: '',
      email: 'blank@example.com',
    } as User);

    const { result, waitFor } = renderHook(() =>
      useUserLabel({ userName: 'blank.user', enabled: true })
    );

    await waitFor(() =>
      expect(
        useApplicationStore.getState().userProfilePics['blank.user']
      ).toBeDefined()
    );

    expect(result.current).toBe('blank.user');
  });

  it('prefers a non-empty displayName and skips empty ones', () => {
    const { result, rerender } = renderHook(
      ({ displayName }) =>
        useUserLabel({ userName: 'jane.doe', displayName, enabled: false }),
      { initialProps: { displayName: 'Prop Name' as string } }
    );

    expect(result.current).toBe('Prop Name');

    rerender({ displayName: '' });

    expect(result.current).toBe('jane.doe');
  });

  it('does not fetch when disabled', () => {
    renderHook(() => useUserLabel({ userName: 'jane.doe', enabled: false }));

    expect(mockGetUserByName).not.toHaveBeenCalled();
  });
});
