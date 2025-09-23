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

import { ClientType } from '../generated/configuration/securityConfiguration';
import {
  getAuthorityUrl,
  getCallbackUrl,
  getDomainUrl,
  getServerUrl,
} from '../utils/SSOUtils';

// Default callback URL for SSO configuration
export const DEFAULT_CALLBACK_URL = getCallbackUrl();

// Google-specific default values
export const GOOGLE_SSO_DEFAULTS = {
  authority: 'https://accounts.google.com',
  publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
  discoveryUri: 'https://accounts.google.com/.well-known/openid-configuration',
  tokenValidity: 3600,
  sessionExpiry: 604800,
  serverUrl: getServerUrl(),
};

// SAML-specific default values
export const SAML_SSO_DEFAULTS = {
  authority: getAuthorityUrl(),
  idp: {
    authorityUrl: getAuthorityUrl(), // Note: field name is authorityUrl in IDP, not authority
  },
  sp: {
    entityId: getDomainUrl(),
    acs: getCallbackUrl(),
    callback: getCallbackUrl(),
  },
};

// Common UI field configurations to reduce duplication
export const COMMON_UI_FIELDS = {
  clientId: {
    'ui:title': 'Client ID',
    'ui:placeholder': 'e.g. 123456890-abcdef.apps.googleusercontent.com',
  },
  clientSecret: {
    'ui:title': 'Client Secret',
    'ui:widget': 'password',
    'ui:placeholder': 'Enter your client secret',
  },
  oidcClientId: {
    'ui:title': 'OIDC Client ID',
    'ui:placeholder': 'e.g. 123456890-abcdef.apps.googleusercontent.com',
  },
  oidcClientSecret: {
    'ui:title': 'OIDC Client Secret',
    'ui:widget': 'password',
    'ui:placeholder': 'Enter your OIDC client secret',
  },
  oidcScope: {
    'ui:title': 'OIDC Request Scopes',
    'ui:placeholder': 'e.g. openid email profile',
  },
  oidcDiscoveryUri: {
    'ui:title': 'OIDC Discovery URI',
    'ui:placeholder':
      'e.g. https://accounts.google.com/.well-known/openid_configuration',
  },
  oidcCallbackUrl: {
    'ui:title': 'OIDC Callback URL',
    'ui:placeholder': 'e.g. https://myapp.com/auth/callback',
  },
  oidcServerUrl: {
    'ui:title': 'OIDC Server URL',
    'ui:placeholder': 'e.g. https://your-domain.auth0.com',
  },
  oidcTenant: {
    'ui:title': 'OIDC Tenant',
    'ui:placeholder': 'e.g. your-tenant-id',
  },
  // Additional common OIDC fields
  oidcConfiguration: { 'ui:title': 'OIDC Configuration' },
  oidcIdpType: { 'ui:title': 'OIDC IDP Type' },
  oidcUseNonce: { 'ui:title': 'OIDC Use Nonce' },
  oidcPreferredJwsAlgorithm: { 'ui:title': 'OIDC Preferred JWS Algorithm' },
  oidcResponseType: { 'ui:title': 'OIDC Response Type' },
  oidcDisablePkce: { 'ui:title': 'OIDC Disable PKCE' },
  oidcMaxClockSkew: { 'ui:title': 'OIDC Max Clock Skew' },
  oidcClientAuthenticationMethod: {
    'ui:title': 'OIDC Client Authentication Method',
  },
  oidcTokenValidity: { 'ui:title': 'OIDC Token Validity' },
  oidcCustomParameters: { 'ui:title': 'OIDC Custom Parameters' },
  oidcMaxAge: { 'ui:title': 'OIDC Max Age' },
  oidcPrompt: { 'ui:title': 'OIDC Prompt' },
  oidcSessionExpiry: { 'ui:title': 'OIDC Session Expiry' },
  // Common non-OIDC fields
  authority: {
    'ui:title': 'Authority',
    'ui:placeholder': 'e.g. https://accounts.google.com',
  },
  callbackUrl: {
    'ui:title': 'Callback URL',
    'ui:placeholder': 'e.g. https://myapp.com/auth/callback',
  },
  publicKeyUrls: {
    'ui:title': 'Public Key URLs',
    'ui:placeholder':
      'Enter value (e.g. https://www.googleapis.com/oauth2/v3/certs) and press ENTER',
  },
};

