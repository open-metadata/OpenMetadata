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

// Common hidden fields for all providers
export const COMMON_HIDDEN_FIELDS = {
  responseType: { 'ui:widget': 'hidden', 'ui:hideError': true },
  jwtPrincipalClaimsMapping: { 'ui:widget': 'hidden', 'ui:hideError': true },
};

// Authorizer hidden fields
export const AUTHORIZER_HIDDEN_FIELDS = {
  testPrincipals: {
    'ui:widget': 'hidden',
    'ui:hideError': true,
  },
  allowedEmailRegistrationDomains: {
    'ui:widget': 'hidden',
    'ui:hideError': true,
  },
  allowedDomains: {
    'ui:widget': 'hidden',
    'ui:hideError': true,
  },
  useRolesFromProvider: {
    'ui:widget': 'hidden',
    'ui:hideError': true,
  },
};

// LDAP Configuration UI Schema
export const LDAP_UI_SCHEMA = {
  ldapConfiguration: {
    'ui:title': 'LDAP Configuration',
    host: { 'ui:title': 'LDAP Host' },
    port: { 'ui:title': 'LDAP Port' },
    dnAdminPrincipal: { 'ui:title': 'Admin Principal DN' },
    dnAdminPassword: { 'ui:title': 'Admin Password', 'ui:widget': 'password' },
    userBaseDN: { 'ui:title': 'User Base DN' },
    groupBaseDN: { 'ui:title': 'Group Base DN' },
    sslEnabled: { 'ui:title': 'Enable SSL' },
    maxPoolSize: { 'ui:title': 'Max Pool Size' },
    isFullDn: { 'ui:title': 'Full DN Required' },
    roleAdminName: { 'ui:title': 'Admin Role Name' },
    allAttributeName: { 'ui:title': 'All Attribute Name' },
    mailAttributeName: { 'ui:title': 'Mail Attribute Name' },
    usernameAttributeName: { 'ui:title': 'Username Attribute Name' },
    groupAttributeName: { 'ui:title': 'Group Attribute Name' },
    groupAttributeValue: { 'ui:title': 'Group Attribute Value' },
    groupMemberAttributeName: { 'ui:title': 'Group Member Attribute Name' },
    authRolesMapping: { 'ui:title': 'Auth Roles Mapping' },
    authReassignRoles: { 'ui:title': 'Auth Reassign Roles' },
    // Hide trustStore fields as they are not commonly used
    truststoreConfigType: { 'ui:widget': 'hidden', 'ui:hideError': true },
    trustStoreConfig: { 'ui:widget': 'hidden', 'ui:hideError': true },
  },
  // Hide other provider configs for LDAP
  samlConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  oidcConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  // Hide clientType for LDAP as it defaults to public
  clientType: { 'ui:widget': 'hidden', 'ui:hideError': true },
};

// SAML Configuration UI Schema
export const SAML_UI_SCHEMA = {
  samlConfiguration: {
    'ui:title': 'SAML Configuration',
    debugMode: { 'ui:title': 'Debug Mode' },
    idp: {
      'ui:title': 'Identity Provider (IdP)',
      entityId: { 'ui:title': 'IdP Entity ID' },
      ssoLoginUrl: { 'ui:title': 'IdP SSO Login URL' },
      idpX509Certificate: {
        'ui:title': 'IdP X.509 Certificate',
        'ui:widget': 'textarea',
      },
      nameId: { 'ui:title': 'Name ID Format' },
    },
    sp: {
      'ui:title': 'Service Provider (SP)',
      entityId: { 'ui:title': 'SP Entity ID' },
      acs: { 'ui:title': 'Assertion Consumer Service URL' },
      callback: { 'ui:title': 'SP Callback URL' },
      spX509Certificate: {
        'ui:title': 'SP X.509 Certificate',
        'ui:widget': 'textarea',
      },
      spPrivateKey: { 'ui:title': 'SP Private Key', 'ui:widget': 'textarea' },
    },
    security: {
      'ui:title': 'Security Configuration',
      strictMode: { 'ui:title': 'Strict Mode' },
      tokenValidity: {
        'ui:title': 'Token Validity (seconds)',
        'ui:options': { inputType: 'number' },
      },
      wantAssertionsSigned: { 'ui:title': 'Want Assertions Signed' },
      wantMessagesSigned: { 'ui:title': 'Want Messages Signed' },
      sendSignedAuthRequest: { 'ui:title': 'Send Signed Auth Request' },
      // Hide unwanted security fields
      validateXml: { 'ui:widget': 'hidden', 'ui:hideError': true },
      sendEncryptedNameId: { 'ui:widget': 'hidden', 'ui:hideError': true },
      signSpMetadata: { 'ui:widget': 'hidden', 'ui:hideError': true },
      wantAssertionEncrypted: { 'ui:widget': 'hidden', 'ui:hideError': true },
      keyStoreFilePath: { 'ui:widget': 'hidden', 'ui:hideError': true },
      keyStoreAlias: { 'ui:widget': 'hidden', 'ui:hideError': true },
      keyStorePassword: { 'ui:widget': 'hidden', 'ui:hideError': true },
    },
  },
  // Hide LDAP/OIDC specific fields for SAML
  ldapConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  oidcConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  tokenValidationAlgorithm: { 'ui:widget': 'hidden', 'ui:hideError': true },
  jwtPrincipalClaims: { 'ui:title': 'JWT Principal Claims' },
  enableSelfSignup: { 'ui:widget': 'hidden', 'ui:hideError': true },
  // Hide clientType for SAML as it defaults to public
  clientType: { 'ui:widget': 'hidden', 'ui:hideError': true },
  // Show required fields for SAML
  authority: { 'ui:title': 'Authority' },
  clientId: { 'ui:title': 'Client ID' },
  callbackUrl: { 'ui:title': 'Callback URL' },
  publicKeyUrls: { 'ui:title': 'Public Key URLs' },
};

