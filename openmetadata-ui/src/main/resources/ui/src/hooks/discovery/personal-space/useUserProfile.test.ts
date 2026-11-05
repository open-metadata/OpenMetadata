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
const mockGetLoggedInUser = jest.fn();
const mockUpdateUserDetail = jest.fn();
const mockShowErrorToast = jest.fn();
const mockUpdateCurrentUser = jest.fn();

jest.mock('rest/userAPI', () => ({
  getLoggedInUser: (...a: unknown[]) => mockGetLoggedInUser(...a),
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
    jest.resetAllMocks();
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

  it('seeds your own profile from the store, loads it unmasked and keeps your isAdmin', async () => {
    mockGetLoggedInUser.mockResolvedValue({
      id: 'me',
      name: 'harsh',
      email: 'harsh@acme.io',
    });

    const { result } = renderHook(() => useUserProfile('harsh'));

    expect(result.current.userData?.name).toBe('harsh');

    await waitFor(() => expect(result.current.isProfileLoading).toBe(false));

    // `/users/name/<you>` masks your email for non-admins; loggedInUser does not.
    expect(mockGetLoggedInUser).toHaveBeenCalled();
    expect(mockGetUserByName).not.toHaveBeenCalled();
    expect(result.current.userData).toEqual(
      expect.objectContaining({ email: 'harsh@acme.io', isAdmin: true })
    );
  });

  it('keeps both fields when two saves overlap', async () => {
    mockGetUserByName.mockResolvedValue({
      id: 'u2',
      name: 'jane',
      isAdmin: false,
      description: '',
    });
    let resolveAdmin!: (value: unknown) => void;
    mockUpdateUserDetail
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveAdmin = resolve;
          })
      )
      .mockResolvedValueOnce({ id: 'u2', name: 'jane', description: 'Hi' });

    const { result } = renderHook(() => useUserProfile('jane'));
    await waitFor(() => expect(result.current.isProfileLoading).toBe(false));

    let adminSave!: Promise<boolean>;
    await act(async () => {
      adminSave = result.current.updateUserDetails(
        { isAdmin: true },
        'isAdmin'
      );
      await result.current.updateUserDetails(
        { description: 'Hi' },
        'description'
      );
    });
    await act(async () => {
      resolveAdmin({ id: 'u2', name: 'jane', isAdmin: true });
      await adminSave;
    });

    expect(result.current.userData).toEqual(
      expect.objectContaining({ isAdmin: true, description: 'Hi' })
    );
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
    mockGetLoggedInUser.mockResolvedValue({ id: 'me', name: 'harsh' });
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

    expect(mockGetUserByName).not.toHaveBeenCalled();
    expect(mockUpdateUserDetail).toHaveBeenCalledWith('me', expect.any(Array));
    expect(mockUpdateCurrentUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'harsh', displayName: 'Harsh V' })
    );
  });

  const loadAlice = async () => {
    mockGetUserByName.mockResolvedValue({ id: 'u2', name: 'alice' });
    const hook = renderHook(() => useUserProfile('alice'));
    await waitFor(() => expect(hook.result.current.userData).toBeDefined());

    return hook;
  };

  it('resolves false and toasts when the save is rejected', async () => {
    const { result } = await loadAlice();
    mockUpdateUserDetail.mockRejectedValue(new Error('boom'));

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.updateUserDetails(
        { displayName: 'A' },
        'displayName'
      );
    });

    expect(saved).toBe(false);
    expect(mockShowErrorToast).toHaveBeenCalled();
  });

  it('resolves false and toasts when the save returns nothing', async () => {
    const { result } = await loadAlice();
    mockUpdateUserDetail.mockResolvedValue(undefined);

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.updateUserDetails(
        { displayName: 'A' },
        'displayName'
      );
    });

    expect(saved).toBe(false);
    expect(mockShowErrorToast).toHaveBeenCalledWith(
      'server.entity-updating-error'
    );
  });

  it('toasts a non-404 load failure and flags it as a load error', async () => {
    mockGetUserByName.mockRejectedValue({ response: { status: 500 } });

    const { result } = renderHook(() => useUserProfile('alice'));
    await waitFor(() => expect(result.current.isProfileLoading).toBe(false));

    expect(result.current.loadError).toBe(true);
    expect(result.current.isUserNotFound).toBe(false);
    expect(result.current.userData).toBeUndefined();
    expect(mockShowErrorToast).toHaveBeenCalled();
  });

  it('refuses to save your own partial seed copy after the load fails', async () => {
    mockGetLoggedInUser.mockRejectedValue({ response: { status: 500 } });

    const { result } = renderHook(() => useUserProfile('harsh'));
    await waitFor(() => expect(result.current.loadError).toBe(true));

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.updateUserDetails(
        { extension: { costCenter: 'X' } },
        'extension'
      );
    });

    expect(saved).toBe(false);
    expect(mockUpdateUserDetail).not.toHaveBeenCalled();
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

