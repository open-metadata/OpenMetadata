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

import Auth0Icon from '../assets/img/icon-auth0.png';
import CognitoIcon from '../assets/img/icon-aws-cognito.png';
import AzureIcon from '../assets/img/icon-azure.png';
import GoogleIcon from '../assets/img/icon-google.png';
import OktaIcon from '../assets/img/icon-okta.png';
import CustomOIDCIcon from '../assets/svg/ic-custom-oidc.svg';
import LdapIcon from '../assets/svg/ic-ldap.svg';
import SamlIcon from '../assets/svg/ic-saml.svg';

import { ErrorSchema } from '@rjsf/utils';
import { AxiosError } from 'axios';
import { isNil } from 'lodash';
import {
  AuthenticationConfiguration,
  AuthorizerConfiguration,
  DEFAULT_AUTHORIZER_CLASS_NAME,
  DEFAULT_CALLBACK_URL,
  DEFAULT_CONTAINER_REQUEST_FILTER,
  GOOGLE_SSO_DEFAULTS,
  OIDC_SSO_DEFAULTS,
  PROVIDERS_WITHOUT_BOT_PRINCIPALS,
  PROVIDER_FIELD_MAPPINGS,
  SAML_SSO_DEFAULTS,
} from '../constants/SSO.constant';
import { ClientType } from '../generated/configuration/securityConfiguration';
import { AuthProvider } from '../generated/settings/settings';

// FormData interface for SSO configuration
export interface FormData {
  authenticationConfiguration: AuthenticationConfiguration;
  authorizerConfiguration: AuthorizerConfiguration;
}

/**
 * Validates if a string is a valid URL
 * @param urlString - The URL string to validate
 * @returns True if the URL is valid, false otherwise
 */
export const isValidUrl = (urlString: string): boolean => {
  // Regular expression to validate HTTP/HTTPS URLs with hostname
  const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

  return urlRegex.test(urlString.trim());
};

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
      return LdapIcon;
    case AuthProvider.Saml:
      return SamlIcon;
    case AuthProvider.CustomOidc:
      return CustomOIDCIcon;
    default:
      return null;
  }
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
    icon: CustomOIDCIcon,
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

/**
 * Parses validation errors into nested ErrorSchema structure
 * @param errors - Array of validation errors with field paths and error messages
 * @returns ErrorSchema object with nested error structure
 * @example
 * parseValidationErrors([{ field: "authenticationConfiguration.clientId", error: "Required" }])
 * // Returns: { authenticationConfiguration: { clientId: { __errors: ["Required"] } } }
 */
export const parseValidationErrors = (
  errors: Array<{ field: string; error: string }>
): ErrorSchema => {
  const errorSchema: ErrorSchema = {};

  for (const error of errors) {
    // Parse the field path to create nested error structure
    // e.g., "authenticationConfiguration.oidcConfiguration.clientSecret" needs to become:
    // { authenticationConfiguration: { oidcConfiguration: { clientSecret: { __errors: ["..."] } } } }

    const pathParts = error.field.split('.');
    let current: ErrorSchema = errorSchema;

    // Navigate/create the nested structure
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];

      if (i === pathParts.length - 1) {
        // Last part - add the actual error
        current[part] ??= {};
        current[part].__errors = [error.error];
      } else {
        // Intermediate part - create nested object if needed
        current[part] ??= {};
        current = current[part] as ErrorSchema;
      }
    }
  }

  return errorSchema;
};

/**
 * Navigates to the target field in the error schema
 * @param errorSchema - The error schema to navigate
 * @param pathParts - Array of path parts to navigate
 * @returns The parent error schema and the target field key, or null if path doesn't exist
 */
const navigateToTargetField = (
  errorSchema: ErrorSchema,
  pathParts: string[]
): { parent: ErrorSchema; targetKey: string } | null => {
  let current = errorSchema;

  // Navigate to the parent of the target field
  const parentParts = pathParts.slice(0, -1);
  for (const part of parentParts) {
    if (!current[part]) {
      return null;
    }
    current = current[part] as ErrorSchema;
  }

  const targetKey = pathParts[pathParts.length - 1];
  if (!current[targetKey]) {
    return null;
  }

  return { parent: current, targetKey };
};

