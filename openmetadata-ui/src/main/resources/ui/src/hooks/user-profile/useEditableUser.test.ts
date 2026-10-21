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
import { act, renderHook } from '@testing-library/react';
import { useEditableUser } from './useEditableUser';

const mockGetUserByName = jest.fn();
const mockGetLoggedInUser = jest.fn();
const mockUpdateUserDetail = jest.fn();
const mockShowErrorToast = jest.fn();

jest.mock('../../rest/userAPI', () => ({
  getUserByName: (...args: unknown[]) => mockGetUserByName(...args),
  getLoggedInUser: (...args: unknown[]) => mockGetLoggedInUser(...args),
  updateUserDetail: (...args: unknown[]) => mockUpdateUserDetail(...args),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
  showSuccessToast: jest.fn(),
}));

describe('useEditableUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ignores a slower response for a previous username', async () => {
    let resolveBob!: (value: unknown) => void;
    const bobPromise = new Promise((resolve) => {
      resolveBob = resolve;
    });
    mockGetUserByName.mockImplementation((name: string) =>
      name === 'bob'
        ? bobPromise
        : Promise.resolve({ id: 'u-alice', name: 'alice' })
    );

    const { result, rerender } = renderHook(
      ({ name }) => useEditableUser(name),
      { initialProps: { name: 'bob' } }
    );

    await act(async () => {
      rerender({ name: 'alice' });
    });
    await act(async () => {
      resolveBob({ id: 'u-bob', name: 'bob' });
      await bobPromise;
    });

    expect(result.current.userData?.name).toBe('alice');
  });

  it('keeps the seed isAdmin when the fetch does not return it', async () => {
    mockGetUserByName.mockResolvedValue({ id: 'u1', name: 'harsh' });

    const { result } = renderHook(() =>
      useEditableUser('harsh', {
        id: 'u1',
        name: 'harsh',
        isAdmin: true,
      } as never)
    );

    await act(async () => undefined);

    expect(result.current.userData?.isAdmin).toBe(true);
  });

  it('patches the loaded user by id and stores the response value', async () => {
    mockGetUserByName.mockResolvedValue({
      id: 'u2',
      name: 'jane',
      displayName: 'Jane',
    });
    mockUpdateUserDetail.mockResolvedValue({
      id: 'u2',
      name: 'jane',
      displayName: 'Jane Doe',
    });

    const { result } = renderHook(() => useEditableUser('jane'));
    await act(async () => undefined);

    await act(async () => {
      await result.current.updateUserDetails(
        { displayName: 'Jane Doe' },
        'displayName'
      );
    });

    expect(mockUpdateUserDetail).toHaveBeenCalledWith('u2', [
      { op: 'replace', path: '/displayName', value: 'Jane Doe' },
    ]);
    expect(result.current.userData?.displayName).toBe('Jane Doe');
  });

  it('loads your own profile from the logged-in user endpoint', async () => {
    mockGetLoggedInUser.mockResolvedValue({
      id: 'u1',
      name: 'harsh',
      email: 'harsh@acme.io',
    });

    const { result } = renderHook(() =>
      useEditableUser('harsh', undefined, true)
    );
    await act(async () => undefined);

    expect(mockGetUserByName).not.toHaveBeenCalled();
    expect(result.current.userData?.email).toBe('harsh@acme.io');
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

    const { result } = renderHook(() => useEditableUser('jane'));
    await act(async () => undefined);

    let adminSave!: Promise<void>;
    await act(async () => {
      adminSave = result.current.updateUserDetails({ isAdmin: true }, 'isAdmin');
      await result.current.updateUserDetails({ description: 'Hi' }, 'description');
    });
    await act(async () => {
      resolveAdmin({ id: 'u2', name: 'jane', isAdmin: true });
      await adminSave;
    });

    expect(result.current.userData).toEqual(
      expect.objectContaining({ isAdmin: true, description: 'Hi' })
    );
  });

  it('rejects a failed save without toasting, so the caller keeps its draft', async () => {
    mockGetUserByName.mockResolvedValue({ id: 'u2', name: 'jane' });
    mockUpdateUserDetail.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useEditableUser('jane'));
    await act(async () => undefined);

    await expect(
      result.current.updateUserDetails({ description: 'x' }, 'description')
    ).rejects.toThrow('boom');
    expect(mockShowErrorToast).not.toHaveBeenCalled();
  });
});

