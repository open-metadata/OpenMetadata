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

import LdapIcon from '../../../assets/img/ic-ldap.svg';
import SamlIcon from '../../../assets/img/ic-saml.svg';
import Auth0Icon from '../../../assets/img/icon-auth0.png';
import CognitoIcon from '../../../assets/img/icon-aws-cognito.png';
import AzureIcon from '../../../assets/img/icon-azure.png';
import GoogleIcon from '../../../assets/img/icon-google.png';
import OktaIcon from '../../../assets/img/icon-okta.png';
import { AuthProvider } from '../../../generated/settings/settings';

export const PROVIDER_ICON_MAP: Record<string, string> = {
  google: GoogleIcon,
  azure: AzureIcon,
  okta: OktaIcon,
  auth0: Auth0Icon,
  'aws-cognito': CognitoIcon,
  ldap: LdapIcon,
  saml: SamlIcon,
};

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
  adminPrincipals: 'adminPrincipals',
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
