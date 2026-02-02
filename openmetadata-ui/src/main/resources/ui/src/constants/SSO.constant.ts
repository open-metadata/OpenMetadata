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
  getServerUrl,
} from '../utils/SSOURLUtils';

// Default callback URL for SSO configuration
export const DEFAULT_CALLBACK_URL = getCallbackUrl();

// OIDC-specific default values
export const OIDC_SSO_DEFAULTS = {
  tokenValidity: 3600,
  serverUrl: getServerUrl(),
  callbackUrl: getCallbackUrl(),
  sessionExpiry: 604800,
  preferredJwsAlgorithm: 'RS256',
  responseType: 'code',
  tokenValidationAlgorithm: 'RS256',
};

// Google-specific default values
export const GOOGLE_SSO_DEFAULTS = {
  authority: 'https://accounts.google.com',
  publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
  discoveryUri: 'https://accounts.google.com/.well-known/openid-configuration',
};

// SAML-specific default values
export const SAML_SSO_DEFAULTS = {
  authority: getAuthorityUrl(),
  clientType: 'public',
  jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
  idp: {},
  sp: {
    entityId: getServerUrl(),
    acs: getCallbackUrl(),
    callback: getCallbackUrl(),
  },
};

// Provider-specific schema field lists
export const OIDC_SPECIFIC_FIELDS = [
  'callbackUrl',
  'clientId',
  'authority',
  'publicKeyUrls',
];

export const NON_OIDC_SPECIFIC_FIELDS = [
  'ldapConfiguration',
  'samlConfiguration',
  'clientType',
];

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
    'ui:placeholder':
      'Enter scope (e.g. openid, email, profile) and press ENTER',
    'ui:field': 'ArrayField',
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
  forceSecureSessionCookie: { 'ui:widget': 'hidden', 'ui:hideError': true },
};