/**
 * Cleans up empty parent objects after deleting a field error
 * @param errorSchema - The root error schema
 * @param pathParts - Array of path parts (excluding the target field)
 */
const cleanupEmptyParents = (
  errorSchema: ErrorSchema,
  pathParts: string[]
): void => {
  let current = errorSchema;

  for (const part of pathParts) {
    if (!current[part] || typeof current[part] !== 'object') {
      break;
    }

    const obj = current[part] as ErrorSchema;
    if (Object.keys(obj).length === 0) {
      delete current[part];

      break;
    }

    current = obj;
  }
};

/**
 * Clears errors for a specific field path in the error schema
 * @param fieldErrorsRef - Reference object containing current field errors
 * @param fieldPath - Path to the field (e.g., "root/authenticationConfiguration/clientId")
 * @example
 * clearFieldError(fieldErrorsRef, "root/authenticationConfiguration/clientId")
 */
export const clearFieldError = (
  fieldErrorsRef: { current: ErrorSchema },
  fieldPath: string
): void => {
  if (
    !fieldErrorsRef.current ||
    Object.keys(fieldErrorsRef.current).length === 0
  ) {
    return;
  }

  const pathParts = fieldPath.replace(/^root\//, '').split('/');
  const navigation = navigateToTargetField(fieldErrorsRef.current, pathParts);

  if (!navigation) {
    return;
  }

  // Clear the target field error
  delete navigation.parent[navigation.targetKey];

  // Clean up empty parent objects
  const parentPaths = pathParts.slice(0, -1);
  cleanupEmptyParents(fieldErrorsRef.current, parentPaths);
};

/**
 * Provider-specific JWT principal claims defaults
 * These are known-good claims that work with each provider
 * Order matters - first matching claim is used for user identification
 */
const PROVIDER_JWT_PRINCIPAL_CLAIMS: Record<string, string[]> = {
  [AuthProvider.Google]: ['email', 'preferred_username', 'sub'],
  [AuthProvider.Azure]: ['preferred_username', 'email', 'upn', 'sub'],
  [AuthProvider.Okta]: ['email', 'preferred_username', 'sub'],
  [AuthProvider.Auth0]: ['email', 'name', 'sub'],
  [AuthProvider.AwsCognito]: ['email', 'cognito:username', 'sub'],
  [AuthProvider.CustomOidc]: ['email', 'preferred_username', 'sub'],
  [AuthProvider.LDAP]: ['email', 'preferred_username', 'sub'],
  [AuthProvider.Saml]: ['email', 'preferred_username', 'sub'],
};

/**
 * Gets provider-specific JWT principal claims
 * @param provider - The authentication provider
 * @returns Array of claim names in priority order
 */
const getProviderJwtClaims = (provider: AuthProvider): string[] => {
  return (
    PROVIDER_JWT_PRINCIPAL_CLAIMS[provider] || [
      'email',
      'preferred_username',
      'sub',
    ]
  );
};

/**
 * Gets default configuration values based on the selected provider
 * @param provider - The authentication provider
 * @param clientType - The client type (Public or Confidential)
 * @returns FormData object with provider-specific defaults
 */
export const getDefaultsForProvider = (
  provider: AuthProvider,
  clientType: ClientType
): FormData => {
  const isGoogle = provider === AuthProvider.Google;
  const isSaml = provider === AuthProvider.Saml;

  const {
    discoveryUri = '',
    authority = '',
    publicKeyUrls = [],
  } = isGoogle ? GOOGLE_SSO_DEFAULTS : {};

  const { tokenValidity, serverUrl, sessionExpiry } = OIDC_SSO_DEFAULTS;

  const authConfig: AuthenticationConfiguration = {
    provider: provider,
    providerName: provider,
    enableSelfSignup: true,
    clientType: clientType,
    authority: '',
    clientId: '',
    callbackUrl: '',
    publicKeyUrls: [],
    tokenValidationAlgorithm: 'RS256',
    jwtPrincipalClaims: getProviderJwtClaims(provider),
    jwtPrincipalClaimsMapping: [],
    // Always include authority and publicKeyUrls for Google (required by backend)
    ...(isGoogle
      ? {
          authority,
          publicKeyUrls,
        }
      : {}),
    // Add SAML-specific configuration
    ...(isSaml
      ? {
          authority: SAML_SSO_DEFAULTS.authority,
          publicKeyUrls: [],
          clientId: '',
          tokenValidationAlgorithm: 'RS256',
          samlConfiguration: {
            debugMode: false,
            idp: {
              entityId: '',
              ssoLoginUrl: '',
              authorityUrl: SAML_SSO_DEFAULTS.idp.authorityUrl,
              idpX509Certificate: '',
              nameId: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            },
            sp: {
              entityId: SAML_SSO_DEFAULTS.sp.entityId,
              acs: SAML_SSO_DEFAULTS.sp.acs,
              callback: SAML_SSO_DEFAULTS.sp.callback,
              spX509Certificate: '',
              spPrivateKey: '',
            },
            security: {
              strictMode: false,
              tokenValidity: 3600,
              wantAssertionsSigned: false,
              wantMessagesSigned: false,
              sendSignedAuthRequest: false,
            },
          },
        }
      : {}),
  };

  // For confidential clients, fields go in oidcConfiguration
  // For public clients, use root level fields (but not for SAML which has its own config)
  if (!isSaml && clientType === ClientType.Confidential) {
    authConfig.oidcConfiguration = {
      type: provider,
      id: '',
      secret: '',
      scope: 'openid email profile',
      discoveryUri,
      useNonce: false,
      preferredJwsAlgorithm: 'RS256',
      responseType: 'code',
      disablePkce: false,
      maxClockSkew: 0,
      clientAuthenticationMethod: 'client_secret_post',
      tokenValidity,
      customParams: {},
      tenant: '',
      serverUrl,
      callbackUrl: DEFAULT_CALLBACK_URL,
      maxAge: 0,
      prompt: '',
      sessionExpiry,
    };
  } else if (!isSaml) {
    // For public clients, use root level fields (excluding SAML)
    authConfig.authority = authority;
    authConfig.clientId = '';
    authConfig.callbackUrl = DEFAULT_CALLBACK_URL;
    authConfig.publicKeyUrls = publicKeyUrls;
  }

  return {
    authenticationConfiguration: authConfig,
    authorizerConfiguration: {
      className: DEFAULT_AUTHORIZER_CLASS_NAME,
      containerRequestFilter: DEFAULT_CONTAINER_REQUEST_FILTER,
      enforcePrincipalDomain: false,
      enableSecureSocketConnection: false,
      adminPrincipals: [],
      principalDomain: '',
    },
  };
};

/**
 * Handles OIDC configuration cleanup for confidential clients
 */
const cleanupOidcConfiguration = (
  authConfig: AuthenticationConfiguration,
  oidcConfig: Record<string, unknown>
): void => {
  if (typeof oidcConfig.id === 'string') {
    authConfig.clientId = oidcConfig.id;
  }
  if (typeof oidcConfig.callbackUrl === 'string') {
    authConfig.callbackUrl = oidcConfig.callbackUrl;
  }
  if (typeof oidcConfig.serverUrl === 'string') {
    oidcConfig.serverUrl = oidcConfig.serverUrl.replace(/\/callback\/?$/, '');
  }
};

/**
 * Cleans authentication configuration
 */
const cleanupAuthenticationConfig = (
  authConfig: AuthenticationConfiguration,
  provider: string
): void => {
  if (provider === AuthProvider.Saml || provider === AuthProvider.LDAP) {
    authConfig.clientType = ClientType.Public;
  }

  const fieldsToRemove = PROVIDER_FIELD_MAPPINGS[provider] || [
    'ldapConfiguration',
    'samlConfiguration',
    'oidcConfiguration',
  ];

  const isPublicClient = authConfig.clientType === ClientType.Public;
  if (isPublicClient) {
    for (const field of fieldsToRemove) {
      delete authConfig[field as keyof AuthenticationConfiguration];
    }
    delete authConfig.secret;
  } else {
    for (const field of fieldsToRemove.filter(
      (field) => field !== 'oidcConfiguration'
    )) {
      delete authConfig[field as keyof AuthenticationConfiguration];
    }
  }

  if (!isPublicClient && authConfig.oidcConfiguration) {
    const oidcConfig = authConfig.oidcConfiguration;
    cleanupOidcConfiguration(authConfig, oidcConfig);
  }

  authConfig.enableSelfSignup ??= true;
};

/**
 * Cleans authorizer configuration
 */
const cleanupAuthorizerConfig = (
  authorizerConfig: AuthorizerConfiguration,
  provider: string
): void => {
  if (PROVIDERS_WITHOUT_BOT_PRINCIPALS.includes(provider)) {
    delete authorizerConfig.botPrincipals;
  }

  authorizerConfig.enforcePrincipalDomain ??= false;
  authorizerConfig.enableSecureSocketConnection ??= false;
  authorizerConfig.className = DEFAULT_AUTHORIZER_CLASS_NAME;
  authorizerConfig.containerRequestFilter = DEFAULT_CONTAINER_REQUEST_FILTER;
};

/**
 * Extracts matching trust store configuration
 */
const extractTrustStoreConfig = (
  trustStoreConfig: Record<string, unknown>,
  truststoreFormat: string
): Record<string, unknown> => {
  const configMap: Record<string, string> = {
    CustomTrustStore: 'customTrustManagerConfig',
    HostName: 'hostNameConfig',
    JVMDefault: 'jvmDefaultConfig',
    TrustAll: 'trustAllConfig',
  };

  const configKey = configMap[truststoreFormat];
  if (configKey && trustStoreConfig[configKey]) {
    return { [configKey]: trustStoreConfig[configKey] };
  }

  return {};
};

/**
 * Cleans LDAP configuration
 */
const cleanupLdapConfig = (ldapConfig: Record<string, unknown>): void => {
  ldapConfig.isFullDn ??= false;
  ldapConfig.sslEnabled ??= false;

  if (ldapConfig.trustStoreConfig && ldapConfig.truststoreFormat) {
    const trustStoreConfig = ldapConfig.trustStoreConfig as Record<
      string,
      unknown
    >;
    ldapConfig.trustStoreConfig = extractTrustStoreConfig(
      trustStoreConfig,
      ldapConfig.truststoreFormat as string
    );
  }
};

/**
 * Cleans SAML IDP configuration
 */
const cleanupSamlIdp = (
  idpConfig: Record<string, unknown>,
  authConfig: AuthenticationConfiguration
): void => {
  if (typeof idpConfig.authorityUrl === 'string') {
    authConfig.authority = idpConfig.authorityUrl;
  }
  if (typeof idpConfig.idpX509Certificate === 'string') {
    idpConfig.idpX509Certificate = idpConfig.idpX509Certificate.replaceAll(
      String.raw`\n`,
      '\n'
    );
  }
};

/**
 * Cleans SAML SP configuration
 */
const cleanupSamlSp = (
  spConfig: Record<string, unknown>,
  authConfig: AuthenticationConfiguration
): void => {
  if (typeof spConfig.callback === 'string') {
    authConfig.callbackUrl = spConfig.callback;
    spConfig.acs = spConfig.callback;
  }
  if (typeof spConfig.spX509Certificate === 'string') {
    spConfig.spX509Certificate = spConfig.spX509Certificate.replaceAll(
      String.raw`\n`,
      '\n'
    );
  }
  if (typeof spConfig.spPrivateKey === 'string') {
    spConfig.spPrivateKey = spConfig.spPrivateKey.replaceAll(
      String.raw`\n`,
      '\n'
    );
  }
};

/**
 * Cleans SAML security configuration
 */
const cleanupSamlSecurity = (securityConfig: Record<string, unknown>): void => {
  securityConfig.strictMode ??= false;
  securityConfig.wantAssertionsSigned ??= false;
  securityConfig.wantMessagesSigned ??= false;
  securityConfig.sendSignedAuthRequest ??= false;
};

/**
 * Cleans SAML configuration
 */
const cleanupSamlConfig = (
  samlConfig: Record<string, unknown>,
  authConfig: AuthenticationConfiguration
): void => {
  samlConfig.debugMode ??= false;

  if (samlConfig.idp && typeof samlConfig.idp === 'object') {
    cleanupSamlIdp(samlConfig.idp as Record<string, unknown>, authConfig);
  }

  if (samlConfig.sp && typeof samlConfig.sp === 'object') {
    cleanupSamlSp(samlConfig.sp as Record<string, unknown>, authConfig);
  }

  if (samlConfig.security) {
    cleanupSamlSecurity(samlConfig.security as Record<string, unknown>);
  }
};

/**
 * Cleans up provider-specific fields from configuration data before submission
 * @param data - The form data to clean up
 * @param provider - The authentication provider
 * @returns Cleaned FormData with provider-specific fields removed
 */
export const cleanupProviderSpecificFields = (
  data: FormData | undefined,
  provider: string
): FormData | undefined => {
  if (!data) {
    return undefined;
  }

  const cleanedData = { ...data };

  if (cleanedData.authenticationConfiguration) {
    cleanupAuthenticationConfig(
      cleanedData.authenticationConfiguration,
      provider
    );
  }

  if (cleanedData.authorizerConfiguration) {
    cleanupAuthorizerConfig(cleanedData.authorizerConfiguration, provider);
  }

  if (cleanedData.authenticationConfiguration?.ldapConfiguration) {
    cleanupLdapConfig(
      cleanedData.authenticationConfiguration.ldapConfiguration
    );
  }

  if (cleanedData.authenticationConfiguration?.samlConfiguration) {
    cleanupSamlConfig(
      cleanedData.authenticationConfiguration.samlConfiguration,
      cleanedData.authenticationConfiguration
    );
  }

  return cleanedData;
};

/**
 * Finds changed fields between two objects recursively
 * @param oldData - The original data object
 * @param newData - The updated data object
 * @param path - Current path in the object hierarchy
 * @returns Array of field paths that have changed (e.g., ["root/authenticationConfiguration/clientId"])
 */
export const findChangedFields = (
  oldData: unknown,
  newData: unknown,
  path: string[] = []
): string[] => {
  const changedFields: string[] = [];

  if (!oldData || !newData) {
    return changedFields;
  }

  // Type guard to check if value is an object
  const isObject = (val: unknown): val is Record<string, unknown> => {
    return typeof val === 'object' && val !== null && !Array.isArray(val);
  };

  if (!isObject(oldData) || !isObject(newData)) {
    return changedFields;
  }

  // Get all keys from both objects
  const allKeys = new Set([
    ...Object.keys(oldData || {}),
    ...Object.keys(newData || {}),
  ]);

  for (const key of allKeys) {
    const currentPath = [...path, key];
    const oldValue = oldData[key];
    const newValue = newData[key];

    // Check if values are different
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      // If the value is an object, recursively check for nested changes
      if (isObject(newValue)) {
        changedFields.push(
          ...findChangedFields(oldValue, newValue, currentPath)
        );
      } else {
        // Value has changed, add the field path
        changedFields.push('root/' + currentPath.join('/'));
      }
    }
  }

  return changedFields;
};