// Common hidden fields for all providers
export const COMMON_HIDDEN_FIELDS = {
  responseType: { 'ui:widget': 'hidden', 'ui:hideError': true },
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
    host: {
      'ui:title': 'LDAP Host',
      'ui:placeholder': 'e.g. ldap.example.com',
    },
    port: {
      'ui:title': 'LDAP Port',
      'ui:placeholder': 'e.g. 389 or 636',
    },
    dnAdminPrincipal: {
      'ui:title': 'Admin Principal DN',
      'ui:placeholder': 'e.g. cn=admin,dc=example,dc=com',
    },
    dnAdminPassword: {
      'ui:title': 'Admin Password',
      'ui:widget': 'password',
      'ui:placeholder': 'Enter LDAP admin password',
    },
    userBaseDN: {
      'ui:title': 'User Base DN',
      'ui:placeholder': 'e.g. ou=users,dc=example,dc=com',
    },
    groupBaseDN: {
      'ui:title': 'Group Base DN',
      'ui:placeholder': 'e.g. ou=groups,dc=example,dc=com',
    },
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
    authRolesMapping: {
      'ui:title': 'Auth Roles Mapping',
      'ui:placeholder': 'Enter JSON string for role mappings',
    },
    authReassignRoles: {
      'ui:title': 'Auth Reassign Roles',
      'ui:placeholder': 'Enter value (e.g. Admin, DataSteward) and press ENTER',
    },
    // Hide trustStore fields as they are not commonly used
    truststoreConfigType: { 'ui:widget': 'hidden', 'ui:hideError': true },
    trustStoreConfig: { 'ui:widget': 'hidden', 'ui:hideError': true },
  },
  // Hide other provider configs for LDAP
  samlConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  oidcConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  // Hide universal settings managed in overview tab
  enableSelfSignup: { 'ui:title': 'Enable Self Signup' },
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
      authorityUrl: {
        'ui:title': 'Authority URL',
        'ui:placeholder': `Default: ${getAuthorityUrl()}`,
      },
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
      callback: { 'ui:title': 'Callback URL' },
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
  enableSelfSignup: { 'ui:title': 'Enable Self Signup' },
  // Hide clientType for SAML as it defaults to public
  clientType: { 'ui:widget': 'hidden', 'ui:hideError': true },
  // Hide root level authority and callbackUrl for SAML - will be managed via IDP/SP sections
  authority: { 'ui:widget': 'hidden', 'ui:hideError': true },
  clientId: COMMON_UI_FIELDS.clientId,
  callbackUrl: { 'ui:widget': 'hidden', 'ui:hideError': true },
  publicKeyUrls: { 'ui:title': 'Public Key URLs' },
};

// OIDC Configuration UI Schema
export const OIDC_UI_SCHEMA = {
  oidcConfiguration: {
    ...COMMON_UI_FIELDS.oidcConfiguration,
    type: COMMON_UI_FIELDS.oidcIdpType,
    id: COMMON_UI_FIELDS.oidcClientId,
    secret: COMMON_UI_FIELDS.oidcClientSecret,
    scope: COMMON_UI_FIELDS.oidcScope,
    discoveryUri: COMMON_UI_FIELDS.oidcDiscoveryUri,
    useNonce: COMMON_UI_FIELDS.oidcUseNonce,
    preferredJwsAlgorithm: COMMON_UI_FIELDS.oidcPreferredJwsAlgorithm,
    responseType: COMMON_UI_FIELDS.oidcResponseType,
    disablePkce: COMMON_UI_FIELDS.oidcDisablePkce,
    maxClockSkew: COMMON_UI_FIELDS.oidcMaxClockSkew,
    clientAuthenticationMethod: COMMON_UI_FIELDS.oidcClientAuthenticationMethod,
    tokenValidity: COMMON_UI_FIELDS.oidcTokenValidity,
    customParams: COMMON_UI_FIELDS.oidcCustomParameters,
    tenant: COMMON_UI_FIELDS.oidcTenant,
    serverUrl: COMMON_UI_FIELDS.oidcServerUrl,
    callbackUrl: COMMON_UI_FIELDS.oidcCallbackUrl,
    maxAge: COMMON_UI_FIELDS.oidcMaxAge,
    prompt: COMMON_UI_FIELDS.oidcPrompt,
    sessionExpiry: COMMON_UI_FIELDS.oidcSessionExpiry,
  },
  // Hide LDAP/SAML specific fields for OIDC
  ldapConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  samlConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
};