// Authorizer hidden fields
export const AUTHORIZER_HIDDEN_FIELDS = {
  testPrincipals: {
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
    usernameAttributeName: { 'ui:widget': 'hidden', 'ui:hideError': true },
    groupAttributeName: { 'ui:title': 'Group Attribute Name' },
    groupAttributeValue: { 'ui:title': 'Group Attribute Value' },
    groupMemberAttributeName: { 'ui:title': 'Group Member Attribute Name' },
    authRolesMapping: {
      'ui:title': 'Auth Roles Mapping',
      'ui:widget': 'LdapRoleMappingWidget',
      'ui:help':
        'Map LDAP groups to OpenMetadata roles. Users in mapped LDAP groups will automatically be assigned the corresponding roles.',
    },
    authReassignRoles: {
      'ui:title': 'Auth Reassign Roles',
      'ui:placeholder': 'Enter value (e.g. Admin, DataSteward) and press ENTER',
    },
    // Show truststoreConfigType when SSL is enabled
    truststoreConfigType: {
      'ui:title': 'Trust Store Config Type',
    },
    trustStoreConfig: {
      'ui:title': 'Trust Store Configuration',
      customTrustManagerConfig: {
        'ui:title':
          'Custom Trust Store Settings (Use when Trust Store Config Type = CustomTrustStore)',
        trustStoreFilePath: {
          'ui:title': 'Trust Store File Path',
          'ui:placeholder': '/opt/openmetadata/certs/ldap-truststore.jks',
        },
        trustStoreFilePassword: {
          'ui:title': 'Trust Store Password',
          'ui:widget': 'password',
        },
        trustStoreFileFormat: {
          'ui:title': 'Trust Store Format',
          'ui:placeholder': 'JKS',
        },
        verifyHostname: {
          'ui:title': 'Verify Hostname',
        },
        examineValidityDates: {
          'ui:title': 'Check Certificate Validity',
        },
      },
      hostNameConfig: {
        'ui:title':
          'Hostname Settings (Use when Trust Store Config Type = HostName)',
        allowWildCards: {
          'ui:title': 'Allow Wildcards',
        },
        acceptableHostNames: {
          'ui:title': 'Acceptable Host Names',
          'ui:options': {
            addable: true,
          },
        },
      },
      trustAllConfig: {
        'ui:title':
          'Trust All Settings (Use when Trust Store Config Type = TrustAll)',
        examineValidityDates: {
          'ui:title': 'Check Certificate Validity',
        },
      },
      jvmDefaultConfig: {
        'ui:title':
          'JVM Default Settings (Use when Trust Store Config Type = JVMDefault)',
        verifyHostname: {
          'ui:title': 'Verify Hostname',
        },
      },
    },
  },
  // Hide other provider configs for LDAP
  samlConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  oidcConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  // Hide universal settings managed in overview tab
  enableSelfSignup: { 'ui:title': 'Enable Self Signup' },
  // Hide clientType for LDAP as it defaults to public
  clientType: { 'ui:widget': 'hidden', 'ui:hideError': true },
  // Hide jwtPrincipalClaims for LDAP - default value auto-filled to prevent lockouts
  jwtPrincipalClaims: { 'ui:widget': 'hidden', 'ui:hideError': true },
  // Hide jwtPrincipalClaimsMapping for LDAP - not needed
  jwtPrincipalClaimsMapping: { 'ui:widget': 'hidden', 'ui:hideError': true },
  // Hide jwtTeamClaimMapping for LDAP - uses LDAP group mapping instead
  jwtTeamClaimMapping: { 'ui:widget': 'hidden', 'ui:hideError': true },
  // Hide publicKeyUrls for LDAP - uses internal LocalJwkProvider
  publicKeyUrls: { 'ui:widget': 'hidden', 'ui:hideError': true },
  // Hide tokenValidationAlgorithm for LDAP - global setting, default RS256 works correctly
  tokenValidationAlgorithm: { 'ui:widget': 'hidden', 'ui:hideError': true },
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
        'ui:widget': 'hidden',
        'ui:hideError': true,
      },
      idpX509Certificate: {
        'ui:title': 'IdP X.509 Certificate',
        'ui:widget': 'textarea',
      },
      nameId: { 'ui:title': 'Name ID Format' },
    },
    sp: {
      'ui:title': 'Service Provider (SP)',
      entityId: {
        'ui:title': 'SP Entity ID',
        'ui:readonly': true,
        'ui:help':
          'Auto-generated Service Provider Entity ID. Copy this value and paste it as Entity ID in your SAML Identity Provider configuration.',
      },
      acs: {
        'ui:title': 'Assertion Consumer Service URL',
        'ui:readonly': true,
        'ui:help':
          'Auto-generated Assertion Consumer Service URL. Copy this value and paste it as ACS URL (or Reply URL) in your SAML Identity Provider configuration.',
      },
      callback: { 'ui:widget': 'hidden', 'ui:hideError': true },
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
  // Hide jwtPrincipalClaims for SAML - default value auto-filled to prevent lockouts
  jwtPrincipalClaims: { 'ui:widget': 'hidden', 'ui:hideError': true },
  // Hide jwtPrincipalClaimsMapping for SAML - not used in SAML flow
  jwtPrincipalClaimsMapping: { 'ui:widget': 'hidden', 'ui:hideError': true },
  // Hide jwtTeamClaimMapping for SAML - not used in SAML flow
  jwtTeamClaimMapping: { 'ui:widget': 'hidden', 'ui:hideError': true },
  enableSelfSignup: { 'ui:title': 'Enable Self Signup' },
  // Hide clientType for SAML as it defaults to public
  clientType: { 'ui:widget': 'hidden', 'ui:hideError': true },
  // Hide root level authority and callbackUrl for SAML - will be managed via IDP/SP sections
  authority: { 'ui:widget': 'hidden', 'ui:hideError': true },
  clientId: COMMON_UI_FIELDS.clientId,
  callbackUrl: { 'ui:widget': 'hidden', 'ui:hideError': true },
  // Hide publicKeyUrls for SAML - uses internal LocalJwkProvider
  publicKeyUrls: { 'ui:widget': 'hidden', 'ui:hideError': true },
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
    preferredJwsAlgorithm: { 'ui:widget': 'hidden', 'ui:hideError': true },
    responseType: { 'ui:widget': 'hidden', 'ui:hideError': true },
    disablePkce: COMMON_UI_FIELDS.oidcDisablePkce,
    maxClockSkew: COMMON_UI_FIELDS.oidcMaxClockSkew,
    clientAuthenticationMethod: COMMON_UI_FIELDS.oidcClientAuthenticationMethod,
    tokenValidity: COMMON_UI_FIELDS.oidcTokenValidity,
    customParams: COMMON_UI_FIELDS.oidcCustomParameters,
    tenant: COMMON_UI_FIELDS.oidcTenant,
    serverUrl: { 'ui:widget': 'hidden', 'ui:hideError': true },
    callbackUrl: {
      'ui:title': 'OIDC Callback URL',
      'ui:readonly': true,
      'ui:help':
        'Auto-generated callback URL. Copy this and register it as Redirect URI in your OIDC provider configuration.',
    },
    maxAge: COMMON_UI_FIELDS.oidcMaxAge,
    prompt: COMMON_UI_FIELDS.oidcPrompt,
    sessionExpiry: COMMON_UI_FIELDS.oidcSessionExpiry,
  },
  // Hide LDAP/SAML specific fields for OIDC
  ldapConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  samlConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  tokenValidationAlgorithm: { 'ui:widget': 'hidden', 'ui:hideError': true },
  // Hide publicKeyUrls - auto-populated from OIDC discovery document for confidential clients
  publicKeyUrls: { 'ui:widget': 'hidden', 'ui:hideError': true },
};