/**
 * Type for SAML authentication configuration
 */
type SamlAuthConfig = AuthenticationConfiguration & {
  samlConfiguration?: {
    idp?: { authorityUrl?: string };
    sp?: { callback?: string; acs?: string };
  };
};

/**
 * Populates SAML IDP authority URL from root authority or defaults
 * @param authConfig - SAML authentication configuration
 */
export const populateSamlIdpAuthority = (authConfig: SamlAuthConfig): void => {
  if (!authConfig.samlConfiguration?.idp) {
    return;
  }

  if (authConfig.authority) {
    authConfig.samlConfiguration.idp.authorityUrl = authConfig.authority;
  } else if (!authConfig.samlConfiguration.idp.authorityUrl) {
    authConfig.samlConfiguration.idp.authorityUrl =
      SAML_SSO_DEFAULTS.idp.authorityUrl;
  }
};

/**
 * Populates SAML SP callback URLs from root callbackUrl
 * Only populates if the fields are empty (doesn't overwrite existing values from database)
 * @param authConfig - SAML authentication configuration
 */
export const populateSamlSpCallback = (authConfig: SamlAuthConfig): void => {
  if (!authConfig.callbackUrl || !authConfig.samlConfiguration?.sp) {
    return;
  }

  // Only set callback if it's empty (don't overwrite existing database values)
  if (!authConfig.samlConfiguration.sp.callback) {
    authConfig.samlConfiguration.sp.callback = authConfig.callbackUrl;
  }

  // Only set acs if it's empty (don't overwrite existing database values)
  // This preserves old URLs like /api/v1/saml/acs for existing users
  if (!authConfig.samlConfiguration.sp.acs) {
    authConfig.samlConfiguration.sp.acs = authConfig.callbackUrl;
  }
};

