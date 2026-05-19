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
// Visible main-tier form fields for OIDC providers. Provider Name, Authority,
// root Client ID and root JWT Principal Claims are now hidden via UI schema
// (SSOConfigurationForm.tsx); the OIDC subsection renders Client ID under
// `oidcConfiguration.id`.
export const SSO_COMMON_FIELDS = ['Callback URL'];

// Main-tier OIDC fields rendered inside `oidcConfiguration` for confidential
// providers. Other OIDC settings (scope, useNonce, preferredJwsAlgorithm,
// disablePkce, etc.) live in the Advanced Fields accordion.
export const OIDC_COMMON_FIELDS = [
  'Client ID',
  'Client Secret',
  'Discovery URI',
];

// Main-tier SAML form inputs rendered when the IdP section is expanded.
// Service Provider details (entityId, acs) are surfaced via the
// "Register with your Identity Provider" copyable banner, not the form.
export const SAML_VISIBLE_FIELDS = [
  'IdP Entity ID',
  'IdP SSO Login URL',
  'IdP X.509 Certificate',
  'Name ID Format',
];

// Main-tier LDAP form inputs (LDAP_SUBSECTION in SSO.constant.ts). Group
// configuration, role mapping, and SSL settings live in Advanced Fields.
export const LDAP_VISIBLE_FIELDS = [
  'LDAP Host',
  'LDAP Port',
  'Admin Principal DN',
  'Admin Password',
  'User Base DN',
  'Mail Attribute Name',
];
