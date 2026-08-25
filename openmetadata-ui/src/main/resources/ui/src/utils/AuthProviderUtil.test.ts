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
import { UserProfile } from '../components/Auth/AuthProviders/AuthProvider.interface';
import {
  extractNameFromUserProfile,
  getNameFromUserData,
} from './AuthProvider.util';

const userProfile = {
  email: 'testUser@gmail.com',
  sub: 'i_am_sub',
  preferred_username: 'i_am_preferred_username',
  name: 'Test User',
  picture: '',
};

describe('extractNameFromUserProfile', () => {
  describe('with name field', () => {
    it('should return name when name field is present', () => {
      const userProfile: UserProfile = {
        name: 'John Doe',
        email: 'john@example.com',
        picture: '',
        sub: 'user-123',
      };

      const result = extractNameFromUserProfile(userProfile);

      expect(result).toBe('John Doe');
    });

    it('should prioritize name field over other fields', () => {
      const userProfile: UserProfile = {
        name: 'John Doe',
        email: 'jane@example.com',
        preferred_username: 'jane.smith@company.com',
        picture: '',
        sub: 'user-456',
      };

      const result = extractNameFromUserProfile(userProfile);

      expect(result).toBe('John Doe');
    });
  });

  describe('with given_name and family_name', () => {
    it('should combine given_name and family_name when both are present', () => {
      const userProfile = {
        given_name: 'Jane',
        family_name: 'Smith',
        email: 'jane.smith@example.com',
        picture: '',
      } as unknown as UserProfile;

      const result = extractNameFromUserProfile(userProfile);

      expect(result).toBe('Jane Smith');
    });

    it('should return only given_name when family_name is missing', () => {
      const userProfile = {
        given_name: 'Alice',
        email: 'alice@example.com',
        picture: '',
      } as unknown as UserProfile;

      const result = extractNameFromUserProfile(userProfile);

      expect(result).toBe('Alice');
    });

    it('should return only family_name when given_name is missing', () => {
      const userProfile = {
        family_name: 'Johnson',
        email: 'johnson@example.com',
        picture: '',
      } as unknown as UserProfile;

      const result = extractNameFromUserProfile(userProfile);

      expect(result).toBe('Johnson');
    });

    it('should trim individual names when combining given_name and family_name', () => {
      const userProfile = {
        given_name: '  John  ',
        family_name: '  Doe  ',
        email: 'john@example.com',
        picture: '',
      } as unknown as UserProfile;

      const result = extractNameFromUserProfile(userProfile);

      expect(result).toBe('John Doe');
    });
  });

  describe('with preferred_username', () => {
    it('should extract username from preferred_username email format', () => {
      const userProfile: UserProfile = {
        preferred_username: 'john.doe@company.com',
        email: 'john@example.com',
        name: '',
        picture: '',
      };

      const result = extractNameFromUserProfile(userProfile);

      expect(result).toBe('john.doe');
    });

    it('should return preferred_username as-is if not email format', () => {
      const userProfile: UserProfile = {
        preferred_username: 'johndoe123',
        email: 'john@example.com',
        name: '',
        picture: '',
      };

      const result = extractNameFromUserProfile(userProfile);

      expect(result).toBe('johndoe123');
    });
  });

  describe('with email', () => {
    it('should extract username from email when no other name fields exist', () => {
      const userProfile: UserProfile = {
        email: 'alice.wonderland@example.com',
        name: '',
        picture: '',
      };

      const result = extractNameFromUserProfile(userProfile);

      expect(result).toBe('alice.wonderland');
    });

    it('should return email as-is if not valid email format', () => {
      const userProfile: UserProfile = {
        email: 'notanemail',
        name: '',
        picture: '',
      };

      const result = extractNameFromUserProfile(userProfile);

      expect(result).toBe('notanemail');
    });
  });

  describe('with sub field', () => {
    it('should use sub as last resort when no other fields are available', () => {
      const userProfile: UserProfile = {
        sub: 'oauth-user-12345',
        email: '',
        name: '',
        picture: '',
      };

      const result = extractNameFromUserProfile(userProfile);

      expect(result).toBe('oauth-user-12345');
    });
  });

  describe('edge cases', () => {
    it('should return empty string when user profile is null', () => {
      const result = extractNameFromUserProfile(null as unknown as UserProfile);

      expect(result).toBe('');
    });

    it('should return empty string when user profile is undefined', () => {
      const result = extractNameFromUserProfile(
        undefined as unknown as UserProfile
      );

      expect(result).toBe('');
    });

    it('should return empty string when all name fields are empty', () => {
      const userProfile: UserProfile = {
        name: '',
        email: '',
        picture: '',
      };

      const result = extractNameFromUserProfile(userProfile);

      expect(result).toBe('');
    });

    it('should handle user profile with only picture field', () => {
      const userProfile: UserProfile = {
        picture: 'https://example.com/avatar.jpg',
        name: '',
        email: '',
      };

      const result = extractNameFromUserProfile(userProfile);

      expect(result).toBe('');
    });
  });

  describe('SSO provider specific scenarios', () => {
    it('should handle Auth0 user profile', () => {
      const auth0Profile: UserProfile = {
        name: 'John Doe',
        email: 'john.doe@auth0.com',
        picture: 'https://s.gravatar.com/avatar/123',
        locale: 'en',
        sub: 'auth0|507f1f77bcf86cd799439011',
      };

      const result = extractNameFromUserProfile(auth0Profile);

      expect(result).toBe('John Doe');
    });

    it('should handle Azure/MSAL user profile with preferred_username', () => {
      const azureProfile = {
        name: 'Jane Smith',
        email: 'jane.smith@company.onmicrosoft.com',
        preferred_username: 'jane.smith@company.onmicrosoft.com',
        picture: '',
        sub: 'azure-sub-id',
      } as UserProfile;

      const result = extractNameFromUserProfile(azureProfile);

      expect(result).toBe('Jane Smith');
    });

    it('should handle Google OIDC user profile', () => {
      const googleProfile = {
        name: 'Alice Johnson',
        given_name: 'Alice',
        family_name: 'Johnson',
        email: 'alice.johnson@gmail.com',
        picture: 'https://lh3.googleusercontent.com/a/123',
        sub: 'google-id-456',
      } as unknown as UserProfile;

      const result = extractNameFromUserProfile(googleProfile);

      expect(result).toBe('Alice Johnson');
    });

    it('should handle Okta user profile', () => {
      const oktaProfile = {
        name: 'Bob Williams',
        given_name: 'Bob',
        family_name: 'Williams',
        email: 'bob.williams@company.com',
        preferred_username: 'bob.williams@company.com',
        locale: 'en-US',
        sub: 'okta-user-id-789',
      } as unknown as UserProfile;

      const result = extractNameFromUserProfile(oktaProfile);

      expect(result).toBe('Bob Williams');
    });

    it('should handle SAML user profile with minimal fields', () => {
      const samlProfile: UserProfile = {
        name: 'Charlie Brown',
        email: 'charlie.brown@company.com',
        picture: '',
      };

      const result = extractNameFromUserProfile(samlProfile);

      expect(result).toBe('Charlie Brown');
    });

    it('should handle Custom OIDC with only given_name and family_name', () => {
      const customOidcProfile = {
        given_name: 'Emily',
        family_name: 'Davis',
        email: 'emily.davis@custom-idp.com',
        picture: '',
        sub: 'custom-sub-123',
      } as unknown as UserProfile;

      const result = extractNameFromUserProfile(customOidcProfile);

      expect(result).toBe('Emily Davis');
    });

    it('should handle AWS Cognito user profile', () => {
      const cognitoProfile = {
        name: 'Frank Miller',
        email: 'frank.miller@example.com',
        picture: '',
        sub: 'cognito-user-uuid',
      } as UserProfile;

      const result = extractNameFromUserProfile(cognitoProfile);

      expect(result).toBe('Frank Miller');
    });

    it('should handle provider with only email (fallback scenario)', () => {
      const minimalProfile: UserProfile = {
        email: 'user@minimal-provider.com',
        name: '',
        picture: '',
      };

      const result = extractNameFromUserProfile(minimalProfile);

      expect(result).toBe('user');
    });
  });

  describe('priority order verification', () => {
    it('should prioritize name over given_name + family_name', () => {
      const userProfile = {
        name: 'Preferred Name',
        given_name: 'First',
        family_name: 'Last',
        email: 'user@example.com',
        picture: '',
      } as unknown as UserProfile;

      const result = extractNameFromUserProfile(userProfile);

      expect(result).toBe('Preferred Name');
    });

    it('should prioritize given_name + family_name over preferred_username', () => {
      const userProfile = {
        given_name: 'First',
        family_name: 'Last',
        preferred_username: 'different.user@example.com',
        email: 'user@example.com',
        name: '',
        picture: '',
      } as unknown as UserProfile;

      const result = extractNameFromUserProfile(userProfile);

      expect(result).toBe('First Last');
    });

    it('should prioritize preferred_username over email', () => {
      const userProfile: UserProfile = {
        preferred_username: 'preferred.user@company.com',
        email: 'different.email@example.com',
        name: '',
        picture: '',
      };

      const result = extractNameFromUserProfile(userProfile);

      expect(result).toBe('preferred.user');
    });

    it('should prioritize email over sub', () => {
      const userProfile: UserProfile = {
        email: 'user@example.com',
        sub: 'sub-identifier-123',
        name: '',
        picture: '',
      };

      const result = extractNameFromUserProfile(userProfile);

      expect(result).toBe('user');
    });
  });
});