// Standard OAuth/OIDC providers (Auth0, AWS Cognito) - hides clientAuthenticationMethod and tenant
export const STANDARD_OAUTH_UI_SCHEMA = {
  ldapConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  samlConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  oidcConfiguration: {
    ...COMMON_UI_FIELDS.oidcConfiguration,
    type: { 'ui:widget': 'hidden', 'ui:hideError': true },
    id: COMMON_UI_FIELDS.oidcClientId,
    secret: COMMON_UI_FIELDS.oidcClientSecret,
    scope: COMMON_UI_FIELDS.oidcScope,
    discoveryUri: COMMON_UI_FIELDS.oidcDiscoveryUri,
    useNonce: COMMON_UI_FIELDS.oidcUseNonce,
    preferredJwsAlgorithm: { 'ui:widget': 'hidden', 'ui:hideError': true },
    responseType: { 'ui:widget': 'hidden', 'ui:hideError': true },
    disablePkce: COMMON_UI_FIELDS.oidcDisablePkce,
    maxClockSkew: COMMON_UI_FIELDS.oidcMaxClockSkew,
    clientAuthenticationMethod: { 'ui:widget': 'hidden', 'ui:hideError': true },
    tokenValidity: COMMON_UI_FIELDS.oidcTokenValidity,
    customParams: COMMON_UI_FIELDS.oidcCustomParameters,
    tenant: { 'ui:widget': 'hidden', 'ui:hideError': true },
    serverUrl: { 'ui:widget': 'hidden', 'ui:hideError': true },
    callbackUrl: {
      'ui:title': 'OIDC Callback URL',
      'ui:readonly': true,
      'ui:help':
        'Auto-generated callback URL. Copy this and register it as Redirect URI in your OIDC provider configuration.',
    },
    maxAge: COMMON_UI_FIELDS.oidcMaxAge,
    prompt: COMMON_UI_FIELDS.oidcPrompt,
    sessionExpiry: COMMON_UI_FIELDS.oidcSessionExpiry,
  },
  tokenValidationAlgorithm: { 'ui:widget': 'hidden', 'ui:hideError': true },
  enableSelfSignup: { 'ui:title': 'Enable Self Signup' },
  // Hide publicKeyUrls - auto-populated from OIDC discovery document for confidential clients
  publicKeyUrls: { 'ui:widget': 'hidden', 'ui:hideError': true },
};