// Standard OAuth/OIDC providers (Auth0, Azure, Okta)
export const STANDARD_OAUTH_UI_SCHEMA = {
  ldapConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  samlConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  oidcConfiguration: {
    ...COMMON_UI_FIELDS.oidcConfiguration,
    type: COMMON_UI_FIELDS.oidcIdpType,
    id: COMMON_UI_FIELDS.oidcClientId,
    secret: COMMON_UI_FIELDS.oidcClientSecret,
    scope: COMMON_UI_FIELDS.oidcScope,
    discoveryUri: COMMON_UI_FIELDS.oidcDiscoveryUri,
    useNonce: COMMON_UI_FIELDS.oidcUseNonce,
    preferredJwsAlgorithm: COMMON_UI_FIELDS.oidcPreferredJwsAlgorithm,
    responseType: COMMON_UI_FIELDS.oidcResponseType,
    disablePkce: COMMON_UI_FIELDS.oidcDisablePkce,
    maxClockSkew: COMMON_UI_FIELDS.oidcMaxClockSkew,
    clientAuthenticationMethod: COMMON_UI_FIELDS.oidcClientAuthenticationMethod,
    tokenValidity: COMMON_UI_FIELDS.oidcTokenValidity,
    customParams: COMMON_UI_FIELDS.oidcCustomParameters,
    tenant: COMMON_UI_FIELDS.oidcTenant,
    serverUrl: COMMON_UI_FIELDS.oidcServerUrl,
    callbackUrl: COMMON_UI_FIELDS.oidcCallbackUrl,
    maxAge: COMMON_UI_FIELDS.oidcMaxAge,
    prompt: COMMON_UI_FIELDS.oidcPrompt,
    sessionExpiry: COMMON_UI_FIELDS.oidcSessionExpiry,
  },
  // Hide universal settings managed in overview tab
  enableSelfSignup: { 'ui:title': 'Enable Self Signup' },
};

// Azure-specific UI schema with required tenant for confidential client
export const AZURE_OAUTH_UI_SCHEMA = {
  ldapConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  samlConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  oidcConfiguration: {
    ...COMMON_UI_FIELDS.oidcConfiguration,
    type: COMMON_UI_FIELDS.oidcIdpType,
    id: COMMON_UI_FIELDS.oidcClientId,
    secret: COMMON_UI_FIELDS.oidcClientSecret,
    scope: COMMON_UI_FIELDS.oidcScope,
    discoveryUri: COMMON_UI_FIELDS.oidcDiscoveryUri,
    useNonce: COMMON_UI_FIELDS.oidcUseNonce,
    preferredJwsAlgorithm: COMMON_UI_FIELDS.oidcPreferredJwsAlgorithm,
    responseType: COMMON_UI_FIELDS.oidcResponseType,
    disablePkce: COMMON_UI_FIELDS.oidcDisablePkce,
    maxClockSkew: COMMON_UI_FIELDS.oidcMaxClockSkew,
    clientAuthenticationMethod: COMMON_UI_FIELDS.oidcClientAuthenticationMethod,
    tokenValidity: COMMON_UI_FIELDS.oidcTokenValidity,
    customParams: COMMON_UI_FIELDS.oidcCustomParameters,
    tenant: COMMON_UI_FIELDS.oidcTenant,
    serverUrl: COMMON_UI_FIELDS.oidcServerUrl,
    callbackUrl: COMMON_UI_FIELDS.oidcCallbackUrl,
    maxAge: COMMON_UI_FIELDS.oidcMaxAge,
    prompt: COMMON_UI_FIELDS.oidcPrompt,
    sessionExpiry: COMMON_UI_FIELDS.oidcSessionExpiry,
  },
  // Hide universal settings managed in overview tab
  enableSelfSignup: { 'ui:title': 'Enable Self Signup' },
};

