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
import { act, renderHook } from '@testing-library/react-hooks';
import { EntityReference } from '../generated/entity/type';
import { updateUserDetail } from '../rest/userAPI';
import { showErrorToast } from '../utils/ToastUtils';
import { useApplicationStore } from './useApplicationStore';
import { useSwitchActiveDomain } from './useSwitchActiveDomain';

const mockNavigate = jest.fn();
const mockUpdateCurrentUser = jest.fn();
const mockUpdateActiveDomain = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('./useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));

jest.mock('./useDomainStore', () => ({
  useDomainStore: () => ({ updateActiveDomain: mockUpdateActiveDomain }),
}));

jest.mock('../rest/userAPI', () => ({
  updateUserDetail: jest.fn(),
}));

jest.mock('../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const savedDomain: EntityReference = {
  id: 'saved-domain-id',
  type: 'domain',
  fullyQualifiedName: 'Saved',
};
const pickedDomain: EntityReference = {
  id: 'picked-domain-id',
  type: 'domain',
  fullyQualifiedName: 'Picked',
};

const mockCurrentUser = (currentUser?: object) =>
  (useApplicationStore as unknown as jest.Mock).mockReturnValue({
    currentUser,
    updateCurrentUser: mockUpdateCurrentUser,
  });

const switchTo = async (domain?: EntityReference) => {
  const { result } = renderHook(() => useSwitchActiveDomain());
  await act(async () => {
    await result.current(domain);
  });
};

describe('useSwitchActiveDomain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser({ id: 'user-id', defaultDomain: savedDomain });
  });

  it('saves the picked domain on the user and reloads', async () => {
    const updatedUser = { id: 'user-id', defaultDomain: pickedDomain };
    (updateUserDetail as jest.Mock).mockResolvedValue(updatedUser);

    await switchTo(pickedDomain);

    expect(mockUpdateActiveDomain).toHaveBeenCalledWith(pickedDomain);
    expect(updateUserDetail).toHaveBeenCalledWith('user-id', [
      {
        op: 'add',
        path: '/defaultDomain',
        value: { id: pickedDomain.id, type: 'domain' },
      },
    ]);
    expect(mockUpdateCurrentUser).toHaveBeenCalledWith(updatedUser);
    expect(mockNavigate).toHaveBeenCalledWith(0);
  });

  it('clears the saved domain when switching to all domains', async () => {
    (updateUserDetail as jest.Mock).mockResolvedValue({ id: 'user-id' });

    await switchTo(undefined);

    expect(mockUpdateActiveDomain).toHaveBeenCalledWith(undefined);
    expect(updateUserDetail).toHaveBeenCalledWith('user-id', [
      { op: 'add', path: '/defaultDomain', value: null },
    ]);
    expect(mockNavigate).toHaveBeenCalledWith(0);
  });

  it('rolls back and does not reload when the save fails', async () => {
    const error = new Error('save failed');
    (updateUserDetail as jest.Mock).mockRejectedValue(error);

    await switchTo(pickedDomain);

    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(mockUpdateActiveDomain).toHaveBeenLastCalledWith(savedDomain);
    expect(mockUpdateCurrentUser).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('reloads without saving when there is no signed-in user', async () => {
    mockCurrentUser(undefined);

    await switchTo(pickedDomain);

    expect(updateUserDetail).not.toHaveBeenCalled();
    expect(mockUpdateActiveDomain).toHaveBeenCalledWith(pickedDomain);
    expect(mockNavigate).toHaveBeenCalledWith(0);
  });
});