// Azure-specific UI schema with required tenant for confidential client
export const AZURE_OAUTH_UI_SCHEMA = {
  ldapConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  samlConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  oidcConfiguration: {
    ...COMMON_UI_FIELDS.oidcConfiguration,
    type: { 'ui:widget': 'hidden', 'ui:hideError': true },
    id: COMMON_UI_FIELDS.oidcClientId,
    secret: COMMON_UI_FIELDS.oidcClientSecret,
    scope: COMMON_UI_FIELDS.oidcScope,
    discoveryUri: COMMON_UI_FIELDS.oidcDiscoveryUri,
    useNonce: COMMON_UI_FIELDS.oidcUseNonce,
    preferredJwsAlgorithm: { 'ui:widget': 'hidden', 'ui:hideError': true },
    responseType: { 'ui:widget': 'hidden', 'ui:hideError': true },
    disablePkce: COMMON_UI_FIELDS.oidcDisablePkce,
    maxClockSkew: COMMON_UI_FIELDS.oidcMaxClockSkew,
    clientAuthenticationMethod: { 'ui:widget': 'hidden', 'ui:hideError': true },
    tokenValidity: COMMON_UI_FIELDS.oidcTokenValidity,
    customParams: COMMON_UI_FIELDS.oidcCustomParameters,
    tenant: COMMON_UI_FIELDS.oidcTenant,
    serverUrl: { 'ui:widget': 'hidden', 'ui:hideError': true },
    callbackUrl: {
      'ui:title': 'OIDC Callback URL',
      'ui:readonly': true,
      'ui:help':
        'Auto-generated callback URL. Copy this and register it as Redirect URI in your OIDC provider configuration.',
    },
    maxAge: COMMON_UI_FIELDS.oidcMaxAge,
    prompt: COMMON_UI_FIELDS.oidcPrompt,
    sessionExpiry: COMMON_UI_FIELDS.oidcSessionExpiry,
  },
  tokenValidationAlgorithm: { 'ui:widget': 'hidden', 'ui:hideError': true },
  enableSelfSignup: { 'ui:title': 'Enable Self Signup' },
  // Hide publicKeyUrls - auto-populated from OIDC discovery document for confidential clients
  publicKeyUrls: { 'ui:widget': 'hidden', 'ui:hideError': true },
};

// Okta-specific UI schema - keeps clientAuthenticationMethod visible, hides tenant
export const OKTA_OAUTH_UI_SCHEMA = {
  ldapConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  samlConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  oidcConfiguration: {
    ...COMMON_UI_FIELDS.oidcConfiguration,
    type: { 'ui:widget': 'hidden', 'ui:hideError': true },
    id: COMMON_UI_FIELDS.oidcClientId,
    secret: COMMON_UI_FIELDS.oidcClientSecret,
    scope: COMMON_UI_FIELDS.oidcScope,
    discoveryUri: COMMON_UI_FIELDS.oidcDiscoveryUri,
    useNonce: COMMON_UI_FIELDS.oidcUseNonce,
    preferredJwsAlgorithm: { 'ui:widget': 'hidden', 'ui:hideError': true },
    responseType: { 'ui:widget': 'hidden', 'ui:hideError': true },
    disablePkce: COMMON_UI_FIELDS.oidcDisablePkce,
    maxClockSkew: COMMON_UI_FIELDS.oidcMaxClockSkew,
    clientAuthenticationMethod: COMMON_UI_FIELDS.oidcClientAuthenticationMethod,
    tokenValidity: COMMON_UI_FIELDS.oidcTokenValidity,
    customParams: COMMON_UI_FIELDS.oidcCustomParameters,
    tenant: { 'ui:widget': 'hidden', 'ui:hideError': true },
    serverUrl: { 'ui:widget': 'hidden', 'ui:hideError': true },
    callbackUrl: {
      'ui:title': 'OIDC Callback URL',
      'ui:readonly': true,
      'ui:help':
        'Auto-generated callback URL. Copy this and register it as Redirect URI in your OIDC provider configuration.',
    },
    maxAge: COMMON_UI_FIELDS.oidcMaxAge,
    prompt: COMMON_UI_FIELDS.oidcPrompt,
    sessionExpiry: COMMON_UI_FIELDS.oidcSessionExpiry,
  },
  tokenValidationAlgorithm: { 'ui:widget': 'hidden', 'ui:hideError': true },
  enableSelfSignup: { 'ui:title': 'Enable Self Signup' },
  // Hide publicKeyUrls - auto-populated from OIDC discovery document for confidential clients
  publicKeyUrls: { 'ui:widget': 'hidden', 'ui:hideError': true },
};