describe('Test Auth Provider utils', () => {
  it('getNameFromUserData should return name and email from claim: preferred_username', () => {
    const { name, email, picture } = getNameFromUserData(userProfile, [
      'preferred_username',
    ]);

    expect(name).toEqual('i_am_preferred_username');
    expect(email).toEqual('i_am_preferred_username@');
    expect(picture).toEqual('');
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

  it('getNameFromUserData should return picture details as it is', () => {
    const { name, email, picture } = getNameFromUserData(
      { ...userProfile, picture: 'test_picture' },
      ['preferred_username', 'email', 'sub'],
      'test.com'
    );

    expect(name).toEqual('i_am_preferred_username');
    expect(email).toEqual('i_am_preferred_username@test.com');
    expect(picture).toEqual('test_picture');
  });
});

import { OidcUser } from '../components/Auth/AuthProviders/AuthProvider.interface';
import { ClientType } from '../generated/configuration/authenticationConfiguration';
import { prepareUserProfileFromClaims } from './AuthProvider.util';

describe('prepareUserProfileFromClaims', () => {
  const mockUser: OidcUser = {
    profile: {
      name: 'John Doe',
      email: 'john.doe@example.com',
    },
  } as OidcUser;

  const mockJwtPrincipalClaims = ['email'];
  const mockPrincipalDomain = 'example.com';
  const mockJwtPrincipalClaimsMapping = ['username:name', 'email:email'];

  it('should prepare user profile for public client type', () => {
    const result = prepareUserProfileFromClaims({
      user: mockUser,
      jwtPrincipalClaims: mockJwtPrincipalClaims,
      principalDomain: mockPrincipalDomain,
      jwtPrincipalClaimsMapping: mockJwtPrincipalClaimsMapping,
      clientType: ClientType.Public,
    });

    expect(result.profile).toEqual({
      name: 'John Doe',
      email: 'john.doe@example.com',
      displayName: 'John Doe',
      picture: undefined,
    });
  });

  it('should prepare user profile for non-public client type', () => {
    const result = prepareUserProfileFromClaims({
      user: mockUser,
      jwtPrincipalClaims: mockJwtPrincipalClaims,
      principalDomain: mockPrincipalDomain,
      jwtPrincipalClaimsMapping: mockJwtPrincipalClaimsMapping,
      clientType: ClientType.Confidential,
    });

    expect(result.profile).toEqual({
      name: 'John Doe',
      email: 'john.doe@example.com',
    });
  });

  it('should handle missing profile fields for non-public client type', () => {
    const mockUserWithMissingFields: OidcUser = {
      profile: {},
    } as OidcUser;

    const result = prepareUserProfileFromClaims({
      user: mockUserWithMissingFields,
      jwtPrincipalClaims: mockJwtPrincipalClaims,
      principalDomain: mockPrincipalDomain,
      jwtPrincipalClaimsMapping: mockJwtPrincipalClaimsMapping,
      clientType: ClientType.Confidential,
    });

    expect(result.profile).toEqual({
      name: '',
      email: '',
    });
  });
});
