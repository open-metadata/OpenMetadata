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
import { getNameFromUserData } from './AuthProvider.util';

const userProfile = {
  email: 'testUser@gmail.com',
  sub: 'i_am_sub',
  preferred_username: 'i_am_preferred_username',
  name: 'Test User',
  picture: '',
};

describe('Test Auth Provider utils', () => {
  it('getNameFromUserData should return the userName for first claim', () => {
    // should return the preferred username
    const userName1 = getNameFromUserData(userProfile, [
      'preferred_username',
      'email',
      'sub',
    ]);

    expect(userName1).toEqual('i_am_preferred_username');

    // should return the name from email
    const userName2 = getNameFromUserData(userProfile, [
      'email',
      'preferred_username',
      'sub',
    ]);

    expect(userName2).toEqual('testUser');

    // should return the sub
    const userName3 = getNameFromUserData(userProfile, [
      'sub',
      'email',
      'preferred_username',
    ]);

    expect(userName3).toEqual('i_am_sub');
  });

  it('getNameFromUserData should fallback to next claim if first claim is not present', () => {
    // should return the name from email as fallback
    const userName1 = getNameFromUserData(
      { ...userProfile, preferred_username: '' },
      ['preferred_username', 'email', 'sub']
    );

    expect(userName1).toEqual('testUser');

    // should return the sub as fallback
    const userName2 = getNameFromUserData(
      { ...userProfile, preferred_username: '' },
      ['preferred_username', 'sub', 'email']
    );

    expect(userName2).toEqual('i_am_sub');

    // should return the name from email as fallback if both 'preferred_username' and 'sub' are not present
    const userName3 = getNameFromUserData(
      { ...userProfile, preferred_username: '', sub: '' },
      ['preferred_username', 'sub', 'email']
    );

    expect(userName3).toEqual('testUser');
  });

  it('getNameFromUserData should handle the claim if it contains @', () => {
    const userName1 = getNameFromUserData(
      { ...userProfile, preferred_username: 'test@gmail.com' },
      ['preferred_username', 'email', 'sub']
    );

    expect(userName1).toEqual('test');

    const userName2 = getNameFromUserData(
      { ...userProfile, sub: 'test-1@gmail.com' },
      ['sub', 'preferred_username', 'email']
    );

    expect(userName2).toEqual('test-1');
  });
});
