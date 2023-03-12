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
import { UserProfile } from 'components/authentication/auth-provider/AuthProvider.interface';
import { getNameFromUserData } from './AuthProvider.util';

const userProfile = {
  email: 'testUser@gmail.com',
  sub: 'i_am_sub',
  preferred_username: 'i_am_preferred_username',
  name: 'Test User',
  picture: '',
};

describe('Test Auth Provider utils', () => {
  it('getNameFromUserData should return name and email from claim: preferred_username', () => {
    const { name, email } = getNameFromUserData(userProfile, [
      'preferred_username',
    ]);

    expect(name).toEqual('i_am_preferred_username');
    expect(email).toEqual('i_am_preferred_username@');
  });

  it('getNameFromUserData should return name and email from claim: email', () => {
    const { name, email } = getNameFromUserData(userProfile, ['email']);

    expect(name).toEqual('testUser');
    expect(email).toEqual('testUser@gmail.com');
  });

  it('getNameFromUserData should return name and email from claim: sub', () => {
    const { name, email } = getNameFromUserData(userProfile, ['sub']);

    expect(name).toEqual('i_am_sub');
    expect(email).toEqual('i_am_sub@');
  });

  it('getNameFromUserData should return email with principle domain from claim: sub', () => {
    const { name, email } = getNameFromUserData(
      userProfile,
      ['sub'],
      'test.com'
    );

    expect(name).toEqual('i_am_sub');
    expect(email).toEqual('i_am_sub@test.com');
  });

  it('getNameFromUserData should fallback to next claim if first is not present', () => {
    const { email } = userProfile;
    const { name, email: generatedEmail } = getNameFromUserData(
      { email } as UserProfile,
      ['sub', 'preferred_username', 'email'],
      'test.com'
    );

    expect(name).toEqual('testUser');
    expect(generatedEmail).toEqual('testUser@gmail.com');
  });

  it('getNameFromUserData should respect domain present in claim over principleClaim', () => {
    const { name, email: generatedEmail } = getNameFromUserData(
      userProfile,
      ['email', 'preferred_username', 'sub'],
      'test.com'
    );

    expect(name).toEqual('testUser');
    expect(generatedEmail).toEqual('testUser@gmail.com');
  });

  it('getNameFromUserData should handle the claim if it contains @', () => {
    const { name, email } = getNameFromUserData(
      { ...userProfile, preferred_username: 'test@gmail.com' },
      ['preferred_username', 'email', 'sub']
    );

    expect(name).toEqual('test');
    expect(email).toEqual('test@gmail.com');
  });

  it('getNameFromUserData should add principle domain if domain is missing', () => {
    const { name, email } = getNameFromUserData(
      userProfile,
      ['preferred_username', 'email', 'sub'],
      'test.com'
    );

    expect(name).toEqual('i_am_preferred_username');
    expect(email).toEqual('i_am_preferred_username@test.com');
  });
});
