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
export const SSO_COMMON_FIELDS = [
  'Provider Name',
  'Authority',
  'Client ID',
  'Callback URL',
  'JWT Principal Claims',
  'Enable Self Signup',
  'Allowed Domains',
  'Use Roles From Provider',
];

export const OIDC_COMMON_FIELDS = [
  'OIDC Client ID',
  'OIDC Client Secret',
  'OIDC Request Scopes',
  'OIDC Discovery URI',
  'OIDC Use Nonce',
  'OIDC Preferred JWS Algorithm',
  'OIDC Response Type',
  'OIDC Disable PKCE',
  'OIDC Max Clock Skew',
  'OIDC Client Authentication Method',
  'OIDC Token Validity',
  'OIDC Server URL',
  'OIDC Callback URL',
  'OIDC Max Age',
  'OIDC Prompt',
  'OIDC Session Expiry',
];

export const SAML_VISIBLE_FIELDS = [
  'IdP Entity ID',
  'IdP SSO Login URL',
  'IdP X.509 Certificate',
  'Name ID Format',
  'SP Entity ID',
  'Assertion Consumer Service URL',
  'SP X.509 Certificate',
  'SP Private Key',
  'Debug Mode',
  'Strict Mode',
  'Want Assertions Signed',
  'Want Messages Signed',
  'Send Signed Auth Request',
  'Allowed Domains',
];

export const LDAP_VISIBLE_FIELDS = [
  'LDAP Host',
  'LDAP Port',
  'Admin Principal DN',
  'Admin Password',
  'Enable SSL',
  'Max Pool Size',
  'User Base DN',
  'Group Base DN',
  'Full DN Required',
  'Admin Role Name',
  'All Attribute Name',
  'Mail Attribute Name',
  'Group Attribute Name',
  'Group Attribute Value',
  'Group Member Attribute Name',
  'Auth Reassign Roles',
  'Allowed Domains',
];