/**
 * Applies SAML-specific configuration by populating IDP and SP fields
 * @param configData - Form data containing authentication configuration
 */
export const applySamlConfiguration = (configData: FormData): void => {
  const authConfig = configData.authenticationConfiguration as SamlAuthConfig;

  if (!authConfig.samlConfiguration) {
    return;
  }

  populateSamlIdpAuthority(authConfig);
  populateSamlSpCallback(authConfig);
};

/**
 * Determines the default client type for a given provider
 * @param provider - The authentication provider
 * @returns The default client type (Public or Confidential)
 */
export const getDefaultClientType = (provider: AuthProvider): ClientType => {
  // SAML and LDAP are always public clients, OAuth providers default to confidential but can be changed
  return provider === AuthProvider.Saml || provider === AuthProvider.LDAP
    ? ClientType.Public
    : ClientType.Confidential;
};

/**
 * Creates fresh form data for a new provider with all required fields
 * @param provider - The authentication provider
 * @returns FormData object with provider-specific defaults
 */
export const createFreshFormData = (provider: AuthProvider): FormData => {
  const defaultClientType = getDefaultClientType(provider);
  const defaults = getDefaultsForProvider(provider, defaultClientType);

  return defaults;
};

/**
 * Removes specified fields from a schema's properties object
 * @param schema - The schema object to modify
 * @param fieldsToRemove - Array of field names to remove
 */