// Google-specific UI schema
export const GOOGLE_OAUTH_UI_SCHEMA = {
  ldapConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  samlConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  oidcConfiguration: {
    ...COMMON_UI_FIELDS.oidcConfiguration,
    type: { 'ui:widget': 'hidden', 'ui:hideError': true }, // Hide type field for Google (same as provider name)
    id: COMMON_UI_FIELDS.oidcClientId,
    secret: COMMON_UI_FIELDS.oidcClientSecret,
    scope: COMMON_UI_FIELDS.oidcScope,
    discoveryUri: {
      'ui:title': 'OIDC Discovery URI',
      'ui:placeholder': GOOGLE_SSO_DEFAULTS.discoveryUri,
    },
    useNonce: COMMON_UI_FIELDS.oidcUseNonce,
    preferredJwsAlgorithm: COMMON_UI_FIELDS.oidcPreferredJwsAlgorithm,
    responseType: COMMON_UI_FIELDS.oidcResponseType,
    disablePkce: COMMON_UI_FIELDS.oidcDisablePkce,
    maxClockSkew: COMMON_UI_FIELDS.oidcMaxClockSkew,
    clientAuthenticationMethod: COMMON_UI_FIELDS.oidcClientAuthenticationMethod,
    tokenValidity: {
      'ui:title': 'OIDC Token Validity',
      'ui:placeholder': `Default: ${GOOGLE_SSO_DEFAULTS.tokenValidity}`,
    },
    customParams: COMMON_UI_FIELDS.oidcCustomParameters,
    tenant: { 'ui:widget': 'hidden', 'ui:hideError': true }, // Hide tenant for Google (not applicable)
    serverUrl: {
      'ui:title': 'OIDC Server URL',
      'ui:placeholder': 'e.g. http://localhost:8585',
    },
    callbackUrl: COMMON_UI_FIELDS.oidcCallbackUrl,
    maxAge: COMMON_UI_FIELDS.oidcMaxAge,
    prompt: COMMON_UI_FIELDS.oidcPrompt,
    sessionExpiry: {
      'ui:title': 'OIDC Session Expiry',
      'ui:placeholder': `Default: ${GOOGLE_SSO_DEFAULTS.sessionExpiry}`,
    },
  },
  // For public client mode
  authority: {
    'ui:title': 'Authority',
    'ui:placeholder': GOOGLE_SSO_DEFAULTS.authority,
  },
  publicKeyUrls: {
    'ui:title': 'Public Key URLs',
    'ui:placeholder': `Enter value (default: ${GOOGLE_SSO_DEFAULTS.publicKeyUrls[0]}) and press ENTER`,
  },
  // Hide universal settings managed in overview tab
  enableSelfSignup: { 'ui:title': 'Enable Self Signup' },
};

// Common field titles
export const COMMON_FIELD_TITLES = {
  provider: {
    'ui:title': 'Provider',
    'ui:options': { 'data-testid': 'sso-provider-field' },
  },
  providerName: {
    'ui:title': 'Provider Name',
    'ui:placeholder': 'e.g. My Company SSO',
  },
  authority: {
    'ui:title': 'Authority',
    'ui:placeholder': 'e.g. https://accounts.google.com',
  },
  clientId: COMMON_UI_FIELDS.clientId,
  callbackUrl: COMMON_UI_FIELDS.callbackUrl,
  publicKeyUrls: COMMON_UI_FIELDS.publicKeyUrls,
  tokenValidationAlgorithm: { 'ui:title': 'Token Validation Algorithm' },
  jwtPrincipalClaims: {
    'ui:title': 'JWT Principal Claims',
    'ui:placeholder': 'Enter value (e.g. email, sub, name) and press ENTER',
  },
  jwtPrincipalClaimsMapping: {
    'ui:title': 'JWT Principal Claims Mapping',
    'ui:placeholder':
      'Enter username:claim_name (e.g. username:preferred_username,email:email) and press ENTER.',
  },
  enableSelfSignup: { 'ui:title': 'Enable Self Signup' },
  clientType: {
    'ui:title': 'Client Type',
    'ui:widget': 'radio',
    'ui:options': {
      inline: true,
    },
  },
  secret: COMMON_UI_FIELDS.clientSecret,
};

// Authorizer field titles
export const AUTHORIZER_FIELD_TITLES = {
  className: { 'ui:widget': 'hidden', 'ui:hideError': true },
  containerRequestFilter: { 'ui:widget': 'hidden', 'ui:hideError': true },
  adminPrincipals: {
    'ui:title': 'Admin Principals',
    'ui:placeholder':
      'Enter value (e.g. admin@example.com, security@example.com) and press ENTER',
  },
  botPrincipals: {
    'ui:title': 'Bot Principals',
    'ui:placeholder':
      'Enter value (e.g. ingestion-bot@example.com) and press ENTER',
  },
  principalDomain: {
    'ui:title': 'Principal Domain',
    'ui:placeholder': 'e.g. https://accounts.google.com',
  },
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
  google: GOOGLE_OAUTH_UI_SCHEMA,
  auth0: STANDARD_OAUTH_UI_SCHEMA,
  azure: AZURE_OAUTH_UI_SCHEMA,
  okta: STANDARD_OAUTH_UI_SCHEMA,
  basic: STANDARD_OAUTH_UI_SCHEMA,
  'aws-cognito': STANDARD_OAUTH_UI_SCHEMA,
};

