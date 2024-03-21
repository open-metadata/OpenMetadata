/*
 *  Copyright 2024 Collate.
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
import { User } from '../generated/entity/teams/user';
import { getUserWithImage } from './UserDataUtils';

describe('getUserWithImage', () => {
  it('should return the correct user based on profile and isBot status', () => {
    const userWithProfileImage: User = {
      email: 'a@a.com',
      id: '1',
      name: 'user',
      profile: {
        images: {
          image: 'profileImage',
        },
      },
      isBot: false,
    };

    const userWithEmptyProfileImage: User = {
      email: 'a@a.com',
      id: '1',
      name: 'user',
      profile: {
        images: {
          image: '',
        },
      },
      isBot: false,
    };

    const botUser: User = {
      email: 'a@a.com',
      id: '1',
      name: 'user',
      isBot: true,
    };

    const userWithoutProfile: User = {
      email: 'a@a.com',
      id: '1',
      name: 'user',
      isBot: false,
    };

    // Test user with profile image
    let result = getUserWithImage(userWithProfileImage);

    expect(result).toEqual(userWithProfileImage);

    // Test user with empty profile image
    result = getUserWithImage(userWithEmptyProfileImage);

    expect(result).toEqual({
      ...userWithEmptyProfileImage,
      profile: {
        images: {
          image: '',
        },
      },
    });

    // Test bot user
    result = getUserWithImage(botUser);

    expect(result).toEqual({
      ...botUser,
      profile: {
        images: {
          image: '',
        },
      },
    });

    // Test user without profile
    result = getUserWithImage(userWithoutProfile);

    expect(result).toEqual(userWithoutProfile);
  });
});