export const removeSchemaFields = (
  schema: Record<string, unknown>,
  fieldsToRemove: string[]
): void => {
  if (!schema.properties || typeof schema.properties !== 'object') {
    return;
  }

  const properties = schema.properties as Record<string, unknown>;
  for (const field of fieldsToRemove) {
    if (properties[field]) {
      delete properties[field];
    }
  }
};

/**
 * Removes specified fields from a schema's required array
 * @param schema - The schema object to modify
 * @param fieldsToRemove - Array of field names to remove from required
 */
export const removeRequiredFields = (
  schema: Record<string, unknown>,
  fieldsToRemove: string[]
): void => {
  if (!schema.required || !Array.isArray(schema.required)) {
    return;
  }

  schema.required = (schema.required as string[]).filter(
    (field) => !fieldsToRemove.includes(field)
  );
};

/**
 * Handles switching from Confidential to Public client type
 * Moves callback URL from OIDC config to root level and adds Google-specific defaults if applicable
 * @param authConfig - Authentication configuration to modify
 */
export const handleConfidentialToPublicSwitch = (
  authConfig: AuthenticationConfiguration
): void => {
  const oidcConfig = authConfig.oidcConfiguration;

  // Move callback URL from OIDC to root level
  authConfig.callbackUrl ??=
    (oidcConfig?.callbackUrl as string) ?? DEFAULT_CALLBACK_URL;

  // For Google SSO, prepopulate Authority and Public Key URLs when switching to Public
  const isGoogle = authConfig.provider === AuthProvider.Google;
  if (isGoogle) {
    authConfig.authority = GOOGLE_SSO_DEFAULTS.authority;
    authConfig.publicKeyUrls = GOOGLE_SSO_DEFAULTS.publicKeyUrls;
  }
};