describe('useUserProfile refresh', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('re-reads the user in place without a loading state', async () => {
    mockGetUserByName
      .mockResolvedValueOnce({ id: 'u2', name: 'alice', displayName: 'Old' })
      .mockResolvedValueOnce({ id: 'u2', name: 'alice', displayName: 'New' });
    const { result } = renderHook(() => useUserProfile('alice'));
    await waitFor(() => expect(result.current.isProfileLoading).toBe(false));

    let refreshed!: Promise<void>;
    act(() => {
      refreshed = result.current.refresh();
    });

    expect(result.current.isProfileLoading).toBe(false);
    expect(result.current.userData?.displayName).toBe('Old');

    await act(async () => {
      await refreshed;
    });

    expect(result.current.userData?.displayName).toBe('New');
  });

  it('keeps the values on screen when the re-read fails', async () => {
    mockGetUserByName
      .mockResolvedValueOnce({ id: 'u2', name: 'alice', displayName: 'Old' })
      .mockRejectedValueOnce({ response: { status: 500 } });
    const { result } = renderHook(() => useUserProfile('alice'));
    await waitFor(() => expect(result.current.isProfileLoading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.userData?.displayName).toBe('Old');
    expect(result.current.loadError).toBe(false);
    expect(mockShowErrorToast).not.toHaveBeenCalled();
  });

  // Opening Settings elsewhere and clicking Profile before the first load
  // lands used to strand that load in its skeleton.
  it('ignores a refresh while the first load runs, and that load still finishes', async () => {
    let resolveLoad!: (value: unknown) => void;
    mockGetUserByName.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        })
    );
    const { result } = renderHook(() => useUserProfile('alice'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetUserByName).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLoad({ id: 'u2', name: 'alice', displayName: 'Loaded' });
    });

    expect(result.current.isProfileLoading).toBe(false);
    expect(result.current.userData?.displayName).toBe('Loaded');
  });

  it('drops a refresh read before a save that lands first', async () => {
    let resolveRefresh!: (value: unknown) => void;
    mockGetUserByName
      .mockResolvedValueOnce({ id: 'u2', name: 'alice', displayName: 'Old' })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          })
      );
    mockUpdateUserDetail.mockResolvedValueOnce({
      id: 'u2',
      name: 'alice',
      displayName: 'Saved',
    });
    const { result } = renderHook(() => useUserProfile('alice'));
    await waitFor(() => expect(result.current.isProfileLoading).toBe(false));

    let refreshed!: Promise<void>;
    act(() => {
      refreshed = result.current.refresh();
    });
    await act(async () => {
      await result.current.updateUserDetails(
        { displayName: 'Saved' },
        'displayName'
      );
    });
    await act(async () => {
      resolveRefresh({ id: 'u2', name: 'alice', displayName: 'Old' });
      await refreshed;
    });

    expect(result.current.userData?.displayName).toBe('Saved');
  });
});
