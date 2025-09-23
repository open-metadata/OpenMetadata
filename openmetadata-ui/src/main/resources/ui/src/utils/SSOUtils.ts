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

import LdapIcon from '../assets/img/ic-ldap.svg';
import SamlIcon from '../assets/img/ic-saml.svg';
import Auth0Icon from '../assets/img/icon-auth0.png';
import CognitoIcon from '../assets/img/icon-aws-cognito.png';
import AzureIcon from '../assets/img/icon-azure.png';
import GoogleIcon from '../assets/img/icon-google.png';
import OktaIcon from '../assets/img/icon-okta.png';
import SSOIcon from '../assets/svg/sso-settings.svg';

import { AuthProvider } from '../generated/settings/settings';
import { isDev } from './EnvironmentUtils';

export interface ProviderOption {
  key: AuthProvider;
  label: string;
  icon: string;
}

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

/**
 * Get the icon for an authentication provider
 * @param provider - The authentication provider
 * @returns The icon component or null
 */
export const getProviderIcon = (provider: string): string | null => {
  switch (provider) {
    case AuthProvider.Azure:
      return AzureIcon;
    case AuthProvider.Google:
      return GoogleIcon;
    case AuthProvider.Okta:
      return OktaIcon;
    case AuthProvider.Auth0:
      return Auth0Icon;
    case AuthProvider.AwsCognito:
      return CognitoIcon;
    case AuthProvider.LDAP:
      return SSOIcon;
    case AuthProvider.Saml:
      return SSOIcon;
    default:
      return null;
  }
};

/**
 * Get dynamic callback URL based on environment
 * @returns The callback URL for SSO authentication
 */
export const getCallbackUrl = (): string => {
  if (isDev()) {
    return 'http://localhost:8585/callback';
  }

  // In production, use the current domain with /callback path
  return `${window.location.origin}/callback`;
};

/**
 * Get dynamic server URL based on environment
 * @returns The server URL for SSO configuration
 */
export const getServerUrl = (): string => {
  if (isDev()) {
    return 'http://localhost:8585';
  }

  // In production, use the current domain
  return window.location.origin;
};

/**
 * Get just the domain/origin without any path
 * @returns The domain URL for SSO entity ID
 */
export const getDomainUrl = (): string => {
  if (isDev()) {
    return 'http://localhost:8585';
  }

  // In production, use just the origin (protocol + domain + port)
  return window.location.origin;
};

/**
 * Get the authority URL for SAML authentication
 * @returns The authority URL for SAML login
 */
export const getAuthorityUrl = (): string => {
  if (isDev()) {
    return 'http://localhost:8585/api/v1/auth/login';
  }

  // In production, use the current domain with /api/auth/login path
  return `${window.location.origin}/api/v1/auth/login`;
};

/**
 * Provider options for SSO configuration
 */
export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    key: AuthProvider.Google,
    label: 'Google',
    icon: GoogleIcon,
  },
  {
    key: AuthProvider.Azure,
    label: 'Azure AD',
    icon: AzureIcon,
  },
  {
    key: AuthProvider.Okta,
    label: 'Okta',
    icon: OktaIcon,
  },
  {
    key: AuthProvider.Saml,
    label: 'SAML',
    icon: SamlIcon,
  },
  {
    key: AuthProvider.AwsCognito,
    label: 'AWS-Cognito',
    icon: CognitoIcon,
  },
  {
    key: AuthProvider.CustomOidc,
    label: 'Custom-OIDC',
    icon: CognitoIcon,
  },
  {
    key: AuthProvider.LDAP,
    label: 'LDAP',
    icon: LdapIcon,
  },
  {
    key: AuthProvider.Auth0,
    label: 'Auth0',
    icon: Auth0Icon,
  },
];
