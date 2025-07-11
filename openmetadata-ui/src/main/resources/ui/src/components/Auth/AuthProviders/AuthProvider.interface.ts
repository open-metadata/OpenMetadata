/*
 *  Copyright 2022 Collate.
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

import { Profile, UserManager } from 'oidc-client';
import { AuthenticationConfiguration } from '../../../generated/configuration/authenticationConfiguration';
import { AuthorizerConfiguration } from '../../../generated/configuration/authorizerConfiguration';
import { User } from '../../../generated/entity/teams/user';
import { AccessTokenResponse } from '../../../rest/auth-API';

export type UserProfile = {
  email: string;
  name: string;
  picture: string;
  locale?: string;
} & Pick<Profile, 'preferred_username' | 'sub'>;

export type OidcUser = {
  id_token: string;
  scope: string;
  profile: UserProfile;
};

export interface AuthenticatorRef {
  invokeLogin: () => void;
  invokeLogout: () => Promise<void>;
  renewIdToken: () =>
    | Promise<string>
    | Promise<AccessTokenResponse>
    | Promise<void>;
  userManager?: UserManager;
}

export interface IAuthContext {
  isAuthenticated: boolean;
  setIsAuthenticated: (authenticated: boolean) => void;
  authConfig?: AuthenticationConfiguration;
  authorizerConfig?: AuthorizerConfiguration;
  isSigningUp: boolean;
  setIsSigningUp: (isSigningUp: boolean) => void;
  currentUser?: User;
  newUser?: UserProfile;
  updateNewUser: (user: UserProfile) => void;
  updateCurrentUser: (user: User) => void;
  jwtPrincipalClaims: string[];
  jwtPrincipalClaimsMapping: string[];
}

export type AuthenticationConfigurationWithScope =
  AuthenticationConfiguration & {
    responseType?: string;
    scope: string;
  };