// Google-specific UI schema
export const GOOGLE_OAUTH_UI_SCHEMA = {
  ldapConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  samlConfiguration: { 'ui:widget': 'hidden', 'ui:hideError': true },
  oidcConfiguration: {
    ...COMMON_UI_FIELDS.oidcConfiguration,
    type: { 'ui:widget': 'hidden', 'ui:hideError': true },
    id: COMMON_UI_FIELDS.oidcClientId,
    secret: COMMON_UI_FIELDS.oidcClientSecret,
    scope: COMMON_UI_FIELDS.oidcScope,
    discoveryUri: {
      'ui:title': 'OIDC Discovery URI',
      'ui:placeholder': GOOGLE_SSO_DEFAULTS.discoveryUri,
    },
    useNonce: COMMON_UI_FIELDS.oidcUseNonce,
    preferredJwsAlgorithm: { 'ui:widget': 'hidden', 'ui:hideError': true },
    responseType: { 'ui:widget': 'hidden', 'ui:hideError': true },
    disablePkce: COMMON_UI_FIELDS.oidcDisablePkce,
    maxClockSkew: COMMON_UI_FIELDS.oidcMaxClockSkew,
    clientAuthenticationMethod: { 'ui:widget': 'hidden', 'ui:hideError': true },
    tokenValidity: {
      'ui:title': 'OIDC Token Validity',
      'ui:placeholder': `Default: ${OIDC_SSO_DEFAULTS.tokenValidity}`,
    },
    customParams: COMMON_UI_FIELDS.oidcCustomParameters,
    tenant: { 'ui:widget': 'hidden', 'ui:hideError': true },
    serverUrl: { 'ui:widget': 'hidden', 'ui:hideError': true },
    callbackUrl: {
      'ui:title': 'OIDC Callback URL',
      'ui:readonly': true,
      'ui:help':
        'Auto-generated callback URL. Copy this and register it as Redirect URI in your OIDC provider configuration.',
    },
    maxAge: COMMON_UI_FIELDS.oidcMaxAge,
    prompt: COMMON_UI_FIELDS.oidcPrompt,
    sessionExpiry: {
      'ui:title': 'OIDC Session Expiry',
      'ui:placeholder': `Default: ${OIDC_SSO_DEFAULTS.sessionExpiry}`,
    },
  },
  authority: {
    'ui:title': 'Authority',
    'ui:placeholder': GOOGLE_SSO_DEFAULTS.authority,
  },
  // Hide publicKeyUrls - auto-populated from OIDC discovery document for confidential clients
  publicKeyUrls: { 'ui:widget': 'hidden', 'ui:hideError': true },
  tokenValidationAlgorithm: { 'ui:widget': 'hidden', 'ui:hideError': true },
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
    'ui:help':
      '⚠️ CRITICAL: Incorrect claims will lock out ALL users including admins! ' +
      'Order matters - first matching claim is used. ' +
      'These claims must exist in JWT tokens from your provider. ' +
      'Default values work for most configurations.',
  },
  jwtPrincipalClaimsMapping: {
    'ui:title': 'JWT Principal Claims Mapping',
    'ui:placeholder':
      'Enter mappings (e.g. username:preferred_username, email:email). Both username and email are required.',
  },
  enableSelfSignup: { 'ui:title': 'Enable Self Signup' },
  enableAutoRedirect: { 'ui:title': 'Enable Auto Redirect' },
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
  useRolesFromProvider: { 'ui:title': 'Use Roles From Provider' },
  allowedEmailRegistrationDomains: {
    'ui:title': 'Allowed Email Registration Domains',
    'ui:placeholder':
      'Enter domain (e.g. example.com) and press ENTER. Use "all" to allow all domains.',
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
  okta: OKTA_OAUTH_UI_SCHEMA,
  basic: STANDARD_OAUTH_UI_SCHEMA,
  'aws-cognito': STANDARD_OAUTH_UI_SCHEMA,
};

