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
import { Page } from '@playwright/test';
import { ProviderConfigOverride, ProviderCredentials } from '../ssoAuth';
import { customOidcProviderHelper } from './custom-oidc';
import { keycloakAzureSamlProviderHelper } from './keycloak-saml';
import { oktaProviderHelper } from './okta';
import { openldapProviderHelper } from './openldap';

export type ProviderConfigPayload =
  | ProviderConfigOverride
  | Promise<ProviderConfigOverride>;

export interface FillFormOverrides {
  secret?: string;
  cert?: string;
}

export interface ProviderHelper {
  expectedButtonText: string;
  loginUrlPattern: RegExp;
  buildConfigPayload: () => ProviderConfigPayload;
  performProviderLogin: (
    page: Page,
    credentials: ProviderCredentials
  ) => Promise<void>;
  fillForm?: (page: Page, overrides?: FillFormOverrides) => Promise<void>;
}

export const getProviderHelper = (providerType: string): ProviderHelper => {
  switch (providerType) {
    case 'okta':
      return oktaProviderHelper;
    case 'keycloak-azure-saml':
      return keycloakAzureSamlProviderHelper;
    case 'custom-oidc':
      return customOidcProviderHelper;
    case 'ldap':
      return openldapProviderHelper;
    default:
      throw new Error(
        `No SSO provider helper registered for "${providerType}". ` +
          `Supported providers: okta, keycloak-azure-saml, custom-oidc, ldap`
      );
  }
};
