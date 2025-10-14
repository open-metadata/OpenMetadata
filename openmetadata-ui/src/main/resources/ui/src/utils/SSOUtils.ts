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
import {
  AuthenticationConfiguration,
  AuthorizerConfiguration,
  COMMON_AUTHORIZER_FIELDS_TO_REMOVE,
  COMMON_AUTH_FIELDS_TO_REMOVE,
  DEFAULT_AUTHORIZER_CLASS_NAME,
  DEFAULT_CALLBACK_URL,
  DEFAULT_CONTAINER_REQUEST_FILTER,
  GOOGLE_SSO_DEFAULTS,
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

// JsonPatchOperation interface for configuration updates
export interface JsonPatchOperation {
  op: 'replace' | 'add' | 'remove';
  path: string;
  value?:
    | string
    | number
    | boolean
    | Record<string, unknown>
    | unknown[]
    | null;
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

  errors.forEach((error) => {
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
        if (!current[part]) {
          current[part] = {};
        }
        current[part].__errors = [error.error];
      } else {
        // Intermediate part - create nested object if needed
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part] as ErrorSchema;
      }
    }
  });

  return errorSchema;
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

  // Parse the field path (e.g., "root/authenticationConfiguration/adminPrincipals")
  const pathParts = fieldPath.replace(/^root\//, '').split('/');

  let current = fieldErrorsRef.current;

  // Navigate through the error structure
  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];

    if (!current[part]) {
      // Path doesn't exist in errors, nothing to clear
      return;
    }

    if (i === pathParts.length - 1) {
      // We're at the target field, clear its errors
      delete current[part];

      // Clean up empty parent objects
      let cleanupCurrent = fieldErrorsRef.current;
      const cleanupParts = pathParts.slice(0, -1);

      for (let j = 0; j < cleanupParts.length; j++) {
        const cleanupPart = cleanupParts[j];
        if (
          cleanupCurrent[cleanupPart] &&
          typeof cleanupCurrent[cleanupPart] === 'object'
        ) {
          const obj = cleanupCurrent[cleanupPart] as ErrorSchema;
          if (Object.keys(obj).length === 0) {
            delete cleanupCurrent[cleanupPart];

            break;
          }
          cleanupCurrent = obj;
        }
      }
    } else {
      // Navigate deeper
      current = current[part] as ErrorSchema;
    }
  }
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
    jwtPrincipalClaims: [],
    jwtPrincipalClaimsMapping: [],
    // Always include authority and publicKeyUrls for Google (required by backend)
    ...(isGoogle
      ? {
          authority: GOOGLE_SSO_DEFAULTS.authority,
          publicKeyUrls: GOOGLE_SSO_DEFAULTS.publicKeyUrls,
        }
      : {}),
    // Add SAML-specific configuration
    ...(isSaml
      ? {
          authority: SAML_SSO_DEFAULTS.authority,
          publicKeyUrls: [],
          clientId: '',
          tokenValidationAlgorithm: 'RS256',
          jwtPrincipalClaims: [],
          jwtPrincipalClaimsMapping: [],
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
      discoveryUri: isGoogle ? GOOGLE_SSO_DEFAULTS.discoveryUri : '',
      useNonce: false,
      preferredJwsAlgorithm: 'RS256',
      responseType: 'code',
      disablePkce: false,
      maxClockSkew: 0,
      clientAuthenticationMethod: 'client_secret_post',
      tokenValidity: isGoogle ? GOOGLE_SSO_DEFAULTS.tokenValidity : 0,
      customParams: {},
      tenant: '',
      serverUrl: isGoogle ? GOOGLE_SSO_DEFAULTS.serverUrl : '',
      callbackUrl: DEFAULT_CALLBACK_URL,
      maxAge: 0,
      prompt: '',
      sessionExpiry: isGoogle ? GOOGLE_SSO_DEFAULTS.sessionExpiry : 0,
    };
  } else if (!isSaml) {
    // For public clients, use root level fields (excluding SAML)
    authConfig.authority = isGoogle ? GOOGLE_SSO_DEFAULTS.authority : '';
    authConfig.clientId = '';
    authConfig.callbackUrl = DEFAULT_CALLBACK_URL;
    authConfig.publicKeyUrls = isGoogle
      ? GOOGLE_SSO_DEFAULTS.publicKeyUrls
      : [];
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
    const authConfig = cleanedData.authenticationConfiguration;

    // Remove common unwanted fields that might persist
    COMMON_AUTH_FIELDS_TO_REMOVE.forEach(
      (field) => delete authConfig[field as keyof AuthenticationConfiguration]
    );

    // Set clientType to Public for SAML and LDAP providers
    if (provider === AuthProvider.Saml || provider === AuthProvider.LDAP) {
      authConfig.clientType = ClientType.Public;
    }

    // Remove provider-specific configs that shouldn't be sent
    const fieldsToRemove = PROVIDER_FIELD_MAPPINGS[provider] || [
      'ldapConfiguration',
      'samlConfiguration',
      'oidcConfiguration',
    ];

    // Handle oidcConfiguration based on client type
    if (authConfig.clientType === ClientType.Public) {
      // For public clients, remove oidcConfiguration entirely
      fieldsToRemove.forEach(
        (field) => delete authConfig[field as keyof AuthenticationConfiguration]
      );
      // Also remove secret from root level for public clients
      delete authConfig.secret;
    } else {
      // For confidential clients, keep oidcConfiguration but remove other provider configs
      const fieldsToActuallyRemove = fieldsToRemove.filter(
        (field) => field !== 'oidcConfiguration'
      );
      fieldsToActuallyRemove.forEach(
        (field) => delete authConfig[field as keyof AuthenticationConfiguration]
      );

      // For confidential clients, populate clientId and callbackUrl from OIDC configuration
      // since they are hidden in the UI but needed in the authentication object
      if (
        authConfig.clientType === ClientType.Confidential &&
        authConfig.oidcConfiguration
      ) {
        const oidcConfig = authConfig.oidcConfiguration as Record<
          string,
          unknown
        >;
        if (typeof oidcConfig.id === 'string') {
          authConfig.clientId = oidcConfig.id;
        }
        if (typeof oidcConfig.callbackUrl === 'string') {
          authConfig.callbackUrl = oidcConfig.callbackUrl;
        }
        // Clean up serverUrl to ensure it doesn't contain /callback
        if (typeof oidcConfig.serverUrl === 'string') {
          const serverUrl = oidcConfig.serverUrl as string;
          // Remove /callback or any path from serverUrl
          oidcConfig.serverUrl = serverUrl.replace(/\/callback\/?$/, '');
        }
      }
    }

    // Ensure boolean fields are always included (only for relevant providers)
    if (authConfig.enableSelfSignup === undefined) {
      authConfig.enableSelfSignup = true;
    }
  }

  if (cleanedData.authorizerConfiguration) {
    const authorizerConfig = cleanedData.authorizerConfiguration;

    // Remove common authorizer fields that shouldn't be sent
    COMMON_AUTHORIZER_FIELDS_TO_REMOVE.forEach(
      (field) => delete authorizerConfig[field as keyof AuthorizerConfiguration]
    );

    // Remove bot principals for providers that don't support them (only Azure and Okta should have botPrincipals)
    if (PROVIDERS_WITHOUT_BOT_PRINCIPALS.includes(provider)) {
      delete authorizerConfig.botPrincipals;
    }

    // Ensure boolean fields are always included (for all providers)
    if (authorizerConfig.enforcePrincipalDomain === undefined) {
      authorizerConfig.enforcePrincipalDomain = false;
    }
    if (authorizerConfig.enableSecureSocketConnection === undefined) {
      authorizerConfig.enableSecureSocketConnection = false;
    }

    // Automatically set className and containerRequestFilter for all providers
    authorizerConfig.className = DEFAULT_AUTHORIZER_CLASS_NAME;
    authorizerConfig.containerRequestFilter = DEFAULT_CONTAINER_REQUEST_FILTER;
  }

  // Provider-specific boolean field handling
  if (cleanedData.authenticationConfiguration?.ldapConfiguration) {
    const ldapConfig = cleanedData.authenticationConfiguration
      .ldapConfiguration as Record<string, unknown>;

    // LDAP-specific boolean fields
    if (ldapConfig.isFullDn === undefined) {
      ldapConfig.isFullDn = false;
    }
    if (ldapConfig.sslEnabled === undefined) {
      ldapConfig.sslEnabled = false;
    }

    // Clean up trustStoreConfig based on truststoreFormat
    if (ldapConfig.trustStoreConfig && ldapConfig.truststoreFormat) {
      const trustStoreConfig = ldapConfig.trustStoreConfig as Record<
        string,
        unknown
      >;
      const truststoreFormat = ldapConfig.truststoreFormat as string;

      // Create a new clean trustStoreConfig object
      const cleanTrustStoreConfig: Record<string, unknown> = {};

      // Only include the configuration that matches the selected format
      if (
        truststoreFormat === 'CustomTrustStore' &&
        trustStoreConfig.customTrustManagerConfig
      ) {
        cleanTrustStoreConfig.customTrustManagerConfig =
          trustStoreConfig.customTrustManagerConfig;
      }
      if (truststoreFormat === 'HostName' && trustStoreConfig.hostNameConfig) {
        cleanTrustStoreConfig.hostNameConfig = trustStoreConfig.hostNameConfig;
      }
      if (
        truststoreFormat === 'JVMDefault' &&
        trustStoreConfig.jvmDefaultConfig
      ) {
        cleanTrustStoreConfig.jvmDefaultConfig =
          trustStoreConfig.jvmDefaultConfig;
      }
      if (truststoreFormat === 'TrustAll' && trustStoreConfig.trustAllConfig) {
        cleanTrustStoreConfig.trustAllConfig = trustStoreConfig.trustAllConfig;
      }

      // Replace the original trustStoreConfig with the clean one
      ldapConfig.trustStoreConfig = cleanTrustStoreConfig;
    }
  }

  if (cleanedData.authenticationConfiguration?.samlConfiguration) {
    const samlConfig = cleanedData.authenticationConfiguration
      .samlConfiguration as Record<string, unknown>;
    const authConfig = cleanedData.authenticationConfiguration;

    // SAML-specific boolean fields
    if (samlConfig.debugMode === undefined) {
      samlConfig.debugMode = false;
    }

    // Process certificates to fix escaping issues and handle authority/callback
    if (samlConfig.idp && typeof samlConfig.idp === 'object') {
      const idpConfig = samlConfig.idp as Record<string, unknown>;

      // Copy IDP authorityUrl to root level authority
      if (
        idpConfig.authorityUrl &&
        typeof idpConfig.authorityUrl === 'string'
      ) {
        authConfig.authority = idpConfig.authorityUrl as string;
      }

      if (
        idpConfig.idpX509Certificate &&
        typeof idpConfig.idpX509Certificate === 'string'
      ) {
        // Fix certificate escaping by replacing \\n with \n
        idpConfig.idpX509Certificate = (
          idpConfig.idpX509Certificate as string
        ).replace(/\\n/g, '\n');
      }
    }

    if (samlConfig.sp && typeof samlConfig.sp === 'object') {
      const spConfig = samlConfig.sp as Record<string, unknown>;

      // Copy SP callback to root level callbackUrl and ensure ACS matches callback
      if (spConfig.callback && typeof spConfig.callback === 'string') {
        authConfig.callbackUrl = spConfig.callback as string;
        // Also ensure ACS has the same value as callback
        spConfig.acs = spConfig.callback;
      }
      if (
        spConfig.spX509Certificate &&
        typeof spConfig.spX509Certificate === 'string'
      ) {
        // Fix certificate escaping by replacing \\n with \n
        spConfig.spX509Certificate = (
          spConfig.spX509Certificate as string
        ).replace(/\\n/g, '\n');
      }
      if (spConfig.spPrivateKey && typeof spConfig.spPrivateKey === 'string') {
        // Fix private key escaping by replacing \\n with \n
        spConfig.spPrivateKey = (spConfig.spPrivateKey as string).replace(
          /\\n/g,
          '\n'
        );
      }
    }

    if (samlConfig.security) {
      const securityConfig = samlConfig.security as Record<string, unknown>;
      if (securityConfig.strictMode === undefined) {
        securityConfig.strictMode = false;
      }
      if (securityConfig.wantAssertionsSigned === undefined) {
        securityConfig.wantAssertionsSigned = false;
      }
      if (securityConfig.wantMessagesSigned === undefined) {
        securityConfig.wantMessagesSigned = false;
      }
      if (securityConfig.sendSignedAuthRequest === undefined) {
        securityConfig.sendSignedAuthRequest = false;
      }
    }
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
 * Generates JSON Patch operations by comparing old and new data
 * @param oldData - The original form data
 * @param newData - The updated form data
 * @returns Array of JSON Patch operations representing the changes
 */
export const generatePatches = (
  oldData: FormData | undefined,
  newData: FormData | undefined
): JsonPatchOperation[] => {
  const patches: JsonPatchOperation[] = [];

  if (!oldData || !newData) {
    return patches;
  }

  const toRecord = (obj: unknown): Record<string, unknown> => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return obj as unknown as Record<string, unknown>;
    }

    return {};
  };

  const compareObjects = (
    oldObj: Record<string, unknown>,
    newObj: Record<string, unknown>,
    basePath: string
  ) => {
    // Handle authentication configuration
    if (basePath === '/authenticationConfiguration') {
      // Compare top-level authentication fields
      Object.keys(newObj).forEach((key) => {
        if (
          key === 'oidcConfiguration' ||
          key === 'ldapConfiguration' ||
          key === 'samlConfiguration'
        ) {
          // Handle nested configuration objects
          const newNestedObj = newObj[key] as
            | Record<string, unknown>
            | undefined;
          const oldNestedObj = oldObj[key] as
            | Record<string, unknown>
            | undefined;

          if (newNestedObj && oldNestedObj) {
            Object.keys(newNestedObj).forEach((nestedKey) => {
              const oldValue = oldNestedObj[nestedKey];
              const newValue = newNestedObj[nestedKey];

              // Generate patch if values are different
              const shouldPatch =
                JSON.stringify(oldValue) !== JSON.stringify(newValue);

              if (shouldPatch) {
                patches.push({
                  op: 'replace',
                  path: `${basePath}/${key}/${nestedKey}`,
                  value: newValue as
                    | string
                    | number
                    | boolean
                    | Record<string, unknown>
                    | unknown[]
                    | null,
                });
              }
            });
          } else if (newNestedObj && !oldNestedObj) {
            // Add new nested configuration
            patches.push({
              op: 'add',
              path: `${basePath}/${key}`,
              value: newNestedObj,
            });
          }
        } else {
          // Handle top-level fields
          const oldValue = oldObj[key];
          const newValue = newObj[key];

          // Generate patch if values are different
          const shouldPatch =
            JSON.stringify(oldValue) !== JSON.stringify(newValue);

          if (shouldPatch) {
            patches.push({
              op: 'replace',
              path: `${basePath}/${key}`,
              value: newValue as
                | string
                | number
                | boolean
                | Record<string, unknown>
                | unknown[]
                | null,
            });
          }
        }
      });
    } else {
      // Handle authorizer configuration - simple field comparison
      Object.keys(newObj).forEach((key) => {
        const oldValue = oldObj[key];
        const newValue = newObj[key];

        // Generate patch if values are different
        const shouldPatch =
          JSON.stringify(oldValue) !== JSON.stringify(newValue);

        if (shouldPatch) {
          patches.push({
            op: 'replace',
            path: `${basePath}/${key}`,
            value: newValue as
              | string
              | number
              | boolean
              | Record<string, unknown>
              | unknown[]
              | null,
          });
        }
      });
    }
  };

  // Generate patches for authentication configuration
  if (
    oldData.authenticationConfiguration &&
    newData.authenticationConfiguration
  ) {
    compareObjects(
      toRecord(oldData.authenticationConfiguration as unknown),
      toRecord(newData.authenticationConfiguration as unknown),
      '/authenticationConfiguration'
    );
  }

  // Generate patches for authorizer configuration
  if (oldData.authorizerConfiguration && newData.authorizerConfiguration) {
    compareObjects(
      toRecord(oldData.authorizerConfiguration as unknown),
      toRecord(newData.authorizerConfiguration as unknown),
      '/authorizerConfiguration'
    );
  }

  return patches;
};