/**
 * Handles switching from Public to Confidential client type
 * Moves callback URL from root to OIDC config and adds Google-specific OIDC defaults if applicable
 * @param authConfig - Authentication configuration to modify
 */
export const handlePublicToConfidentialSwitch = (
  authConfig: AuthenticationConfiguration
): void => {
  // Initialize OIDC configuration if it doesn't exist
  authConfig.oidcConfiguration ??= {};

  const oidcConfig = authConfig.oidcConfiguration;

  // Move callback URL from root to OIDC
  oidcConfig.callbackUrl ??= authConfig.callbackUrl ?? DEFAULT_CALLBACK_URL;

  // For Google SSO, prepopulate OIDC fields when switching to Confidential
  const isGoogle = authConfig.provider === AuthProvider.Google;
  if (isGoogle) {
    oidcConfig.type = AuthProvider.Google;
    oidcConfig.discoveryUri = GOOGLE_SSO_DEFAULTS.discoveryUri;
    oidcConfig.tokenValidity = OIDC_SSO_DEFAULTS.tokenValidity;
    oidcConfig.sessionExpiry = OIDC_SSO_DEFAULTS.sessionExpiry;
    oidcConfig.serverUrl = OIDC_SSO_DEFAULTS.serverUrl;
    // Set default values for other required OIDC fields
    oidcConfig.scope = oidcConfig.scope || 'openid email profile';
    oidcConfig.useNonce = oidcConfig.useNonce ?? false;
    oidcConfig.preferredJwsAlgorithm =
      oidcConfig.preferredJwsAlgorithm || 'RS256';
    oidcConfig.responseType = oidcConfig.responseType || 'code';
    oidcConfig.disablePkce = oidcConfig.disablePkce ?? false;
    oidcConfig.maxClockSkew = oidcConfig.maxClockSkew ?? 0;
    oidcConfig.clientAuthenticationMethod =
      oidcConfig.clientAuthenticationMethod || 'client_secret_post';
  }
};

