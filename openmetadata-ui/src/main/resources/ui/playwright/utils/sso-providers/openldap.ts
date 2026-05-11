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
import { ProviderHelper } from './index';

export const OPENLDAP_FIXTURE = {
  host: process.env.LDAP_HOST ?? 'openldap-test',
  port: Number.parseInt(process.env.LDAP_PORT ?? '389', 10),
  adminDn: 'cn=admin,dc=test,dc=local',
  adminPassword: 'admin-pass',
  userBaseDN: 'ou=people,dc=test,dc=local',
  mailAttributeName: 'mail',
  validUser: {
    cn: 'alice',
    dn: 'cn=alice,ou=people,dc=test,dc=local',
    email: 'alice@company.com',
    password: 'alice-pass',
  },
  noMailUser: {
    cn: 'bob',
    dn: 'cn=bob,ou=people,dc=test,dc=local',
    password: 'bob-pass',
  },
} as const;

const buildConfigPayload = (): ProviderConfigOverride => {
  return {
    authenticationConfiguration: {
      // SettingsSso.tsx's hasExistingConfig check requires provider !== 'basic'.
      provider: 'ldap',
      providerName: 'ldap',
      authority: '',
      clientId: '',
      callbackUrl: '',
      publicKeyUrls: [],
      jwtPrincipalClaims: ['email'],
      enableSelfSignup: false,
      ldapConfiguration: {
        host: OPENLDAP_FIXTURE.host,
        port: OPENLDAP_FIXTURE.port,
        dnAdminPrincipal: OPENLDAP_FIXTURE.adminDn,
        dnAdminPassword: OPENLDAP_FIXTURE.adminPassword,
        userBaseDN: OPENLDAP_FIXTURE.userBaseDN,
        mailAttributeName: OPENLDAP_FIXTURE.mailAttributeName,
        sslEnabled: false,
        maxPoolSize: 3,
      },
    },
    authorizerConfiguration: {
      principalDomain: 'company.com',
    },
  };
};

const performProviderLogin = async (
  _page: Page,
  _credentials: ProviderCredentials
): Promise<void> => {
  throw new Error(
    'openldapProviderHelper.performProviderLogin is not used; ' +
      'use runTestLoginViaLdapModal from playwright/utils/sso.ts instead.'
  );
};

const fillForm = async (page: Page): Promise<void> => {
  await page
    .getByRole('textbox', { name: /^LDAP Host/ })
    .fill(OPENLDAP_FIXTURE.host);
  await page
    .getByRole('spinbutton', { name: /^LDAP Port/ })
    .fill(String(OPENLDAP_FIXTURE.port));
  await page
    .getByRole('textbox', { name: /^Admin Principal DN/ })
    .fill(OPENLDAP_FIXTURE.adminDn);
  await page
    .getByRole('textbox', { name: /^Admin Password/ })
    .fill(OPENLDAP_FIXTURE.adminPassword);
  await page
    .getByRole('textbox', { name: /^User Base DN/ })
    .fill(OPENLDAP_FIXTURE.userBaseDN);
  await page
    .getByRole('textbox', { name: /^Mail Attribute Name/ })
    .fill(OPENLDAP_FIXTURE.mailAttributeName);
};

export const openldapProviderHelper: ProviderHelper = {
  expectedButtonText: '',
  loginUrlPattern: /openldap-test|localhost:1389/,
  buildConfigPayload,
  performProviderLogin,
  fillForm,
};