// OIDC Configuration UI Schema
export const OIDC_UI_SCHEMA = {
  oidcConfiguration: {
    'ui:title': 'OIDC Configuration',
    clientId: { 'ui:title': 'OIDC Client ID' },
    clientSecret: { 'ui:title': 'OIDC Client Secret', 'ui:widget': 'password' },
    tokenEndpoint: { 'ui:title': 'Token Endpoint' },
    authorizationEndpoint: { 'ui:title': 'Authorization Endpoint' },
    userInfoEndpoint: { 'ui:title': 'User Info Endpoint' },
    jwksUri: { 'ui:title': 'JWKS URI' },
  },
  // Hide LDAP/SAML specific fields for OIDC
  ldapConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  samlConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
};

// Standard OAuth/OIDC providers (Google, Auth0, Azure, Okta)
export const STANDARD_OAUTH_UI_SCHEMA = {
  ldapConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  samlConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  oidcConfiguration: {
    'ui:title': 'OIDC Configuration',
    secret: { 'ui:title': 'Client Secret', 'ui:widget': 'password' },
    scope: { 'ui:title': 'Scope' },
    useNonce: { 'ui:title': 'Use Nonce' },
    preferredJwsAlgorithm: { 'ui:title': 'Preferred JWS Algorithm' },
    responseType: { 'ui:title': 'Response Type' },
    disablePkce: { 'ui:title': 'Disable PKCE' },
    maxClockSkew: { 'ui:title': 'Max Clock Skew' },
    clientAuthenticationMethod: { 'ui:title': 'Client Authentication Method' },
    tokenValidity: { 'ui:title': 'Token Validity' },
    tenant: { 'ui:title': 'Tenant' },
    serverUrl: { 'ui:title': 'Server URL' },
    callbackUrl: { 'ui:title': 'Callback URL' },
    maxAge: { 'ui:title': 'Max Age' },
    prompt: { 'ui:title': 'Prompt' },
    sessionExpiry: { 'ui:title': 'Session Expiry' },
  },
};

// Common field titles
export const COMMON_FIELD_TITLES = {
  provider: { 'ui:title': 'Provider' },
  providerName: { 'ui:title': 'Provider Name' },
  authority: { 'ui:title': 'Authority' },
  clientId: { 'ui:title': 'Client ID' },
  callbackUrl: { 'ui:title': 'Callback URL' },
  publicKeyUrls: { 'ui:title': 'Public Key URLs' },
  tokenValidationAlgorithm: { 'ui:title': 'Token Validation Algorithm' },
  jwtPrincipalClaims: { 'ui:title': 'JWT Principal Claims' },
  enableSelfSignup: { 'ui:title': 'Enable Self Signup' },
  clientType: { 'ui:title': 'Client Type' },
  secret: { 'ui:title': 'Client Secret', 'ui:widget': 'password' },
};

// Authorizer field titles
export const AUTHORIZER_FIELD_TITLES = {
  className: { 'ui:widget': 'hidden', 'ui:hideError': true },
  containerRequestFilter: { 'ui:widget': 'hidden', 'ui:hideError': true },
  adminPrincipals: { 'ui:title': 'Admin Principals' },
  botPrincipals: { 'ui:title': 'Bot Principals' },
  principalDomain: { 'ui:title': 'Principal Domain' },
  enforcePrincipalDomain: { 'ui:title': 'Enforce Principal Domain' },
  enableSecureSocketConnection: {
    'ui:title': 'Enable Secure Socket Connection',
  },
};