/**
 * Handles client type transitions for authentication configuration
 * Migrates fields between root and OIDC configuration based on client type change
 * @param authConfig - Authentication configuration to modify
 * @param previousClientType - The previous client type (undefined if not set)
 * @param newClientType - The new client type (undefined if not set)
 */
export const handleClientTypeChange = (
  authConfig: AuthenticationConfiguration | undefined,
  previousClientType: ClientType | undefined,
  newClientType: ClientType | undefined
): void => {
  // Early return if no auth config or client type hasn't changed
  if (!authConfig || !newClientType || previousClientType === newClientType) {
    return;
  }

  // Handle Confidential → Public transition
  if (
    newClientType === ClientType.Public &&
    previousClientType === ClientType.Confidential
  ) {
    handleConfidentialToPublicSwitch(authConfig);
  }
  // Handle Public → Confidential transition
  else if (
    newClientType === ClientType.Confidential &&
    previousClientType === ClientType.Public
  ) {
    handlePublicToConfidentialSwitch(authConfig);
  }
};

/**
 * Checks if a provider is valid (non-Basic) SSO provider
 * @param config - Security configuration to check
 * @returns true if configuration has a valid non-Basic provider
 */
export const isValidNonBasicProvider = (
  config: { authenticationConfiguration?: { provider?: string } } | undefined
): boolean => {
  return (
    !!config?.authenticationConfiguration?.provider &&
    config.authenticationConfiguration.provider !== AuthProvider.Basic
  );
};