export const BOT_PRINCIPALS_VISIBILITY: Record<string, UISchemaField> = {
  google: { 'ui:widget': 'hidden', 'ui:hideError': true },
  auth0: { 'ui:widget': 'hidden', 'ui:hideError': true },
  basic: { 'ui:widget': 'hidden', 'ui:hideError': true },
  'aws-cognito': { 'ui:widget': 'hidden', 'ui:hideError': true },
};

// Provider-specific field removal mapping for cleanup
export const PROVIDER_FIELD_MAPPINGS: Record<string, string[]> = {
  ldap: ['samlConfiguration', 'oidcConfiguration', 'enableSelfSignup'],
  saml: [
    'ldapConfiguration',
    'oidcConfiguration',
    'tokenValidationAlgorithm',
    'enableSelfSignup',
  ],
  customoidc: ['ldapConfiguration', 'samlConfiguration', 'enableSelfSignup'],
  google: [
    'ldapConfiguration',
    'samlConfiguration',
    'oidcConfiguration',
    'enableSelfSignup',
  ],
  auth0: [
    'ldapConfiguration',
    'samlConfiguration',
    'oidcConfiguration',
    'enableSelfSignup',
  ],
  azure: [
    'ldapConfiguration',
    'samlConfiguration',
    'oidcConfiguration',
    'enableSelfSignup',
  ],
  okta: [
    'ldapConfiguration',
    'samlConfiguration',
    'oidcConfiguration',
    'enableSelfSignup',
  ],
  basic: [
    'ldapConfiguration',
    'samlConfiguration',
    'oidcConfiguration',
    'enableSelfSignup',
  ],
  'aws-cognito': [
    'ldapConfiguration',
    'samlConfiguration',
    'oidcConfiguration',
    'enableSelfSignup',
  ],
};

// Common fields to always remove from authentication configuration
export const COMMON_AUTH_FIELDS_TO_REMOVE = ['responseType'];

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

// Providers that should NOT include bot principals (only Azure and Okta should)
export const PROVIDERS_WITHOUT_BOT_PRINCIPALS = [
  'google',
  'auth0',
  'basic',
  'aws-cognito',
];

// Main SSO UI Schema generator
export const getSSOUISchema = (
  provider: string,
  hasExistingConfig?: boolean
) => {
  const providerSchema = PROVIDER_UI_SCHEMAS[provider] || {};

  // For new configurations (no existing SSO), show enableSelfSignup field
  // For existing SSO configurations, hide it (managed in overview tab)
  const enableSelfSignupSchema = hasExistingConfig
    ? { 'ui:widget': 'hidden', 'ui:hideError': true }
    : { 'ui:title': 'Enable Self Signup' };

  const commonSchema = {
    authenticationConfiguration: {
      'ui:title': ' ', // Hide the title with a space to prevent rendering
      ...COMMON_HIDDEN_FIELDS,
      ...COMMON_FIELD_TITLES,
      ...providerSchema,
      enableSelfSignup: enableSelfSignupSchema,
    },
    authorizerConfiguration: {
      'ui:title': ' ', // Hide the title with a space to prevent rendering
      ...AUTHORIZER_HIDDEN_FIELDS,
      ...AUTHORIZER_FIELD_TITLES,
      botPrincipals:
        BOT_PRINCIPALS_VISIBILITY[provider] ||
        AUTHORIZER_FIELD_TITLES.botPrincipals,
    },
  };

  return commonSchema;
};

export enum ValidationStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
}

export interface SecurityValidationResult {
  component: string;
  status: ValidationStatus;
  message: string;
}

export interface SecurityValidationResponse {
  status: ValidationStatus;
  message: string;
  results: SecurityValidationResult[];
}

export const VALIDATION_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
} as const;

export interface AuthenticationConfiguration {
  provider: string;
  providerName: string;
  authority: string;
  clientId: string;
  callbackUrl: string;
  publicKeyUrls: string[];
  tokenValidationAlgorithm: string;
  jwtPrincipalClaims: string[];
  jwtPrincipalClaimsMapping: string[];
  enableSelfSignup: boolean;
  clientType?: ClientType;
  secret?: string;
  ldapConfiguration?: Record<string, unknown>;
  samlConfiguration?: Record<string, unknown>;
  oidcConfiguration?: Record<string, unknown>;
}

export interface AuthorizerConfiguration {
  className: string;
  containerRequestFilter: string;
  adminPrincipals: string[];
  principalDomain: string;
  enforcePrincipalDomain: boolean;
  enableSecureSocketConnection: boolean;
  botPrincipals?: string[];
}