// Type definitions for UI Schema
interface UISchemaField {
  'ui:title'?: string;
  'ui:widget'?: string;
  'ui:hideError'?: boolean;
  'ui:options'?: Record<string, unknown>;
}

interface UISchemaObject {
  [key: string]: UISchemaField | UISchemaObject;
}

// Provider-specific UI schemas
export const PROVIDER_UI_SCHEMAS: Record<string, UISchemaObject> = {
  ldap: LDAP_UI_SCHEMA,
  saml: SAML_UI_SCHEMA,
  customoidc: OIDC_UI_SCHEMA,
  google: STANDARD_OAUTH_UI_SCHEMA,
  auth0: STANDARD_OAUTH_UI_SCHEMA,
  azure: STANDARD_OAUTH_UI_SCHEMA,
  okta: STANDARD_OAUTH_UI_SCHEMA,
  basic: STANDARD_OAUTH_UI_SCHEMA,
  'aws-cognito': STANDARD_OAUTH_UI_SCHEMA,
};

// Bot principals visibility based on provider
export const BOT_PRINCIPALS_VISIBILITY: Record<string, UISchemaField> = {
  google: { 'ui:widget': 'hidden', 'ui:hideError': true },
  auth0: { 'ui:widget': 'hidden', 'ui:hideError': true },
  basic: { 'ui:widget': 'hidden', 'ui:hideError': true },
  azure: { 'ui:widget': 'hidden', 'ui:hideError': true },
  'aws-cognito': { 'ui:widget': 'hidden', 'ui:hideError': true },
};

// Provider-specific field removal mapping for cleanup
export const PROVIDER_FIELD_MAPPINGS: Record<string, string[]> = {
  ldap: ['samlConfiguration', 'oidcConfiguration'],
  saml: [
    'ldapConfiguration',
    'oidcConfiguration',
    'tokenValidationAlgorithm',
    'enableSelfSignup',
  ],
  customoidc: ['ldapConfiguration', 'samlConfiguration'],
  google: ['ldapConfiguration', 'samlConfiguration', 'oidcConfiguration'],
  auth0: ['ldapConfiguration', 'samlConfiguration', 'oidcConfiguration'],
  azure: ['ldapConfiguration', 'samlConfiguration', 'oidcConfiguration'],
  okta: ['ldapConfiguration', 'samlConfiguration', 'oidcConfiguration'],
  basic: ['ldapConfiguration', 'samlConfiguration', 'oidcConfiguration'],
  'aws-cognito': [
    'ldapConfiguration',
    'samlConfiguration',
    'oidcConfiguration',
  ],
};

// Common fields to always remove from authentication configuration
export const COMMON_AUTH_FIELDS_TO_REMOVE = [
  'responseType',
  'jwtPrincipalClaimsMapping',
];

// Hardcoded authorizer values
export const DEFAULT_AUTHORIZER_CLASS_NAME =
  'org.openmetadata.service.security.DefaultAuthorizer';
export const DEFAULT_CONTAINER_REQUEST_FILTER =
  'org.openmetadata.service.security.JwtFilter';

// Common fields to always remove from authorizer configuration
export const COMMON_AUTHORIZER_FIELDS_TO_REMOVE = [
  'testPrincipals',
  'allowedEmailRegistrationDomains',
  'allowedDomains',
  'useRolesFromProvider',
];

// SAML security fields to remove
export const SAML_SECURITY_FIELDS_TO_REMOVE = [
  'validateXml',
  'sendEncryptedNameId',
  'signSpMetadata',
  'wantAssertionEncrypted',
  'keyStoreFilePath',
  'keyStoreAlias',
  'keyStorePassword',
];

// Providers that should hide bot principals
export const PROVIDERS_WITHOUT_BOT_PRINCIPALS = [
  'google',
  'auth0',
  'basic',
  'azure',
  'aws-cognito',
];

// Main SSO UI Schema generator
export const getSSOUISchema = (provider: string) => {
  const commonSchema = {
    authenticationConfiguration: {
      ...COMMON_HIDDEN_FIELDS,
      ...COMMON_FIELD_TITLES,
      ...(PROVIDER_UI_SCHEMAS[provider] || {}),
    },
    authorizerConfiguration: {
      ...AUTHORIZER_HIDDEN_FIELDS,
      ...AUTHORIZER_FIELD_TITLES,
      botPrincipals:
        BOT_PRINCIPALS_VISIBILITY[provider] ||
        AUTHORIZER_FIELD_TITLES.botPrincipals,
    },
  };

  return commonSchema;
};
