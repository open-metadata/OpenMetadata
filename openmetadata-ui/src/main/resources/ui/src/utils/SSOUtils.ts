/*
 *  Copyright 2025 Collate.
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

import { AuthProvider } from '../generated/settings/settings';

/**
 * Get the display name for an authentication provider
 * @param provider - The authentication provider
 * @returns The human-readable display name
 */
export const getProviderDisplayName = (provider: string): string => {
  switch (provider) {
    case AuthProvider.Azure:
      return 'Azure AD';
    case AuthProvider.Google:
      return 'Google';
    case AuthProvider.Okta:
      return 'Okta';
    case AuthProvider.Auth0:
      return 'Auth0';
    case AuthProvider.AwsCognito:
      return 'AWS Cognito';
    case AuthProvider.Saml:
      return 'SAML';
    case AuthProvider.CustomOidc:
      return 'Custom OIDC';
    case AuthProvider.Basic:
      return 'Basic Authentication';
    default:
      return provider?.charAt(0).toUpperCase() + provider?.slice(1);
  }
};
