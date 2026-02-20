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

import { AuthProvider } from '../../../generated/settings/settings';

export const FIELD_MAPPINGS: Record<string, string> = {
  clientType: 'clientType',
  clientId: 'clientId',
  callbackUrl: 'callbackUrl',
  redirectUrl: 'callbackUrl',
  publicKeyUrls: 'publicKey',
  publicKey: 'publicKey',
  tokenValidationAlgorithm: 'tokenValidation',
  authority: 'authority',
  domain: 'authority', // Auth0 domain maps to authority
  jwtPrincipalClaims: 'principals',
  principalDomain: 'principalDomain',
  enforcePrincipalDomain: 'enforcePrincipalDomain',
  adminPrincipals: 'adminPrincipals',
  allowedDomains: 'allowedDomains',
  enableSelfSignup: 'selfSignup',
  secret: 'clientSecret',
  clientSecret: 'clientSecret',
  secretKey: 'clientSecret',
  scopes: 'scopes',
  providerName: 'providerName',
};

export const PROVIDER_FILE_MAP: Record<string, string> = {
  [AuthProvider.Google]: 'googleSSOClientConfig',
  [AuthProvider.Azure]: 'azureSSOClientConfig',
  [AuthProvider.Okta]: 'oktaSSOClientConfig',
  [AuthProvider.Auth0]: 'auth0SSOClientConfig',
  [AuthProvider.Saml]: 'samlSSOClientConfig',
  [AuthProvider.LDAP]: 'ldapSSOClientConfig',
  [AuthProvider.CustomOidc]: 'customOidcSSOClientConfig',
  [AuthProvider.AwsCognito]: 'awsCognitoSSOClientConfig',
  [AuthProvider.Basic]: 'basic',
  general: 'general',
};
