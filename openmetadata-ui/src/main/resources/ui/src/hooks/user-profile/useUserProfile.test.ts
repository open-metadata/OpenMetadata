/*
 *  Copyright 2023 Collate.
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
import { getUserByName } from '../../rest/userAPI';
import { useUserProfile } from './useUserProfile';

jest.mock(
  '../../context/ApplicationConfigProvider/ApplicationConfigProvider',
  () => ({
    useApplicationConfigContext: jest.fn().mockImplementation(() => ({
      userProfilePics: {
        chirag: {
          profile: {
            iamge512: 'profile512',
          },
        },
      },
      updateUserProfilePics: jest.fn(),
    })),
  })
);

jest.mock('../../rest/userAPI', () => ({
  getUserByName: jest.fn(),
}));

describe('useUserProfile hook', () => {
  it('should not call api if permission is not there', () => {
    const { result } = renderHook(() =>
      useUserProfile({ permission: false, name: '' })
    );

    expect(result.current[0]).toBeNull();
    expect(result.current[1]).toBe(false);
    expect(result.current[2]).toBeUndefined();
    expect(getUserByName).not.toHaveBeenCalled();
  });

  it('should call api if permission is there', () => {
    const { result } = renderHook(() =>
      useUserProfile({ permission: true, name: 'test' })
    );

    expect(result.current[0]).toBeNull();
    expect(result.current[1]).toBe(false);
    expect(result.current[2]).toBeUndefined();
    expect(getUserByName).toHaveBeenCalledWith('test', { fields: 'profile' });
  });

  it('should not call api if name is empty', () => {
    const { result } = renderHook(() =>
      useUserProfile({ permission: true, name: '' })
    );

    expect(result.current[0]).toBeNull();
    expect(result.current[1]).toBe(false);
    expect(result.current[2]).toBeUndefined();
    expect(getUserByName).not.toHaveBeenCalledWith();
  });

  it('should not call api if isTeam is true', () => {
    const { result } = renderHook(() =>
      useUserProfile({ permission: true, name: 'test', isTeam: true })
    );

    expect(result.current[0]).not.toBeNull();
    expect(result.current[1]).toBe(false);
    expect(result.current[2]).toBeUndefined();
    expect(getUserByName).not.toHaveBeenCalledWith();
  });

  it('should return profileURL & user data for name mentioned if already present', async () => {
    const { result } = renderHook(() =>
      useUserProfile({ permission: true, name: 'chirag' })
    );

    expect(result.current[0]).toBe('');
    expect(result.current[1]).toBe(false);
    expect(result.current[2]).toStrictEqual({
      profile: {
        iamge512: 'profile512',
      },
    });
  });
});