/**
 * Extracts meaningful field name from RJSF field ID
 * Maps field IDs like "root/authenticationConfiguration/clientId" to "clientId"
 * Also handles field mappings for documentation purposes
 * @param fieldId - The RJSF field ID to extract from
 * @returns The extracted and mapped field name
 */
export const extractFieldName = (fieldId: string): string => {
  // Extract meaningful field name from RJSF field ID
  // Examples:
  // "root/authenticationConfiguration/clientId" -> "clientId"
  // "root/authenticationConfiguration/authority" -> "authority"
  const parts = fieldId.split('/');
  const lastPart = parts.at(-1) ?? '';

  // Handle common field mappings for SSO documentation
  const fieldMappings: Record<string, string> = {
    clientSecret: 'clientSecret',
    secret: 'clientSecret', // Map 'secret' to 'clientSecret' for documentation
    authority: 'authority',
    domain: 'authority', // Auth0 uses 'domain' but docs show 'authority'
    callbackUrl: 'callbackUrl',
    enableSelfSignup: 'enableSelfSignup',
    scopes: 'scopes',
    secretKey: 'clientSecret', // Auth0 secret key maps to clientSecret
    oidcConfiguration: 'oidcConfiguration',
    samlConfiguration: 'samlConfiguration',
    ldapConfiguration: 'ldapConfiguration',
    providerName: 'providerName',
  };

  return fieldMappings[lastPart] || lastPart;
};

/**
 * Creates a DOM focus handler that extracts field names and sets active field state
 * @param setActiveField - State setter for active field
 * @returns Focus event handler
 */
export const createDOMFocusHandler =
  (setActiveField: (field: string) => void) =>
  (event: FocusEvent): void => {
    const target = event.target as HTMLElement;
    // Look for the closest field container with an id
    let element: HTMLElement | null = target;
    while (element && element !== document.body) {
      if (element.id?.includes('root')) {
        const fieldName = extractFieldName(element.id);
        setActiveField(fieldName);

        break;
      }
      element = element.parentElement;
    }
  };

/**
 * Creates a DOM click handler that extracts field names and sets active field state
 * @param setActiveField - State setter for active field
 * @returns Mouse event handler
 */
export const createDOMClickHandler =
  (setActiveField: (field: string) => void) =>
  (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    // Look for the closest field container with an id
    let element: HTMLElement | null = target;
    while (element && element !== document.body) {
      if (element.id?.includes('root')) {
        const fieldName = extractFieldName(element.id);
        setActiveField(fieldName);

        break;
      }
      element = element.parentElement;
    }
  };

/**
 * Updates loading state conditionally based on isModalSave flag
 * @param isModalSave - Whether save is triggered from modal
 * @param setIsLoading - Loading state setter
 * @param value - New loading state value
 */
export const updateLoadingState = (
  isModalSave: boolean,
  setIsLoading: (value: boolean) => void,
  value: boolean
): void => {
  if (!isModalSave) {
    setIsLoading(value);
  }
};

/**
 * Checks if error response contains field-level validation errors
 * @param error - Error object to check
 * @returns True if error contains field-level validation errors
 */
export const hasFieldValidationErrors = (
  error: unknown
): error is {
  response: {
    data: { status: string; errors: Array<{ field: string; error: string }> };
  };
} => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const axiosError = error as AxiosError;

  return (
    !isNil(axiosError.response?.data) &&
    typeof axiosError.response.data === 'object' &&
    'errors' in axiosError.response.data
  );
};
