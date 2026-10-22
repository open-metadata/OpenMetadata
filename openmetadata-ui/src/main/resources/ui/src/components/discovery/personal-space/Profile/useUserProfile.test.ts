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

import { act, renderHook, waitFor } from '@testing-library/react';
import { useProfileCopy, useUserProfile } from './useUserProfile';

const mockGetUserByName = jest.fn();
const mockUpdateUserDetail = jest.fn();
const mockShowErrorToast = jest.fn();
const mockUpdateCurrentUser = jest.fn();

jest.mock('rest/userAPI', () => ({
  getUserByName: (...a: unknown[]) => mockGetUserByName(...a),
  updateUserDetail: (...a: unknown[]) => mockUpdateUserDetail(...a),
}));

jest.mock('utils/ToastUtils', () => ({
  showErrorToast: (...a: unknown[]) => mockShowErrorToast(...a),
  showSuccessToast: jest.fn(),
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: { id: 'me', name: 'harsh', isAdmin: true },
    updateCurrentUser: mockUpdateCurrentUser,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) =>
      opts?.name ? `${key}:${opts.name}` : key,
  }),
}));

describe('useUserProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads another user including deleted ones, without borrowing our isAdmin', async () => {
    mockGetUserByName.mockResolvedValue({ id: 'u2', name: 'alice' });

    const { result } = renderHook(() => useUserProfile('alice'));

    expect(result.current.userData).toBeUndefined();

    await waitFor(() => expect(result.current.isProfileLoading).toBe(false));

    expect(mockGetUserByName).toHaveBeenCalledWith(
      'alice',
      expect.objectContaining({
        include: 'all',
        fields: expect.arrayContaining(['extension']),
      })
    );
    expect(result.current.userData).toEqual({
      id: 'u2',
      name: 'alice',
      isAdmin: undefined,
    });
  });

  it('seeds your own profile from the store and keeps your isAdmin', async () => {
    mockGetUserByName.mockResolvedValue({ id: 'me', name: 'harsh' });

    const { result } = renderHook(() => useUserProfile('harsh'));

    expect(result.current.userData?.name).toBe('harsh');

    await waitFor(() => expect(result.current.isProfileLoading).toBe(false));

    expect(result.current.userData?.isAdmin).toBe(true);
  });

  it('flags a 404 as not found instead of toasting', async () => {
    mockGetUserByName.mockRejectedValue({ response: { status: 404 } });

    const { result } = renderHook(() => useUserProfile('ghost'));

    await waitFor(() => expect(result.current.isUserNotFound).toBe(true));

    expect(mockShowErrorToast).not.toHaveBeenCalled();
  });

  it('discards a slower response for a superseded username', async () => {
    let resolveBob!: (value: unknown) => void;
    mockGetUserByName.mockImplementation((name: string) =>
      name === 'bob'
        ? new Promise((resolve) => {
            resolveBob = resolve;
          })
        : Promise.resolve({ id: 'u-alice', name: 'alice' })
    );

    const { result, rerender } = renderHook(
      ({ name }) => useUserProfile(name),
      { initialProps: { name: 'bob' } }
    );
    rerender({ name: 'alice' });
    await waitFor(() => expect(result.current.userData?.name).toBe('alice'));

    await act(async () => {
      resolveBob({ id: 'u-bob', name: 'bob' });
    });

    expect(result.current.userData?.name).toBe('alice');
  });

  it('patches the loaded user and merges the response', async () => {
    mockGetUserByName.mockResolvedValue({
      id: 'u2',
      name: 'alice',
      displayName: 'Alice',
    });
    mockUpdateUserDetail.mockResolvedValue({
      id: 'u2',
      name: 'alice',
      displayName: 'Alice J',
    });

    const { result } = renderHook(() => useUserProfile('alice'));
    await waitFor(() => expect(result.current.userData).toBeDefined());

    await act(async () => {
      await result.current.updateUserDetails(
        { displayName: 'Alice J' },
        'displayName'
      );
    });

    expect(mockUpdateUserDetail).toHaveBeenCalledWith('u2', [
      { op: 'replace', path: '/displayName', value: 'Alice J' },
    ]);
    expect(result.current.userData?.displayName).toBe('Alice J');
    expect(mockUpdateCurrentUser).not.toHaveBeenCalled();
  });

  it('syncs the application store when you edit your own profile', async () => {
    mockGetUserByName.mockResolvedValue({ id: 'me', name: 'harsh' });
    mockUpdateUserDetail.mockResolvedValue({
      id: 'me',
      name: 'harsh',
      displayName: 'Harsh V',
    });

    const { result } = renderHook(() => useUserProfile('harsh'));
    await waitFor(() => expect(result.current.isProfileLoading).toBe(false));

    await act(async () => {
      await result.current.updateUserDetails(
        { displayName: 'Harsh V' },
        'displayName'
      );
    });

    expect(mockUpdateCurrentUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'harsh', displayName: 'Harsh V' })
    );
  });
});

describe('useProfileCopy', () => {
  it('uses "your" copy for yourself and the first name for others', () => {
    const self = renderHook(() =>
      useProfileCopy({ id: 'me', name: 'harsh', email: 'h@x.io' })
    );
    const other = renderHook(() =>
      useProfileCopy({
        id: 'u2',
        name: 'alice.johnson',
        displayName: 'Alice Johnson',
        email: 'a@x.io',
      })
    );

    expect(self.result.current('self.key', 'other.key')).toBe('self.key');
    expect(other.result.current('self.key', 'other.key')).toBe(
      'other.key:Alice'
    );
  });
});