export const BOT_PRINCIPALS_VISIBILITY: Record<string, UISchemaField> = {
  google: { 'ui:widget': 'hidden', 'ui:hideError': true },
  auth0: { 'ui:widget': 'hidden', 'ui:hideError': true },
  basic: { 'ui:widget': 'hidden', 'ui:hideError': true },
  'aws-cognito': { 'ui:widget': 'hidden', 'ui:hideError': true },
  azure: { 'ui:widget': 'hidden', 'ui:hideError': true },
  okta: { 'ui:widget': 'hidden', 'ui:hideError': true },
  ldap: { 'ui:widget': 'hidden', 'ui:hideError': true },
  saml: { 'ui:widget': 'hidden', 'ui:hideError': true },
  'custom-oidc': { 'ui:widget': 'hidden', 'ui:hideError': true },
};

export const USE_ROLES_FROM_PROVIDER_VISIBILITY: Record<string, UISchemaField> =
  {
    ldap: { 'ui:widget': 'hidden', 'ui:hideError': true },
    saml: { 'ui:widget': 'hidden', 'ui:hideError': true },
  };

export const ALLOWED_EMAIL_REGISTRATION_DOMAINS_VISIBILITY: Record<
  string,
  UISchemaField
> = {
  ldap: { 'ui:widget': 'hidden', 'ui:hideError': true },
  saml: { 'ui:widget': 'hidden', 'ui:hideError': true },
  customoidc: { 'ui:widget': 'hidden', 'ui:hideError': true },
  google: { 'ui:widget': 'hidden', 'ui:hideError': true },
  auth0: { 'ui:widget': 'hidden', 'ui:hideError': true },
  azure: { 'ui:widget': 'hidden', 'ui:hideError': true },
  okta: { 'ui:widget': 'hidden', 'ui:hideError': true },
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
export const COMMON_AUTH_FIELDS_TO_REMOVE = [
  'responseType',
  'forceSecureSessionCookie',
];

// Hardcoded authorizer values
export const DEFAULT_AUTHORIZER_CLASS_NAME =
  'org.openmetadata.service.security.DefaultAuthorizer';
export const DEFAULT_CONTAINER_REQUEST_FILTER =
  'org.openmetadata.service.security.JwtFilter';

// Providers that should NOT include bot principals (deprecated field - no provider should have it)
export const PROVIDERS_WITHOUT_BOT_PRINCIPALS = [
  'google',
  'auth0',
  'basic',
  'aws-cognito',
  'azure',
  'okta',
  'ldap',
  'saml',
  'custom-oidc',
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
      useRolesFromProvider:
        USE_ROLES_FROM_PROVIDER_VISIBILITY[provider] ||
        AUTHORIZER_FIELD_TITLES.useRolesFromProvider,
      allowedEmailRegistrationDomains:
        ALLOWED_EMAIL_REGISTRATION_DOMAINS_VISIBILITY[provider] ||
        AUTHORIZER_FIELD_TITLES.allowedEmailRegistrationDomains,
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
  enableAutoRedirect?: boolean;
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
