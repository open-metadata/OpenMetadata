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

export const OM_BASE_URL =
  process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://localhost:8585';

export const SSO_ENV = {
  PROVIDER_TYPE: 'SSO_PROVIDER_TYPE',
  USERNAME: 'SSO_USERNAME',
  PASSWORD: 'SSO_PASSWORD',
  OKTA_CLIENT_ID: 'OKTA_CLIENT_ID',
  OKTA_DOMAIN: 'OKTA_DOMAIN',
  OKTA_PRINCIPAL_DOMAIN: 'OKTA_PRINCIPAL_DOMAIN',
  KEYCLOAK_SAML_BASE_URL: 'KEYCLOAK_SAML_BASE_URL',
  KEYCLOAK_SAML_AZURE_REALM: 'KEYCLOAK_SAML_AZURE_REALM',
  KEYCLOAK_SAML_PRINCIPAL_DOMAIN: 'KEYCLOAK_SAML_PRINCIPAL_DOMAIN',
} as const;
