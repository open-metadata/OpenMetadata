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

import { ErrorSchema } from '@rjsf/utils';
import { ClientType } from '../generated/configuration/securityConfiguration';
import { AuthProvider } from '../generated/settings/settings';
import {
  applySamlConfiguration,
  cleanupProviderSpecificFields,
  clearFieldError,
  createDOMClickHandler,
  createDOMFocusHandler,
  createFormKeyDownHandler,
  createFreshFormData,
  extractFieldName,
  findChangedFields,
  FormData,
  getDefaultClientType,
  getDefaultsForProvider,
  getProviderDisplayName,
  getProviderIcon,
  handleClientTypeChange,
  handleConfidentialToPublicSwitch,
  handlePublicToConfidentialSwitch,
  hasFieldValidationErrors,
  isValidNonBasicProvider,
  isValidUrl,
  parseValidationErrors,
  populateSamlIdpAuthority,
  populateSamlSpCallback,
  removeRequiredFields,
  removeSchemaFields,
  updateLoadingState,
} from './SSOUtils';

// Mock the constants module
jest.mock('../constants/SSO.constant', () => ({
  COMMON_AUTH_FIELDS_TO_REMOVE: ['responseType'],
  COMMON_AUTHORIZER_FIELDS_TO_REMOVE: [
    'testPrincipals',
    'allowedEmailRegistrationDomains',
    'allowedDomains',
    'useRolesFromProvider',
  ],
  DEFAULT_AUTHORIZER_CLASS_NAME:
    'org.openmetadata.service.security.DefaultAuthorizer',
  DEFAULT_CONTAINER_REQUEST_FILTER:
    'org.openmetadata.service.security.JwtFilter',
  DEFAULT_CALLBACK_URL: 'http://localhost:8585/callback',
  OIDC_SSO_DEFAULTS: {
    tokenValidity: 3600,
    sessionExpiry: 604800,
    serverUrl: 'http://localhost:8585',
  },
  GOOGLE_SSO_DEFAULTS: {
    authority: 'https://accounts.google.com',
    publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
    discoveryUri:
      'https://accounts.google.com/.well-known/openid-configuration',
  },
  SAML_SSO_DEFAULTS: {
    authority: 'http://localhost:8585/api/v1/auth/login',
    idp: {
      authorityUrl: 'http://localhost:8585/api/v1/auth/login',
    },
    sp: {
      entityId: 'http://localhost:8585',
      acs: 'http://localhost:8585/callback',
      callback: 'http://localhost:8585/callback',
    },
  },
  PROVIDER_FIELD_MAPPINGS: {
    ldap: ['samlConfiguration', 'oidcConfiguration', 'enableSelfSignup'],
    saml: [
      'ldapConfiguration',
      'oidcConfiguration',
      'tokenValidationAlgorithm',
      'enableSelfSignup',
    ],
    google: [
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
  },
  PROVIDERS_WITHOUT_BOT_PRINCIPALS: ['google', 'auth0', 'basic', 'aws-cognito'],
}));

describe('SSOUtils', () => {
  /**
   * Test suite for parseValidationErrors function
   * Tests parsing of backend validation errors into RJSF ErrorSchema format
   */
  describe('parseValidationErrors', () => {
    it('should parse single field error correctly', () => {
      const errors = [{ field: 'clientId', error: 'Required field' }];
      const result = parseValidationErrors(errors);

      expect(result).toEqual({
        clientId: { __errors: ['Required field'] },
      });
    });

    it('should parse multiple field errors correctly', () => {
      const errors = [
        { field: 'clientId', error: 'Required field' },
        { field: 'authority', error: 'Invalid URL' },
      ];
      const result = parseValidationErrors(errors);

      expect(result).toEqual({
        clientId: { __errors: ['Required field'] },
        authority: { __errors: ['Invalid URL'] },
      });
    });

    it('should parse nested field errors correctly', () => {
      const errors = [
        {
          field: 'authenticationConfiguration.oidcConfiguration.secret',
          error: 'Secret is required',
        },
      ];
      const result = parseValidationErrors(errors);

      expect(result).toEqual({
        authenticationConfiguration: {
          oidcConfiguration: {
            secret: { __errors: ['Secret is required'] },
          },
        },
      });
    });

    it('should handle empty errors array', () => {
      const errors: Array<{ field: string; error: string }> = [];
      const result = parseValidationErrors(errors);

      expect(result).toEqual({});
    });

    it('should handle deep nesting (3+ levels)', () => {
      const errors = [
        {
          field: 'authenticationConfiguration.samlConfiguration.idp.entityId',
          error: 'Entity ID required',
        },
      ];
      const result = parseValidationErrors(errors);

      expect(result).toEqual({
        authenticationConfiguration: {
          samlConfiguration: {
            idp: {
              entityId: { __errors: ['Entity ID required'] },
            },
          },
        },
      });
    });

    it('should handle multiple errors at different nesting levels', () => {
      const errors = [
        { field: 'clientId', error: 'Required' },
        {
          field: 'authenticationConfiguration.clientId',
          error: 'Must be valid',
        },
        {
          field: 'authenticationConfiguration.oidcConfiguration.secret',
          error: 'Cannot be empty',
        },
      ];
      const result = parseValidationErrors(errors);

      expect(result).toEqual({
        clientId: { __errors: ['Required'] },
        authenticationConfiguration: {
          clientId: { __errors: ['Must be valid'] },
          oidcConfiguration: {
            secret: { __errors: ['Cannot be empty'] },
          },
        },
      });
    });
  });

  /**
   * Test suite for clearFieldError function
   * Tests clearing specific field errors from the error schema
   */
  describe('clearFieldError', () => {
    it('should clear existing error at root level', () => {
      const fieldErrorsRef = {
        current: {
          clientId: { __errors: ['Required'] },
        } as unknown as ErrorSchema,
      };

      clearFieldError(fieldErrorsRef, 'root/clientId');

      expect(fieldErrorsRef.current).toEqual({});
    });

    it('should clear nested error', () => {
      const fieldErrorsRef = {
        current: {
          authenticationConfiguration: {
            clientId: { __errors: ['Required'] },
            authority: { __errors: ['Invalid'] },
          },
        } as unknown as ErrorSchema,
      };

      clearFieldError(
        fieldErrorsRef,
        'root/authenticationConfiguration/clientId'
      );

      expect(fieldErrorsRef.current).toEqual({
        authenticationConfiguration: {
          authority: { __errors: ['Invalid'] },
        },
      });
    });

    it('should handle non-existent error path (no-op)', () => {
      const fieldErrorsRef = {
        current: {
          clientId: { __errors: ['Required'] },
        } as unknown as ErrorSchema,
      };

      clearFieldError(fieldErrorsRef, 'root/nonExistent/field');

      expect(fieldErrorsRef.current).toEqual({
        clientId: { __errors: ['Required'] },
      });
    });

    it('should clean up empty parent objects after clearing', () => {
      const fieldErrorsRef = {
        current: {
          authenticationConfiguration: {
            oidcConfiguration: {
              secret: { __errors: ['Required'] },
            },
          },
        } as unknown as ErrorSchema,
      };

      clearFieldError(
        fieldErrorsRef,
        'root/authenticationConfiguration/oidcConfiguration/secret'
      );

      // Note: The cleanup only removes one level of empty parents (oidcConfiguration),
      // leaving authenticationConfiguration even though it's also empty
      expect(fieldErrorsRef.current).toEqual({
        authenticationConfiguration: {},
      });
    });

    it('should handle empty fieldErrorsRef gracefully', () => {
      const fieldErrorsRef = {
        current: {} as ErrorSchema,
      };

      clearFieldError(fieldErrorsRef, 'root/someField');

      expect(fieldErrorsRef.current).toEqual({});
    });

    it('should preserve other errors when clearing one field', () => {
      const fieldErrorsRef = {
        current: {
          authenticationConfiguration: {
            clientId: { __errors: ['Required'] },
            authority: { __errors: ['Invalid'] },
            oidcConfiguration: {
              secret: { __errors: ['Required'] },
              id: { __errors: ['Invalid'] },
            },
          },
        } as unknown as ErrorSchema,
      };

      clearFieldError(
        fieldErrorsRef,
        'root/authenticationConfiguration/oidcConfiguration/secret'
      );

      expect(fieldErrorsRef.current).toEqual({
        authenticationConfiguration: {
          clientId: { __errors: ['Required'] },
          authority: { __errors: ['Invalid'] },
          oidcConfiguration: {
            id: { __errors: ['Invalid'] },
          },
        },
      });
    });
  });

  /**
   * Test suite for getDefaultsForProvider function
   * Tests generation of provider-specific default configuration
   */
  describe('getDefaultsForProvider', () => {
    it('should return defaults for Google with Public client type', () => {
      const result = getDefaultsForProvider(
        AuthProvider.Google,
        ClientType.Public
      );

      expect(result.authenticationConfiguration.provider).toBe(
        AuthProvider.Google
      );
      expect(result.authenticationConfiguration.clientType).toBe(
        ClientType.Public
      );
      expect(result.authenticationConfiguration.authority).toBe(
        'https://accounts.google.com'
      );
      expect(result.authenticationConfiguration.publicKeyUrls).toEqual([
        'https://www.googleapis.com/oauth2/v3/certs',
      ]);
      expect(
        result.authenticationConfiguration.oidcConfiguration
      ).toBeUndefined();
    });

    it('should return defaults for Google with Confidential client type', () => {
      const result = getDefaultsForProvider(
        AuthProvider.Google,
        ClientType.Confidential
      );

      expect(result.authenticationConfiguration.provider).toBe(
        AuthProvider.Google
      );
      expect(result.authenticationConfiguration.clientType).toBe(
        ClientType.Confidential
      );
      expect(
        result.authenticationConfiguration.oidcConfiguration
      ).toBeDefined();
      expect(
        result.authenticationConfiguration.oidcConfiguration?.discoveryUri
      ).toBe('https://accounts.google.com/.well-known/openid-configuration');
      expect(
        result.authenticationConfiguration.oidcConfiguration?.tokenValidity
      ).toBe(3600);
    });

    it('should return defaults for SAML provider (always Public)', () => {
      const result = getDefaultsForProvider(
        AuthProvider.Saml,
        ClientType.Public
      );

      expect(result.authenticationConfiguration.provider).toBe(
        AuthProvider.Saml
      );
      expect(result.authenticationConfiguration.clientType).toBe(
        ClientType.Public
      );
      expect(
        result.authenticationConfiguration.samlConfiguration
      ).toBeDefined();
      expect(
        result.authenticationConfiguration.samlConfiguration?.idp
      ).toBeDefined();
      expect(
        result.authenticationConfiguration.samlConfiguration?.sp
      ).toBeDefined();
      expect(
        result.authenticationConfiguration.samlConfiguration?.security
      ).toBeDefined();
    });

    it('should return defaults for LDAP provider (always Public)', () => {
      const result = getDefaultsForProvider(
        AuthProvider.LDAP,
        ClientType.Public
      );

      expect(result.authenticationConfiguration.provider).toBe(
        AuthProvider.LDAP
      );
      expect(result.authenticationConfiguration.clientType).toBe(
        ClientType.Public
      );
      expect(
        result.authenticationConfiguration.oidcConfiguration
      ).toBeUndefined();
      expect(
        result.authenticationConfiguration.samlConfiguration
      ).toBeUndefined();
    });

    it('should return defaults for Azure with Confidential client type', () => {
      const result = getDefaultsForProvider(
        AuthProvider.Azure,
        ClientType.Confidential
      );

      expect(result.authenticationConfiguration.provider).toBe(
        AuthProvider.Azure
      );
      expect(result.authenticationConfiguration.clientType).toBe(
        ClientType.Confidential
      );
      expect(
        result.authenticationConfiguration.oidcConfiguration
      ).toBeDefined();
      expect(result.authenticationConfiguration.oidcConfiguration?.scope).toBe(
        'openid email profile'
      );
    });

    it('should return defaults for Auth0 provider', () => {
      const result = getDefaultsForProvider(
        AuthProvider.Auth0,
        ClientType.Confidential
      );

      expect(result.authenticationConfiguration.provider).toBe(
        AuthProvider.Auth0
      );
      expect(
        result.authenticationConfiguration.oidcConfiguration
      ).toBeDefined();
    });

    it('should return defaults for Okta provider', () => {
      const result = getDefaultsForProvider(
        AuthProvider.Okta,
        ClientType.Confidential
      );

      expect(result.authenticationConfiguration.provider).toBe(
        AuthProvider.Okta
      );
      expect(
        result.authenticationConfiguration.oidcConfiguration
      ).toBeDefined();
    });

    it('should return defaults for AWS Cognito provider', () => {
      const result = getDefaultsForProvider(
        AuthProvider.AwsCognito,
        ClientType.Confidential
      );

      expect(result.authenticationConfiguration.provider).toBe(
        AuthProvider.AwsCognito
      );
      expect(
        result.authenticationConfiguration.oidcConfiguration
      ).toBeDefined();
    });

    it('should return defaults for Custom OIDC provider', () => {
      const result = getDefaultsForProvider(
        AuthProvider.CustomOidc,
        ClientType.Confidential
      );

      expect(result.authenticationConfiguration.provider).toBe(
        AuthProvider.CustomOidc
      );
      expect(
        result.authenticationConfiguration.oidcConfiguration
      ).toBeDefined();
    });

    it('should always include authorizer configuration with defaults', () => {
      const result = getDefaultsForProvider(
        AuthProvider.Google,
        ClientType.Public
      );

      expect(result.authorizerConfiguration).toBeDefined();
      expect(result.authorizerConfiguration.className).toBe(
        'org.openmetadata.service.security.DefaultAuthorizer'
      );
      expect(result.authorizerConfiguration.containerRequestFilter).toBe(
        'org.openmetadata.service.security.JwtFilter'
      );
      expect(result.authorizerConfiguration.enforcePrincipalDomain).toBe(false);
      expect(result.authorizerConfiguration.enableSecureSocketConnection).toBe(
        false
      );
    });
  });

  /**
   * Test suite for cleanupProviderSpecificFields function
   * Tests removal of provider-specific configuration fields
   */
  describe('cleanupProviderSpecificFields', () => {
    it('should return undefined if data is undefined', () => {
      const result = cleanupProviderSpecificFields(undefined, 'google');

      expect(result).toBeUndefined();
    });

    it('should remove OIDC config for Public client', () => {
      const data: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          clientType: ClientType.Public,
          authority: 'https://accounts.google.com',
          clientId: 'test-client-id',
          callbackUrl: 'http://localhost:8585/callback',
          publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
          tokenValidationAlgorithm: 'RS256',
          jwtPrincipalClaims: ['email'],
          jwtPrincipalClaimsMapping: [],
          enableSelfSignup: true,
          oidcConfiguration: {
            id: 'test-id',
            secret: 'test-secret',
          },
        },
        authorizerConfiguration: {
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          adminPrincipals: [],
          principalDomain: '',
          enforcePrincipalDomain: false,
          enableSecureSocketConnection: false,
        },
      };

      const result = cleanupProviderSpecificFields(data, 'google');

      expect(
        result?.authenticationConfiguration.oidcConfiguration
      ).toBeUndefined();
      expect(result?.authenticationConfiguration.secret).toBeUndefined();
    });

    it('should keep OIDC config for Confidential client', () => {
      const data: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          clientType: ClientType.Confidential,
          authority: 'https://accounts.google.com',
          clientId: 'test-client-id',
          callbackUrl: 'http://localhost:8585/callback',
          publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
          tokenValidationAlgorithm: 'RS256',
          jwtPrincipalClaims: ['email'],
          jwtPrincipalClaimsMapping: [],
          enableSelfSignup: true,
          oidcConfiguration: {
            id: 'test-id',
            secret: 'test-secret',
            callbackUrl: 'http://localhost:8585/callback',
            serverUrl: 'http://localhost:8585/callback',
          },
        },
        authorizerConfiguration: {
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          adminPrincipals: [],
          principalDomain: '',
          enforcePrincipalDomain: false,
          enableSecureSocketConnection: false,
        },
      };

      const result = cleanupProviderSpecificFields(data, 'google');

      expect(
        result?.authenticationConfiguration.oidcConfiguration
      ).toBeDefined();
      expect(result?.authenticationConfiguration.clientId).toBe('test-id');
      expect(result?.authenticationConfiguration.callbackUrl).toBe(
        'http://localhost:8585/callback'
      );
    });

    it('should remove provider-specific configs (LDAP, SAML)', () => {
      const data: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          clientType: ClientType.Public,
          authority: 'https://accounts.google.com',
          clientId: 'test-client-id',
          callbackUrl: 'http://localhost:8585/callback',
          publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
          tokenValidationAlgorithm: 'RS256',
          jwtPrincipalClaims: ['email'],
          jwtPrincipalClaimsMapping: [],
          enableSelfSignup: true,
          ldapConfiguration: { host: 'ldap.example.com' },
          samlConfiguration: { debugMode: false },
        },
        authorizerConfiguration: {
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          adminPrincipals: [],
          principalDomain: '',
          enforcePrincipalDomain: false,
          enableSecureSocketConnection: false,
        },
      };

      const result = cleanupProviderSpecificFields(data, 'google');

      expect(
        result?.authenticationConfiguration.ldapConfiguration
      ).toBeUndefined();
      expect(
        result?.authenticationConfiguration.samlConfiguration
      ).toBeUndefined();
    });

    it('should handle SAML certificate escaping (\\\\n to \\n)', () => {
      const data: FormData = {
        authenticationConfiguration: {
          provider: 'saml',
          providerName: 'SAML',
          clientType: ClientType.Public,
          authority: 'http://localhost:8585/api/v1/auth/login',
          clientId: 'test-client-id',
          callbackUrl: 'http://localhost:8585/callback',
          publicKeyUrls: [],
          tokenValidationAlgorithm: 'RS256',
          jwtPrincipalClaims: ['email'],
          jwtPrincipalClaimsMapping: [],
          enableSelfSignup: true,
          samlConfiguration: {
            debugMode: false,
            idp: {
              idpX509Certificate: 'CERT\\nLINE2\\nLINE3',
              authorityUrl: 'http://localhost:8585/api/v1/auth/login',
            },
            sp: {
              spX509Certificate: 'SP_CERT\\nLINE2',
              spPrivateKey: 'PRIVATE\\nKEY',
              callback: 'http://localhost:8585/callback',
            },
            security: {},
          },
        },
        authorizerConfiguration: {
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          adminPrincipals: [],
          principalDomain: '',
          enforcePrincipalDomain: false,
          enableSecureSocketConnection: false,
        },
      };

      const result = cleanupProviderSpecificFields(data, 'saml');

      const samlConfig = result?.authenticationConfiguration
        .samlConfiguration as Record<string, unknown>;
      const idpConfig = samlConfig?.idp as Record<string, unknown>;
      const spConfig = samlConfig?.sp as Record<string, unknown>;

      expect(idpConfig?.idpX509Certificate).toBe('CERT\nLINE2\nLINE3');
      expect(spConfig?.spX509Certificate).toBe('SP_CERT\nLINE2');
      expect(spConfig?.spPrivateKey).toBe('PRIVATE\nKEY');
    });

    it('should handle LDAP trustStore cleanup by format', () => {
      const data: FormData = {
        authenticationConfiguration: {
          provider: 'ldap',
          providerName: 'LDAP',
          clientType: ClientType.Public,
          authority: '',
          clientId: '',
          callbackUrl: '',
          publicKeyUrls: [],
          tokenValidationAlgorithm: 'RS256',
          jwtPrincipalClaims: [],
          jwtPrincipalClaimsMapping: [],
          enableSelfSignup: true,
          ldapConfiguration: {
            host: 'ldap.example.com',
            truststoreFormat: 'CustomTrustStore',
            trustStoreConfig: {
              customTrustManagerConfig: {
                trustStoreFilePath: '/path/to/store',
              },
              hostNameConfig: { allowWildCards: true },
              jvmDefaultConfig: {},
              trustAllConfig: {},
            },
          },
        },
        authorizerConfiguration: {
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          adminPrincipals: [],
          principalDomain: '',
          enforcePrincipalDomain: false,
          enableSecureSocketConnection: false,
        },
      };

      const result = cleanupProviderSpecificFields(data, 'ldap');

      const ldapConfig = result?.authenticationConfiguration
        .ldapConfiguration as Record<string, unknown>;
      const trustStoreConfig = ldapConfig?.trustStoreConfig as Record<
        string,
        unknown
      >;

      expect(trustStoreConfig?.customTrustManagerConfig).toBeDefined();
      expect(trustStoreConfig?.hostNameConfig).toBeUndefined();
      expect(trustStoreConfig?.jvmDefaultConfig).toBeUndefined();
      expect(trustStoreConfig?.trustAllConfig).toBeUndefined();
    });

    it('should set default boolean values for enableSelfSignup', () => {
      const data: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          clientType: ClientType.Public,
          authority: 'https://accounts.google.com',
          clientId: 'test-client-id',
          callbackUrl: 'http://localhost:8585/callback',
          publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
          tokenValidationAlgorithm: 'RS256',
          jwtPrincipalClaims: ['email'],
          jwtPrincipalClaimsMapping: [],
          enableSelfSignup: true,
        },
        authorizerConfiguration: {
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          adminPrincipals: [],
          principalDomain: '',
          enforcePrincipalDomain: false,
          enableSecureSocketConnection: false,
        },
      };

      const result = cleanupProviderSpecificFields(data, 'google');

      expect(
        result?.authenticationConfiguration.enableSelfSignup
      ).toBeDefined();
      expect(
        result?.authorizerConfiguration.enforcePrincipalDomain
      ).toBeDefined();
      expect(
        result?.authorizerConfiguration.enableSecureSocketConnection
      ).toBeDefined();
    });

    it('should handle bot principals removal for specific providers', () => {
      const data: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          clientType: ClientType.Public,
          authority: 'https://accounts.google.com',
          clientId: 'test-client-id',
          callbackUrl: 'http://localhost:8585/callback',
          publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
          tokenValidationAlgorithm: 'RS256',
          jwtPrincipalClaims: ['email'],
          jwtPrincipalClaimsMapping: [],
          enableSelfSignup: true,
        },
        authorizerConfiguration: {
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          adminPrincipals: ['admin@example.com'],
          botPrincipals: ['bot@example.com'],
          principalDomain: '',
          enforcePrincipalDomain: false,
          enableSecureSocketConnection: false,
        },
      };

      const result = cleanupProviderSpecificFields(data, 'google');

      expect(result?.authorizerConfiguration.botPrincipals).toBeUndefined();
    });

    it('should set clientType to Public for SAML provider', () => {
      const data: FormData = {
        authenticationConfiguration: {
          provider: 'saml',
          providerName: 'SAML',
          clientType: ClientType.Confidential,
          authority: 'http://localhost:8585/api/v1/auth/login',
          clientId: 'test-client-id',
          callbackUrl: 'http://localhost:8585/callback',
          publicKeyUrls: [],
          tokenValidationAlgorithm: 'RS256',
          jwtPrincipalClaims: ['email'],
          jwtPrincipalClaimsMapping: [],
          enableSelfSignup: true,
          samlConfiguration: {},
        },
        authorizerConfiguration: {
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          adminPrincipals: [],
          principalDomain: '',
          enforcePrincipalDomain: false,
          enableSecureSocketConnection: false,
        },
      };

      const result = cleanupProviderSpecificFields(data, 'saml');

      expect(result?.authenticationConfiguration.clientType).toBe(
        ClientType.Public
      );
    });

    it('should set clientType to Public for LDAP provider', () => {
      const data: FormData = {
        authenticationConfiguration: {
          provider: 'ldap',
          providerName: 'LDAP',
          clientType: ClientType.Confidential,
          authority: '',
          clientId: '',
          callbackUrl: '',
          publicKeyUrls: [],
          tokenValidationAlgorithm: 'RS256',
          jwtPrincipalClaims: [],
          jwtPrincipalClaimsMapping: [],
          enableSelfSignup: true,
          ldapConfiguration: {},
        },
        authorizerConfiguration: {
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          adminPrincipals: [],
          principalDomain: '',
          enforcePrincipalDomain: false,
          enableSecureSocketConnection: false,
        },
      };

      const result = cleanupProviderSpecificFields(data, 'ldap');

      expect(result?.authenticationConfiguration.clientType).toBe(
        ClientType.Public
      );
    });

    it('should clean up serverUrl to remove /callback suffix', () => {
      const data: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          clientType: ClientType.Confidential,
          authority: 'https://accounts.google.com',
          clientId: 'test-client-id',
          callbackUrl: 'http://localhost:8585/callback',
          publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
          tokenValidationAlgorithm: 'RS256',
          jwtPrincipalClaims: ['email'],
          jwtPrincipalClaimsMapping: [],
          enableSelfSignup: true,
          oidcConfiguration: {
            id: 'test-id',
            secret: 'test-secret',
            callbackUrl: 'http://localhost:8585/callback',
            serverUrl: 'http://localhost:8585/callback/',
          },
        },
        authorizerConfiguration: {
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          adminPrincipals: [],
          principalDomain: '',
          enforcePrincipalDomain: false,
          enableSecureSocketConnection: false,
        },
      };

      const result = cleanupProviderSpecificFields(data, 'google');

      expect(
        result?.authenticationConfiguration.oidcConfiguration?.serverUrl
      ).toBe('http://localhost:8585');
    });
  });

  /**
   * Test suite for findChangedFields function
   * Tests detection of changed fields between two objects
   */
  describe('findChangedFields', () => {
    it('should return empty array for identical objects', () => {
      const oldData = {
        clientId: 'test-id',
        authority: 'https://accounts.google.com',
      };
      const newData = {
        clientId: 'test-id',
        authority: 'https://accounts.google.com',
      };

      const result = findChangedFields(oldData, newData);

      expect(result).toEqual([]);
    });

    it('should detect single field change', () => {
      const oldData = {
        clientId: 'old-id',
        authority: 'https://accounts.google.com',
      };
      const newData = {
        clientId: 'new-id',
        authority: 'https://accounts.google.com',
      };

      const result = findChangedFields(oldData, newData);

      expect(result).toEqual(['root/clientId']);
    });

    it('should detect multiple field changes', () => {
      const oldData = {
        clientId: 'old-id',
        authority: 'https://old-authority.com',
      };
      const newData = {
        clientId: 'new-id',
        authority: 'https://new-authority.com',
      };

      const result = findChangedFields(oldData, newData);

      expect(result).toContain('root/clientId');
      expect(result).toContain('root/authority');
      expect(result).toHaveLength(2);
    });

    it('should detect nested field changes', () => {
      const oldData = {
        authenticationConfiguration: {
          clientId: 'old-id',
        },
      };
      const newData = {
        authenticationConfiguration: {
          clientId: 'new-id',
        },
      };

      const result = findChangedFields(oldData, newData);

      expect(result).toEqual(['root/authenticationConfiguration/clientId']);
    });

    it('should detect array value changes', () => {
      const oldData = {
        publicKeyUrls: ['https://old-url.com'],
      };
      const newData = {
        publicKeyUrls: ['https://new-url.com'],
      };

      const result = findChangedFields(oldData, newData);

      expect(result).toEqual(['root/publicKeyUrls']);
    });

    it('should handle null and undefined values', () => {
      const oldData = {
        clientId: null,
        authority: undefined,
      };
      const newData = {
        clientId: 'new-id',
        authority: 'https://accounts.google.com',
      };

      const result = findChangedFields(oldData, newData);

      expect(result).toContain('root/clientId');
      expect(result).toContain('root/authority');
    });

    it('should return empty array if oldData is null', () => {
      const result = findChangedFields(null, { clientId: 'test' });

      expect(result).toEqual([]);
    });

    it('should return empty array if newData is null', () => {
      const result = findChangedFields({ clientId: 'test' }, null);

      expect(result).toEqual([]);
    });

    it('should handle deep nested changes', () => {
      const oldData = {
        authenticationConfiguration: {
          oidcConfiguration: {
            secret: 'old-secret',
          },
        },
      };
      const newData = {
        authenticationConfiguration: {
          oidcConfiguration: {
            secret: 'new-secret',
          },
        },
      };

      const result = findChangedFields(oldData, newData);

      expect(result).toEqual([
        'root/authenticationConfiguration/oidcConfiguration/secret',
      ]);
    });
  });

  /**
   * Test suite for isValidUrl function
   * Tests URL validation logic
   */
  describe('isValidUrl', () => {
    it('should return true for valid HTTP URL', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('should return true for valid HTTPS URL', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('should return true for URL with path', () => {
      expect(isValidUrl('https://example.com/path/to/resource')).toBe(true);
    });

    it('should return true for URL with query params', () => {
      expect(isValidUrl('https://example.com?param=value')).toBe(true);
    });

    it('should return false for invalid URL without protocol', () => {
      expect(isValidUrl('example.com')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidUrl('')).toBe(false);
    });

    it('should handle URL with trailing spaces', () => {
      expect(isValidUrl('  https://example.com  ')).toBe(true);
    });
  });

  /**
   * Test suite for getProviderDisplayName function
   * Tests provider name display logic
   */
  describe('getProviderDisplayName', () => {
    it('should return "Azure AD" for Azure provider', () => {
      expect(getProviderDisplayName(AuthProvider.Azure)).toBe('Azure AD');
    });

    it('should return "Google" for Google provider', () => {
      expect(getProviderDisplayName(AuthProvider.Google)).toBe('Google');
    });

    it('should return "Okta" for Okta provider', () => {
      expect(getProviderDisplayName(AuthProvider.Okta)).toBe('Okta');
    });

    it('should return "Auth0" for Auth0 provider', () => {
      expect(getProviderDisplayName(AuthProvider.Auth0)).toBe('Auth0');
    });

    it('should return "AWS Cognito" for AwsCognito provider', () => {
      expect(getProviderDisplayName(AuthProvider.AwsCognito)).toBe(
        'AWS Cognito'
      );
    });

    it('should return "SAML" for Saml provider', () => {
      expect(getProviderDisplayName(AuthProvider.Saml)).toBe('SAML');
    });

    it('should return "Custom OIDC" for CustomOidc provider', () => {
      expect(getProviderDisplayName(AuthProvider.CustomOidc)).toBe(
        'Custom OIDC'
      );
    });

    it('should return "Basic Authentication" for Basic provider', () => {
      expect(getProviderDisplayName(AuthProvider.Basic)).toBe(
        'Basic Authentication'
      );
    });

    it('should return capitalized name for unknown provider', () => {
      expect(getProviderDisplayName('unknown')).toBe('Unknown');
    });
  });

  /**
   * Test suite for getProviderIcon function
   * Tests provider icon retrieval logic
   */
  describe('getProviderIcon', () => {
    it('should return icon for Azure provider', () => {
      expect(getProviderIcon(AuthProvider.Azure)).not.toBeNull();
    });

    it('should return icon for Google provider', () => {
      expect(getProviderIcon(AuthProvider.Google)).not.toBeNull();
    });

    it('should return icon for Okta provider', () => {
      expect(getProviderIcon(AuthProvider.Okta)).not.toBeNull();
    });

    it('should return icon for Auth0 provider', () => {
      expect(getProviderIcon(AuthProvider.Auth0)).not.toBeNull();
    });

    it('should return icon for AWS Cognito provider', () => {
      expect(getProviderIcon(AuthProvider.AwsCognito)).not.toBeNull();
    });

    it('should return icon for LDAP provider', () => {
      expect(getProviderIcon(AuthProvider.LDAP)).not.toBeNull();
    });

    it('should return icon for SAML provider', () => {
      expect(getProviderIcon(AuthProvider.Saml)).not.toBeNull();
    });

    it('should return icon for CustomOIDC provider', () => {
      expect(getProviderIcon(AuthProvider.CustomOidc)).not.toBeNull();
    });

    it('should return null for unknown provider', () => {
      expect(getProviderIcon('unknown')).toBeNull();
    });
  });

  /**
   * Test suite for cleanupProviderSpecificFields edge cases
   * Tests additional uncovered scenarios
   */
  describe('cleanupProviderSpecificFields - additional coverage', () => {
    it('should set default boolean values for authorizer config when undefined', () => {
      const data: FormData = {
        authenticationConfiguration: {
          provider: AuthProvider.Google,
        } as unknown,
        authorizerConfiguration: {
          // Missing boolean fields
        } as unknown,
      } as FormData;

      const result = cleanupProviderSpecificFields(data, AuthProvider.Google);

      expect(result?.authorizerConfiguration?.enforcePrincipalDomain).toBe(
        false
      );
      expect(
        result?.authorizerConfiguration?.enableSecureSocketConnection
      ).toBe(false);
    });

    it('should handle LDAP configuration with undefined boolean fields', () => {
      const data: FormData = {
        authenticationConfiguration: {
          provider: AuthProvider.LDAP,
          ldapConfiguration: {
            host: 'ldap.example.com',
            port: 389,
            // Missing isFullDn and sslEnabled
          },
        } as unknown,
        authorizerConfiguration: {} as unknown,
      } as FormData;

      const result = cleanupProviderSpecificFields(data, AuthProvider.LDAP);

      expect(
        result?.authenticationConfiguration?.ldapConfiguration?.isFullDn
      ).toBe(false);
      expect(
        result?.authenticationConfiguration?.ldapConfiguration?.sslEnabled
      ).toBe(false);
    });

    it('should clean up LDAP trustStoreConfig for CustomTrust format', () => {
      const data: FormData = {
        authenticationConfiguration: {
          provider: AuthProvider.LDAP,
          ldapConfiguration: {
            host: 'ldap.example.com',
            port: 389,
            truststoreFormat: 'CustomTrust',
            trustStoreConfig: {
              customTrustManagerConfig: { verifyHostname: true },
              hostNameConfig: { allowWildCards: true },
            },
          },
        } as unknown,
        authorizerConfiguration: {} as unknown,
      } as FormData;

      const result = cleanupProviderSpecificFields(data, AuthProvider.LDAP);

      const ldapConfig = result?.authenticationConfiguration
        ?.ldapConfiguration as Record<string, unknown>;

      // Verify the function processes trustStore config
      expect(ldapConfig?.trustStoreConfig).toBeDefined();
    });

    it('should clean up LDAP trustStoreConfig for HostName format', () => {
      const data: FormData = {
        authenticationConfiguration: {
          provider: AuthProvider.LDAP,
          ldapConfiguration: {
            host: 'ldap.example.com',
            port: 389,
            truststoreFormat: 'HostName',
            trustStoreConfig: {
              customTrustManagerConfig: { verifyHostname: true },
              hostNameConfig: { allowWildCards: true },
            },
          },
        } as unknown,
        authorizerConfiguration: {} as unknown,
      } as FormData;

      const result = cleanupProviderSpecificFields(data, AuthProvider.LDAP);

      const ldapConfig = result?.authenticationConfiguration
        ?.ldapConfiguration as Record<string, unknown>;

      expect(ldapConfig?.trustStoreConfig).toBeDefined();
    });

    it('should clean up LDAP trustStoreConfig for JVMDefault format', () => {
      const data: FormData = {
        authenticationConfiguration: {
          provider: AuthProvider.LDAP,
          ldapConfiguration: {
            host: 'ldap.example.com',
            port: 389,
            truststoreFormat: 'JVMDefault',
            trustStoreConfig: {
              jvmDefaultConfig: { verifyHostname: false },
              hostNameConfig: { allowWildCards: true },
            },
          },
        } as unknown,
        authorizerConfiguration: {} as unknown,
      } as FormData;

      const result = cleanupProviderSpecificFields(data, AuthProvider.LDAP);

      const ldapConfig = result?.authenticationConfiguration
        ?.ldapConfiguration as Record<string, unknown>;

      expect(ldapConfig?.trustStoreConfig).toBeDefined();
    });

    it('should clean up LDAP trustStoreConfig for TrustAll format', () => {
      const data: FormData = {
        authenticationConfiguration: {
          provider: AuthProvider.LDAP,
          ldapConfiguration: {
            host: 'ldap.example.com',
            port: 389,
            truststoreFormat: 'TrustAll',
            trustStoreConfig: {
              trustAllConfig: {},
              hostNameConfig: { allowWildCards: true },
            },
          },
        } as unknown,
        authorizerConfiguration: {} as unknown,
      } as FormData;

      const result = cleanupProviderSpecificFields(data, AuthProvider.LDAP);

      const ldapConfig = result?.authenticationConfiguration
        ?.ldapConfiguration as Record<string, unknown>;

      expect(ldapConfig?.trustStoreConfig).toBeDefined();
    });
  });

  /**
   * Test suite for findChangedFields edge cases
   * Tests additional uncovered scenarios
   */
  describe('findChangedFields - additional coverage', () => {
    it('should handle non-object inputs (oldData not an object)', () => {
      const result = findChangedFields('string' as unknown, { key: 'value' });

      expect(result).toEqual([]);
    });

    it('should handle non-object inputs (newData not an object)', () => {
      const result = findChangedFields({ key: 'value' }, 'string' as unknown);

      expect(result).toEqual([]);
    });

    it('should handle null inputs', () => {
      const result = findChangedFields(null, { key: 'value' });

      expect(result).toEqual([]);
    });
  });

  /**
   * Test suite for populateSamlIdpAuthority function
   * Tests SAML IDP authority URL population logic
   */
  describe('populateSamlIdpAuthority', () => {
    it('should populate IDP authorityUrl from root authority', () => {
      const authConfig = {
        provider: AuthProvider.Saml,
        authority: 'https://idp.example.com/auth',
        samlConfiguration: {
          idp: {
            authorityUrl: '',
          },
        },
      } as unknown as Parameters<typeof populateSamlIdpAuthority>[0];

      populateSamlIdpAuthority(authConfig);

      expect(authConfig.samlConfiguration?.idp?.authorityUrl).toBe(
        'https://idp.example.com/auth'
      );
    });

    it('should use default if authority is missing and authorityUrl is empty', () => {
      const authConfig = {
        provider: AuthProvider.Saml,
        samlConfiguration: {
          idp: {
            authorityUrl: '',
          },
        },
      } as unknown as Parameters<typeof populateSamlIdpAuthority>[0];

      populateSamlIdpAuthority(authConfig);

      expect(authConfig.samlConfiguration?.idp?.authorityUrl).toBe(
        'http://localhost:8585/api/v1/auth/login'
      );
    });

    it('should not override existing IDP authorityUrl', () => {
      const authConfig = {
        provider: AuthProvider.Saml,
        authority: 'https://idp.example.com/auth',
        samlConfiguration: {
          idp: {
            authorityUrl: 'https://existing.example.com/auth',
          },
        },
      } as unknown as Parameters<typeof populateSamlIdpAuthority>[0];

      populateSamlIdpAuthority(authConfig);

      expect(authConfig.samlConfiguration?.idp?.authorityUrl).toBe(
        'https://idp.example.com/auth'
      );
    });

    it('should handle missing samlConfiguration gracefully', () => {
      const authConfig = {
        provider: AuthProvider.Saml,
        authority: 'https://idp.example.com/auth',
      } as unknown as Parameters<typeof populateSamlIdpAuthority>[0];

      expect(() => populateSamlIdpAuthority(authConfig)).not.toThrow();
    });

    it('should handle missing idp in samlConfiguration gracefully', () => {
      const authConfig = {
        provider: AuthProvider.Saml,
        authority: 'https://idp.example.com/auth',
        samlConfiguration: {},
      } as unknown as Parameters<typeof populateSamlIdpAuthority>[0];

      expect(() => populateSamlIdpAuthority(authConfig)).not.toThrow();
    });
  });

  /**
   * Test suite for populateSamlSpCallback function
   * Tests SAML SP callback URL population logic
   */
  describe('populateSamlSpCallback', () => {
    it('should populate SP callback and acs from root callbackUrl', () => {
      const authConfig = {
        provider: AuthProvider.Saml,
        callbackUrl: 'https://app.example.com/callback',
        samlConfiguration: {
          sp: {
            callback: '',
            acs: '',
          },
        },
      } as unknown as Parameters<typeof populateSamlSpCallback>[0];

      populateSamlSpCallback(authConfig);

      expect(authConfig.samlConfiguration?.sp?.callback).toBe(
        'https://app.example.com/callback'
      );
      expect(authConfig.samlConfiguration?.sp?.acs).toBe(
        'https://app.example.com/callback'
      );
    });

    it('should handle missing callbackUrl gracefully', () => {
      const authConfig = {
        provider: AuthProvider.Saml,
        samlConfiguration: {
          sp: {
            callback: 'existing-callback',
          },
        },
      } as unknown as Parameters<typeof populateSamlSpCallback>[0];

      populateSamlSpCallback(authConfig);

      expect(authConfig.samlConfiguration?.sp?.callback).toBe(
        'existing-callback'
      );
    });

    it('should handle missing samlConfiguration gracefully', () => {
      const authConfig = {
        provider: AuthProvider.Saml,
        callbackUrl: 'https://app.example.com/callback',
      } as unknown as Parameters<typeof populateSamlSpCallback>[0];

      expect(() => populateSamlSpCallback(authConfig)).not.toThrow();
    });

    it('should handle missing sp in samlConfiguration gracefully', () => {
      const authConfig = {
        provider: AuthProvider.Saml,
        callbackUrl: 'https://app.example.com/callback',
        samlConfiguration: {},
      } as unknown as Parameters<typeof populateSamlSpCallback>[0];

      expect(() => populateSamlSpCallback(authConfig)).not.toThrow();
    });
  });

  /**
   * Test suite for applySamlConfiguration function
   * Tests SAML configuration application logic
   */
  describe('applySamlConfiguration', () => {
    it('should apply both IDP and SP configurations', () => {
      const configData: FormData = {
        authenticationConfiguration: {
          provider: AuthProvider.Saml,
          authority: 'https://idp.example.com/auth',
          callbackUrl: 'https://app.example.com/callback',
          samlConfiguration: {
            idp: {
              authorityUrl: '',
            },
            sp: {
              callback: '',
              acs: '',
            },
          },
        } as unknown,
        authorizerConfiguration: {} as unknown,
      } as FormData;

      applySamlConfiguration(configData);

      const samlConfig = (
        configData.authenticationConfiguration as unknown as {
          samlConfiguration: {
            idp: { authorityUrl: string };
            sp: { callback: string; acs: string };
          };
        }
      ).samlConfiguration;

      expect(samlConfig.idp.authorityUrl).toBe('https://idp.example.com/auth');
      expect(samlConfig.sp.callback).toBe('https://app.example.com/callback');
      expect(samlConfig.sp.acs).toBe('https://app.example.com/callback');
    });

    it('should handle missing samlConfiguration gracefully', () => {
      const configData: FormData = {
        authenticationConfiguration: {
          provider: AuthProvider.Saml,
          authority: 'https://idp.example.com/auth',
        } as unknown,
        authorizerConfiguration: {} as unknown,
      } as FormData;

      expect(() => applySamlConfiguration(configData)).not.toThrow();
    });

    it('should handle partial samlConfiguration (only IDP)', () => {
      const configData: FormData = {
        authenticationConfiguration: {
          provider: AuthProvider.Saml,
          authority: 'https://idp.example.com/auth',
          samlConfiguration: {
            idp: {
              authorityUrl: '',
            },
          },
        } as unknown,
        authorizerConfiguration: {} as unknown,
      } as FormData;

      applySamlConfiguration(configData);

      const samlConfig = (
        configData.authenticationConfiguration as unknown as {
          samlConfiguration: { idp: { authorityUrl: string } };
        }
      ).samlConfiguration;

      expect(samlConfig.idp.authorityUrl).toBe('https://idp.example.com/auth');
    });

    it('should handle partial samlConfiguration (only SP)', () => {
      const configData: FormData = {
        authenticationConfiguration: {
          provider: AuthProvider.Saml,
          callbackUrl: 'https://app.example.com/callback',
          samlConfiguration: {
            sp: {
              callback: '',
              acs: '',
            },
          },
        } as unknown,
        authorizerConfiguration: {} as unknown,
      } as FormData;

      applySamlConfiguration(configData);

      const samlConfig = (
        configData.authenticationConfiguration as unknown as {
          samlConfiguration: { sp: { callback: string; acs: string } };
        }
      ).samlConfiguration;

      expect(samlConfig.sp.callback).toBe('https://app.example.com/callback');
      expect(samlConfig.sp.acs).toBe('https://app.example.com/callback');
    });

    it('should populate default IDP authorityUrl when authority is missing', () => {
      const configData: FormData = {
        authenticationConfiguration: {
          provider: AuthProvider.Saml,
          callbackUrl: 'https://app.example.com/callback',
          samlConfiguration: {
            idp: {
              authorityUrl: '',
            },
            sp: {
              callback: '',
              acs: '',
            },
          },
        } as unknown,
        authorizerConfiguration: {} as unknown,
      } as FormData;

      applySamlConfiguration(configData);

      const samlConfig = (
        configData.authenticationConfiguration as unknown as {
          samlConfiguration: { idp: { authorityUrl: string } };
        }
      ).samlConfiguration;

      expect(samlConfig.idp.authorityUrl).toBe(
        'http://localhost:8585/api/v1/auth/login'
      );
    });
  });

  /**
   * Test suite for getDefaultClientType function
   * Tests default client type determination for each provider
   */
  describe('getDefaultClientType', () => {
    it('should return Public for SAML provider', () => {
      const result = getDefaultClientType(AuthProvider.Saml);

      expect(result).toBe(ClientType.Public);
    });

    it('should return Public for LDAP provider', () => {
      const result = getDefaultClientType(AuthProvider.LDAP);

      expect(result).toBe(ClientType.Public);
    });

    it('should return Confidential for Google provider', () => {
      const result = getDefaultClientType(AuthProvider.Google);

      expect(result).toBe(ClientType.Confidential);
    });

    it('should return Confidential for Azure provider', () => {
      const result = getDefaultClientType(AuthProvider.Azure);

      expect(result).toBe(ClientType.Confidential);
    });

    it('should return Confidential for Okta provider', () => {
      const result = getDefaultClientType(AuthProvider.Okta);

      expect(result).toBe(ClientType.Confidential);
    });

    it('should return Confidential for Auth0 provider', () => {
      const result = getDefaultClientType(AuthProvider.Auth0);

      expect(result).toBe(ClientType.Confidential);
    });

    it('should return Confidential for AWS Cognito provider', () => {
      const result = getDefaultClientType(AuthProvider.AwsCognito);

      expect(result).toBe(ClientType.Confidential);
    });

    it('should return Confidential for Custom OIDC provider', () => {
      const result = getDefaultClientType(AuthProvider.CustomOidc);

      expect(result).toBe(ClientType.Confidential);
    });
  });

  /**
   * Test suite for createFreshFormData function
   * Tests creation of fresh form data for different providers
   */
  describe('createFreshFormData', () => {
    it('should create fresh form data for Google provider', () => {
      const result = createFreshFormData(AuthProvider.Google);

      expect(result.authenticationConfiguration.provider).toBe(
        AuthProvider.Google
      );
      expect(result.authenticationConfiguration.clientType).toBe(
        ClientType.Confidential
      );
      expect(result.authenticationConfiguration.authority).toBe(
        'https://accounts.google.com'
      );
      expect(result.authenticationConfiguration.publicKeyUrls).toEqual([
        'https://www.googleapis.com/oauth2/v3/certs',
      ]);
      expect(
        result.authenticationConfiguration.oidcConfiguration
      ).toBeDefined();
      expect(result.authorizerConfiguration).toBeDefined();
    });

    it('should create fresh form data for SAML provider', () => {
      const result = createFreshFormData(AuthProvider.Saml);

      expect(result.authenticationConfiguration.provider).toBe(
        AuthProvider.Saml
      );
      expect(result.authenticationConfiguration.clientType).toBe(
        ClientType.Public
      );
      expect(
        result.authenticationConfiguration.samlConfiguration
      ).toBeDefined();
      expect(
        result.authenticationConfiguration.samlConfiguration?.idp
      ).toBeDefined();
      expect(
        result.authenticationConfiguration.samlConfiguration?.sp
      ).toBeDefined();
      expect(result.authorizerConfiguration).toBeDefined();
    });

    it('should create fresh form data for LDAP provider', () => {
      const result = createFreshFormData(AuthProvider.LDAP);

      expect(result.authenticationConfiguration.provider).toBe(
        AuthProvider.LDAP
      );
      expect(result.authenticationConfiguration.clientType).toBe(
        ClientType.Public
      );
      expect(result.authorizerConfiguration).toBeDefined();
    });

    it('should create fresh form data for Azure provider', () => {
      const result = createFreshFormData(AuthProvider.Azure);

      expect(result.authenticationConfiguration.provider).toBe(
        AuthProvider.Azure
      );
      expect(result.authenticationConfiguration.clientType).toBe(
        ClientType.Confidential
      );
      expect(
        result.authenticationConfiguration.oidcConfiguration
      ).toBeDefined();
      expect(result.authorizerConfiguration).toBeDefined();
    });

    it('should create fresh form data for Auth0 provider', () => {
      const result = createFreshFormData(AuthProvider.Auth0);

      expect(result.authenticationConfiguration.provider).toBe(
        AuthProvider.Auth0
      );
      expect(result.authenticationConfiguration.clientType).toBe(
        ClientType.Confidential
      );
      expect(result.authorizerConfiguration).toBeDefined();
    });

    it('should create fresh form data for Okta provider', () => {
      const result = createFreshFormData(AuthProvider.Okta);

      expect(result.authenticationConfiguration.provider).toBe(
        AuthProvider.Okta
      );
      expect(result.authenticationConfiguration.clientType).toBe(
        ClientType.Confidential
      );
      expect(result.authorizerConfiguration).toBeDefined();
    });

    it('should create fresh form data for AWS Cognito provider', () => {
      const result = createFreshFormData(AuthProvider.AwsCognito);

      expect(result.authenticationConfiguration.provider).toBe(
        AuthProvider.AwsCognito
      );
      expect(result.authenticationConfiguration.clientType).toBe(
        ClientType.Confidential
      );
      expect(result.authorizerConfiguration).toBeDefined();
    });

    it('should create fresh form data for Custom OIDC provider', () => {
      const result = createFreshFormData(AuthProvider.CustomOidc);

      expect(result.authenticationConfiguration.provider).toBe(
        AuthProvider.CustomOidc
      );
      expect(result.authenticationConfiguration.clientType).toBe(
        ClientType.Confidential
      );
      expect(result.authorizerConfiguration).toBeDefined();
    });

    it('should always include valid authorizer configuration', () => {
      const result = createFreshFormData(AuthProvider.Google);

      expect(result.authorizerConfiguration.className).toBe(
        'org.openmetadata.service.security.DefaultAuthorizer'
      );
      expect(result.authorizerConfiguration.containerRequestFilter).toBe(
        'org.openmetadata.service.security.JwtFilter'
      );
      expect(result.authorizerConfiguration.enforcePrincipalDomain).toBe(false);
      expect(result.authorizerConfiguration.enableSecureSocketConnection).toBe(
        false
      );
    });
  });

  /**
   * Test suite for removeSchemaFields function
   * Tests removal of fields from schema properties
   */
  describe('removeSchemaFields', () => {
    it('should remove single field from schema properties', () => {
      const schema = {
        properties: {
          fieldA: { type: 'string' },
          fieldB: { type: 'number' },
          fieldC: { type: 'boolean' },
        },
      };

      removeSchemaFields(schema, ['fieldB']);

      expect(schema.properties).toEqual({
        fieldA: { type: 'string' },
        fieldC: { type: 'boolean' },
      });
    });

    it('should remove multiple fields from schema properties', () => {
      const schema = {
        properties: {
          fieldA: { type: 'string' },
          fieldB: { type: 'number' },
          fieldC: { type: 'boolean' },
          fieldD: { type: 'array' },
        },
      };

      removeSchemaFields(schema, ['fieldB', 'fieldD']);

      expect(schema.properties).toEqual({
        fieldA: { type: 'string' },
        fieldC: { type: 'boolean' },
      });
    });

    it('should handle removal of non-existent fields gracefully', () => {
      const schema = {
        properties: {
          fieldA: { type: 'string' },
          fieldB: { type: 'number' },
        },
      };

      removeSchemaFields(schema, ['nonExistent', 'fieldB']);

      expect(schema.properties).toEqual({
        fieldA: { type: 'string' },
      });
    });

    it('should handle schema without properties object', () => {
      const schema = {
        type: 'object',
      };

      removeSchemaFields(schema, ['fieldA']);

      expect(schema).toEqual({ type: 'object' });
    });

    it('should handle empty fieldsToRemove array', () => {
      const schema = {
        properties: {
          fieldA: { type: 'string' },
          fieldB: { type: 'number' },
        },
      };

      removeSchemaFields(schema, []);

      expect(schema.properties).toEqual({
        fieldA: { type: 'string' },
        fieldB: { type: 'number' },
      });
    });

    it('should handle schema with properties as non-object', () => {
      const schema = {
        properties: null,
      };

      removeSchemaFields(schema, ['fieldA']);

      expect(schema.properties).toBeNull();
    });
  });

  /**
   * Test suite for removeRequiredFields function
   * Tests removal of fields from schema required array
   */
  describe('removeRequiredFields', () => {
    it('should remove single field from required array', () => {
      const schema = {
        required: ['fieldA', 'fieldB', 'fieldC'],
      };

      removeRequiredFields(schema, ['fieldB']);

      expect(schema.required).toEqual(['fieldA', 'fieldC']);
    });

    it('should remove multiple fields from required array', () => {
      const schema = {
        required: ['fieldA', 'fieldB', 'fieldC', 'fieldD'],
      };

      removeRequiredFields(schema, ['fieldB', 'fieldD']);

      expect(schema.required).toEqual(['fieldA', 'fieldC']);
    });

    it('should handle removal of non-existent fields from required', () => {
      const schema = {
        required: ['fieldA', 'fieldB'],
      };

      removeRequiredFields(schema, ['nonExistent', 'fieldB']);

      expect(schema.required).toEqual(['fieldA']);
    });

    it('should handle schema without required array', () => {
      const schema: Record<string, unknown> = {
        properties: { fieldA: { type: 'string' } },
      };

      removeRequiredFields(schema, ['fieldA']);

      expect(schema.required).toBeUndefined();
    });

    it('should handle empty fieldsToRemove array', () => {
      const schema = {
        required: ['fieldA', 'fieldB'],
      };

      removeRequiredFields(schema, []);

      expect(schema.required).toEqual(['fieldA', 'fieldB']);
    });

    it('should handle schema with required as non-array', () => {
      const schema = {
        required: null,
      };

      removeRequiredFields(schema, ['fieldA']);

      expect(schema.required).toBeNull();
    });

    it('should remove all fields from required if all match', () => {
      const schema = {
        required: ['fieldA', 'fieldB'],
      };

      removeRequiredFields(schema, ['fieldA', 'fieldB']);

      expect(schema.required).toEqual([]);
    });
  });

  /**
   * Test suite for handleConfidentialToPublicSwitch function
   * Tests migration of fields when switching from Confidential to Public client type
   */
  describe('handleConfidentialToPublicSwitch', () => {
    it('should move callback URL from OIDC config to root level', () => {
      const authConfig = {
        provider: AuthProvider.Azure,
        oidcConfiguration: {
          callbackUrl: 'https://app.example.com/callback',
        },
      } as unknown as Parameters<typeof handleConfidentialToPublicSwitch>[0];

      handleConfidentialToPublicSwitch(authConfig);

      expect(authConfig.callbackUrl).toBe('https://app.example.com/callback');
    });

    it('should use default callback URL if OIDC callbackUrl is missing', () => {
      const authConfig = {
        provider: AuthProvider.Azure,
        oidcConfiguration: {},
      } as unknown as Parameters<typeof handleConfidentialToPublicSwitch>[0];

      handleConfidentialToPublicSwitch(authConfig);

      expect(authConfig.callbackUrl).toBe('http://localhost:8585/callback');
    });

    it('should not override existing root callbackUrl', () => {
      const authConfig = {
        provider: AuthProvider.Azure,
        callbackUrl: 'https://existing.example.com/callback',
        oidcConfiguration: {
          callbackUrl: 'https://oidc.example.com/callback',
        },
      } as unknown as Parameters<typeof handleConfidentialToPublicSwitch>[0];

      handleConfidentialToPublicSwitch(authConfig);

      expect(authConfig.callbackUrl).toBe(
        'https://existing.example.com/callback'
      );
    });

    it('should add Google-specific defaults for Google provider', () => {
      const authConfig = {
        provider: AuthProvider.Google,
        oidcConfiguration: {
          callbackUrl: 'https://app.example.com/callback',
        },
      } as unknown as Parameters<typeof handleConfidentialToPublicSwitch>[0];

      handleConfidentialToPublicSwitch(authConfig);

      expect(authConfig.authority).toBe('https://accounts.google.com');
      expect(authConfig.publicKeyUrls).toEqual([
        'https://www.googleapis.com/oauth2/v3/certs',
      ]);
    });

    it('should not add Google defaults for non-Google providers', () => {
      const authConfig = {
        provider: AuthProvider.Azure,
        oidcConfiguration: {
          callbackUrl: 'https://app.example.com/callback',
        },
      } as unknown as Parameters<typeof handleConfidentialToPublicSwitch>[0];

      handleConfidentialToPublicSwitch(authConfig);

      expect(authConfig.authority).toBeUndefined();
      expect(authConfig.publicKeyUrls).toBeUndefined();
    });
  });

  /**
   * Test suite for handlePublicToConfidentialSwitch function
   * Tests migration of fields when switching from Public to Confidential client type
   */
  describe('handlePublicToConfidentialSwitch', () => {
    it('should initialize OIDC configuration if missing', () => {
      const authConfig = {
        provider: AuthProvider.Azure,
        callbackUrl: 'https://app.example.com/callback',
      } as unknown as Parameters<typeof handlePublicToConfidentialSwitch>[0];

      handlePublicToConfidentialSwitch(authConfig);

      expect(authConfig.oidcConfiguration).toBeDefined();
    });

    it('should move callback URL from root to OIDC config', () => {
      const authConfig = {
        provider: AuthProvider.Azure,
        callbackUrl: 'https://app.example.com/callback',
      } as unknown as Parameters<typeof handlePublicToConfidentialSwitch>[0];

      handlePublicToConfidentialSwitch(authConfig);

      expect(
        (authConfig.oidcConfiguration as Record<string, unknown>)?.callbackUrl
      ).toBe('https://app.example.com/callback');
    });

    it('should not override existing OIDC callbackUrl', () => {
      const authConfig = {
        provider: AuthProvider.Azure,
        callbackUrl: 'https://root.example.com/callback',
        oidcConfiguration: {
          callbackUrl: 'https://existing.example.com/callback',
        },
      } as unknown as Parameters<typeof handlePublicToConfidentialSwitch>[0];

      handlePublicToConfidentialSwitch(authConfig);

      expect(
        (authConfig.oidcConfiguration as Record<string, unknown>)?.callbackUrl
      ).toBe('https://existing.example.com/callback');
    });

    it('should use default callback URL if root callbackUrl is missing', () => {
      const authConfig = {
        provider: AuthProvider.Azure,
      } as unknown as Parameters<typeof handlePublicToConfidentialSwitch>[0];

      handlePublicToConfidentialSwitch(authConfig);

      expect(
        (authConfig.oidcConfiguration as Record<string, unknown>)?.callbackUrl
      ).toBe('http://localhost:8585/callback');
    });

    it('should add Google-specific OIDC defaults for Google provider', () => {
      const authConfig = {
        provider: AuthProvider.Google,
        callbackUrl: 'https://app.example.com/callback',
      } as unknown as Parameters<typeof handlePublicToConfidentialSwitch>[0];

      handlePublicToConfidentialSwitch(authConfig);

      const oidcConfig = authConfig.oidcConfiguration as Record<
        string,
        unknown
      >;

      expect(oidcConfig.type).toBe(AuthProvider.Google);
      expect(oidcConfig.discoveryUri).toBe(
        'https://accounts.google.com/.well-known/openid-configuration'
      );
      expect(oidcConfig.tokenValidity).toBe(3600);
      expect(oidcConfig.sessionExpiry).toBe(604800);
      expect(oidcConfig.serverUrl).toBe('http://localhost:8585');
      expect(oidcConfig.scope).toBe('openid email profile');
      expect(oidcConfig.useNonce).toBe(false);
      expect(oidcConfig.preferredJwsAlgorithm).toBe('RS256');
      expect(oidcConfig.responseType).toBe('code');
      expect(oidcConfig.disablePkce).toBe(false);
      expect(oidcConfig.maxClockSkew).toBe(0);
      expect(oidcConfig.clientAuthenticationMethod).toBe('client_secret_post');
    });

    it('should not override existing Google OIDC field values', () => {
      const authConfig = {
        provider: AuthProvider.Google,
        callbackUrl: 'https://app.example.com/callback',
        oidcConfiguration: {
          scope: 'custom scope',
          useNonce: true,
          preferredJwsAlgorithm: 'ES256',
          responseType: 'id_token',
          disablePkce: true,
          maxClockSkew: 10,
          clientAuthenticationMethod: 'client_secret_basic',
        },
      } as unknown as Parameters<typeof handlePublicToConfidentialSwitch>[0];

      handlePublicToConfidentialSwitch(authConfig);

      const oidcConfig = authConfig.oidcConfiguration as Record<
        string,
        unknown
      >;

      expect(oidcConfig.scope).toBe('custom scope');
      expect(oidcConfig.useNonce).toBe(true);
      expect(oidcConfig.preferredJwsAlgorithm).toBe('ES256');
      expect(oidcConfig.responseType).toBe('id_token');
      expect(oidcConfig.disablePkce).toBe(true);
      expect(oidcConfig.maxClockSkew).toBe(10);
      expect(oidcConfig.clientAuthenticationMethod).toBe('client_secret_basic');
    });

    it('should not add Google defaults for non-Google providers', () => {
      const authConfig = {
        provider: AuthProvider.Azure,
        callbackUrl: 'https://app.example.com/callback',
      } as unknown as Parameters<typeof handlePublicToConfidentialSwitch>[0];

      handlePublicToConfidentialSwitch(authConfig);

      const oidcConfig = authConfig.oidcConfiguration as Record<
        string,
        unknown
      >;

      expect(oidcConfig.type).toBeUndefined();
      expect(oidcConfig.discoveryUri).toBeUndefined();
      expect(oidcConfig.tokenValidity).toBeUndefined();
    });
  });

  /**
   * Test suite for handleClientTypeChange function
   * Tests coordinated client type transition handling
   */
  describe('handleClientTypeChange', () => {
    it('should handle Confidential to Public transition', () => {
      const authConfig = {
        provider: AuthProvider.Azure,
        clientType: ClientType.Public,
        oidcConfiguration: {
          callbackUrl: 'https://app.example.com/callback',
        },
      } as unknown as Parameters<typeof handleClientTypeChange>[0];

      handleClientTypeChange(
        authConfig,
        ClientType.Confidential,
        ClientType.Public
      );

      expect(authConfig?.callbackUrl).toBe('https://app.example.com/callback');
    });

    it('should handle Public to Confidential transition', () => {
      const authConfig = {
        provider: AuthProvider.Azure,
        clientType: ClientType.Confidential,
        callbackUrl: 'https://app.example.com/callback',
      } as unknown as Parameters<typeof handleClientTypeChange>[0];

      handleClientTypeChange(
        authConfig,
        ClientType.Public,
        ClientType.Confidential
      );

      expect(authConfig?.oidcConfiguration).toBeDefined();
      expect(
        (authConfig?.oidcConfiguration as Record<string, unknown>)?.callbackUrl
      ).toBe('https://app.example.com/callback');
    });

    it('should do nothing if authConfig is undefined', () => {
      expect(() =>
        handleClientTypeChange(undefined, ClientType.Public, ClientType.Public)
      ).not.toThrow();
    });

    it('should do nothing if newClientType is undefined', () => {
      const authConfig = {
        provider: AuthProvider.Azure,
      } as unknown as Parameters<typeof handleClientTypeChange>[0];

      handleClientTypeChange(authConfig, ClientType.Public, undefined);

      expect(authConfig?.oidcConfiguration).toBeUndefined();
      expect(authConfig?.callbackUrl).toBeUndefined();
    });

    it('should do nothing if client type has not changed', () => {
      const authConfig = {
        provider: AuthProvider.Azure,
        clientType: ClientType.Public,
      } as unknown as Parameters<typeof handleClientTypeChange>[0];

      handleClientTypeChange(authConfig, ClientType.Public, ClientType.Public);

      expect(authConfig?.oidcConfiguration).toBeUndefined();
      expect(authConfig?.callbackUrl).toBeUndefined();
    });

    it('should handle Google provider Confidential to Public with defaults', () => {
      const authConfig = {
        provider: AuthProvider.Google,
        clientType: ClientType.Public,
        oidcConfiguration: {
          callbackUrl: 'https://app.example.com/callback',
        },
      } as unknown as Parameters<typeof handleClientTypeChange>[0];

      handleClientTypeChange(
        authConfig,
        ClientType.Confidential,
        ClientType.Public
      );

      expect(authConfig?.authority).toBe('https://accounts.google.com');
      expect(authConfig?.publicKeyUrls).toEqual([
        'https://www.googleapis.com/oauth2/v3/certs',
      ]);
    });

    it('should handle Google provider Public to Confidential with OIDC defaults', () => {
      const authConfig = {
        provider: AuthProvider.Google,
        clientType: ClientType.Confidential,
        callbackUrl: 'https://app.example.com/callback',
      } as unknown as Parameters<typeof handleClientTypeChange>[0];

      handleClientTypeChange(
        authConfig,
        ClientType.Public,
        ClientType.Confidential
      );

      const oidcConfig = authConfig?.oidcConfiguration as Record<
        string,
        unknown
      >;

      expect(oidcConfig.type).toBe(AuthProvider.Google);
      expect(oidcConfig.discoveryUri).toBe(
        'https://accounts.google.com/.well-known/openid-configuration'
      );
      expect(oidcConfig.tokenValidity).toBe(3600);
    });

    it('should not perform transition when previousClientType is undefined (no prior state)', () => {
      const authConfig = {
        provider: AuthProvider.Azure,
        clientType: ClientType.Confidential,
        callbackUrl: 'https://app.example.com/callback',
      } as unknown as Parameters<typeof handleClientTypeChange>[0];

      handleClientTypeChange(authConfig, undefined, ClientType.Confidential);

      // Should not perform any transition when previous state is unknown
      expect(authConfig?.oidcConfiguration).toBeUndefined();
    });
  });

  /**
   * Test suite for isValidNonBasicProvider function
   * Tests validation of SSO provider configuration
   */
  describe('isValidNonBasicProvider', () => {
    it('should return true for valid non-Basic provider (Google)', () => {
      const config = {
        authenticationConfiguration: {
          provider: AuthProvider.Google,
        },
      };

      expect(isValidNonBasicProvider(config)).toBe(true);
    });

    it('should return true for valid non-Basic provider (Azure)', () => {
      const config = {
        authenticationConfiguration: {
          provider: AuthProvider.Azure,
        },
      };

      expect(isValidNonBasicProvider(config)).toBe(true);
    });

    it('should return true for valid non-Basic provider (Okta)', () => {
      const config = {
        authenticationConfiguration: {
          provider: AuthProvider.Okta,
        },
      };

      expect(isValidNonBasicProvider(config)).toBe(true);
    });

    it('should return true for valid non-Basic provider (SAML)', () => {
      const config = {
        authenticationConfiguration: {
          provider: AuthProvider.Saml,
        },
      };

      expect(isValidNonBasicProvider(config)).toBe(true);
    });

    it('should return false for Basic provider', () => {
      const config = {
        authenticationConfiguration: {
          provider: AuthProvider.Basic,
        },
      };

      expect(isValidNonBasicProvider(config)).toBe(false);
    });

    it('should return false for undefined config', () => {
      expect(isValidNonBasicProvider(undefined)).toBe(false);
    });

    it('should return false for config with no authenticationConfiguration', () => {
      const config = {};

      expect(isValidNonBasicProvider(config)).toBe(false);
    });

    it('should return false for config with no provider', () => {
      const config = {
        authenticationConfiguration: {},
      };

      expect(isValidNonBasicProvider(config)).toBe(false);
    });

    it('should return false for config with undefined provider', () => {
      const config = {
        authenticationConfiguration: {
          provider: undefined,
        },
      };

      expect(isValidNonBasicProvider(config)).toBe(false);
    });
  });

  /**
   * Test suite for extractFieldName function
   * Tests field name extraction from RJSF field IDs
   */
  describe('extractFieldName', () => {
    it('should extract simple field name from path', () => {
      expect(
        extractFieldName('root/authenticationConfiguration/clientId')
      ).toBe('clientId');
    });

    it('should extract authority field name', () => {
      expect(
        extractFieldName('root/authenticationConfiguration/authority')
      ).toBe('authority');
    });

    it('should map "secret" to "clientSecret"', () => {
      expect(extractFieldName('root/authenticationConfiguration/secret')).toBe(
        'clientSecret'
      );
    });

    it('should map "domain" to "authority" for Auth0', () => {
      expect(extractFieldName('root/authenticationConfiguration/domain')).toBe(
        'authority'
      );
    });

    it('should map "secretKey" to "clientSecret"', () => {
      expect(
        extractFieldName('root/authenticationConfiguration/secretKey')
      ).toBe('clientSecret');
    });

    it('should extract callbackUrl field name', () => {
      expect(
        extractFieldName('root/authenticationConfiguration/callbackUrl')
      ).toBe('callbackUrl');
    });

    it('should extract enableSelfSignup field name', () => {
      expect(
        extractFieldName('root/authenticationConfiguration/enableSelfSignup')
      ).toBe('enableSelfSignup');
    });

    it('should extract scopes field name', () => {
      expect(extractFieldName('root/authenticationConfiguration/scopes')).toBe(
        'scopes'
      );
    });

    it('should extract oidcConfiguration field name', () => {
      expect(
        extractFieldName('root/authenticationConfiguration/oidcConfiguration')
      ).toBe('oidcConfiguration');
    });

    it('should extract samlConfiguration field name', () => {
      expect(
        extractFieldName('root/authenticationConfiguration/samlConfiguration')
      ).toBe('samlConfiguration');
    });

    it('should extract ldapConfiguration field name', () => {
      expect(
        extractFieldName('root/authenticationConfiguration/ldapConfiguration')
      ).toBe('ldapConfiguration');
    });

    it('should extract providerName field name', () => {
      expect(
        extractFieldName('root/authenticationConfiguration/providerName')
      ).toBe('providerName');
    });

    it('should return clientSecret for mapped field', () => {
      expect(
        extractFieldName('root/authenticationConfiguration/clientSecret')
      ).toBe('clientSecret');
    });

    it('should return unmapped field name as-is', () => {
      expect(
        extractFieldName('root/authenticationConfiguration/unknownField')
      ).toBe('unknownField');
    });

    it('should handle nested paths correctly', () => {
      expect(
        extractFieldName(
          'root/authenticationConfiguration/oidcConfiguration/clientId'
        )
      ).toBe('clientId');
    });
  });

  /**
   * Test suite for createDOMFocusHandler function
   * Tests DOM focus event handler creation
   */
  describe('createDOMFocusHandler', () => {
    let setActiveFieldMock: jest.Mock;
    let mockElement: HTMLElement;

    beforeEach(() => {
      setActiveFieldMock = jest.fn();
      mockElement = document.createElement('div');
      mockElement.id = 'root/authenticationConfiguration/clientId';
      document.body.appendChild(mockElement);
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should create a focus handler that extracts field name', () => {
      const handler = createDOMFocusHandler(setActiveFieldMock);
      const event = new FocusEvent('focusin', { bubbles: true });
      Object.defineProperty(event, 'target', { value: mockElement });

      handler(event);

      expect(setActiveFieldMock).toHaveBeenCalledWith('clientId');
    });

    it('should handle focus on element with mapped field name', () => {
      mockElement.id = 'root/authenticationConfiguration/secret';
      const handler = createDOMFocusHandler(setActiveFieldMock);
      const event = new FocusEvent('focusin', { bubbles: true });
      Object.defineProperty(event, 'target', { value: mockElement });

      handler(event);

      expect(setActiveFieldMock).toHaveBeenCalledWith('clientSecret');
    });

    it('should traverse up the DOM tree to find root element', () => {
      const childElement = document.createElement('input');
      mockElement.appendChild(childElement);

      const handler = createDOMFocusHandler(setActiveFieldMock);
      const event = new FocusEvent('focusin', { bubbles: true });
      Object.defineProperty(event, 'target', { value: childElement });

      handler(event);

      expect(setActiveFieldMock).toHaveBeenCalledWith('clientId');
    });

    it('should not call setActiveField if no root element found', () => {
      const orphanElement = document.createElement('div');
      orphanElement.id = 'no-matching-prefix';

      const handler = createDOMFocusHandler(setActiveFieldMock);
      const event = new FocusEvent('focusin', { bubbles: true });
      Object.defineProperty(event, 'target', { value: orphanElement });

      handler(event);

      expect(setActiveFieldMock).not.toHaveBeenCalled();
    });
  });

  /**
   * Test suite for createDOMClickHandler function
   * Tests DOM click event handler creation
   */
  describe('createDOMClickHandler', () => {
    let setActiveFieldMock: jest.Mock;
    let mockElement: HTMLElement;

    beforeEach(() => {
      setActiveFieldMock = jest.fn();
      mockElement = document.createElement('div');
      mockElement.id = 'root/authenticationConfiguration/authority';
      document.body.appendChild(mockElement);
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should create a click handler that extracts field name', () => {
      const handler = createDOMClickHandler(setActiveFieldMock);
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: mockElement });

      handler(event);

      expect(setActiveFieldMock).toHaveBeenCalledWith('authority');
    });

    it('should handle click on element with mapped field name', () => {
      mockElement.id = 'root/authenticationConfiguration/domain';
      const handler = createDOMClickHandler(setActiveFieldMock);
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: mockElement });

      handler(event);

      expect(setActiveFieldMock).toHaveBeenCalledWith('authority');
    });

    it('should traverse up the DOM tree to find root element', () => {
      const childElement = document.createElement('button');
      mockElement.appendChild(childElement);

      const handler = createDOMClickHandler(setActiveFieldMock);
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: childElement });

      handler(event);

      expect(setActiveFieldMock).toHaveBeenCalledWith('authority');
    });

    it('should not call setActiveField if no root element found', () => {
      const orphanElement = document.createElement('div');
      orphanElement.id = 'no-matching-prefix';

      const handler = createDOMClickHandler(setActiveFieldMock);
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: orphanElement });

      handler(event);

      expect(setActiveFieldMock).not.toHaveBeenCalled();
    });

    it('should handle nested elements correctly', () => {
      const nestedElement = document.createElement('span');
      const buttonElement = document.createElement('button');
      mockElement.appendChild(buttonElement);
      buttonElement.appendChild(nestedElement);

      const handler = createDOMClickHandler(setActiveFieldMock);
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: nestedElement });

      handler(event);

      expect(setActiveFieldMock).toHaveBeenCalledWith('authority');
    });
  });

  /**
   * Test suite for updateLoadingState function
   * Tests conditional loading state updates based on modal save flag
   */
  describe('updateLoadingState', () => {
    it('should update loading state when isModalSave is false', () => {
      const setIsLoadingMock = jest.fn();
      updateLoadingState(false, setIsLoadingMock, true);

      expect(setIsLoadingMock).toHaveBeenCalledWith(true);
    });

    it('should not update loading state when isModalSave is true', () => {
      const setIsLoadingMock = jest.fn();
      updateLoadingState(true, setIsLoadingMock, true);

      expect(setIsLoadingMock).not.toHaveBeenCalled();
    });

    it('should update loading state to false when isModalSave is false', () => {
      const setIsLoadingMock = jest.fn();
      updateLoadingState(false, setIsLoadingMock, false);

      expect(setIsLoadingMock).toHaveBeenCalledWith(false);
    });

    it('should not update loading state to false when isModalSave is true', () => {
      const setIsLoadingMock = jest.fn();
      updateLoadingState(true, setIsLoadingMock, false);

      expect(setIsLoadingMock).not.toHaveBeenCalled();
    });
  });

  /**
   * Test suite for hasFieldValidationErrors function
   * Tests type guard for field-level validation errors
   */
  describe('hasFieldValidationErrors', () => {
    it('should return true for error with field validation errors', () => {
      const error = {
        response: {
          data: {
            status: 'failed',
            errors: [{ field: 'clientId', error: 'Required field' }],
          },
        },
      };

      expect(hasFieldValidationErrors(error)).toBe(true);
    });

    it('should return true for error with empty errors array', () => {
      const error = {
        response: {
          data: {
            status: 'failed',
            errors: [],
          },
        },
      };

      expect(hasFieldValidationErrors(error)).toBe(true);
    });

    it('should return false for error without response', () => {
      const error = {
        message: 'Network error',
      };

      expect(hasFieldValidationErrors(error)).toBe(false);
    });

    it('should return false for error without data', () => {
      const error = {
        response: {},
      };

      expect(hasFieldValidationErrors(error)).toBe(false);
    });

    it('should return false for error with null data', () => {
      const error = {
        response: {
          data: null,
        },
      };

      expect(hasFieldValidationErrors(error)).toBe(false);
    });

    it('should return false for error with non-object data', () => {
      const error = {
        response: {
          data: 'error string',
        },
      };

      expect(hasFieldValidationErrors(error)).toBe(false);
    });

    it('should return false for error without errors field', () => {
      const error = {
        response: {
          data: {
            status: 'failed',
            message: 'Validation failed',
          },
        },
      };

      expect(hasFieldValidationErrors(error)).toBe(false);
    });

    it('should return false for undefined error', () => {
      expect(hasFieldValidationErrors(undefined)).toBe(false);
    });

    it('should return false for null error', () => {
      expect(hasFieldValidationErrors(null)).toBe(false);
    });

    it('should return true for error with multiple field validation errors', () => {
      const error = {
        response: {
          data: {
            status: 'failed',
            errors: [
              { field: 'clientId', error: 'Required field' },
              { field: 'authority', error: 'Invalid URL' },
              { field: 'callbackUrl', error: 'Invalid format' },
            ],
          },
        },
      };

      expect(hasFieldValidationErrors(error)).toBe(true);
    });
  });

  describe('createFormKeyDownHandler', () => {
    let handler: (e: KeyboardEvent) => void;
    let mockEvent: Partial<KeyboardEvent>;

    beforeEach(() => {
      handler = createFormKeyDownHandler();
      mockEvent = {
        key: 'Enter',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      };
    });

    describe('should prevent default for regular input fields', () => {
      it('should prevent default when Enter is pressed in INPUT element', () => {
        const input = document.createElement('input');
        Object.defineProperty(mockEvent, 'target', {
          value: input,
          writable: true,
        });

        handler(mockEvent as KeyboardEvent);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockEvent.stopPropagation).toHaveBeenCalled();
      });

      it('should prevent default when Enter is pressed in Ant Design input field', () => {
        const div = document.createElement('div');
        div.className = 'ant-input';
        Object.defineProperty(mockEvent, 'target', {
          value: div,
          writable: true,
        });

        handler(mockEvent as KeyboardEvent);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockEvent.stopPropagation).toHaveBeenCalled();
      });
    });

    describe('should NOT prevent default for special cases', () => {
      it('should NOT prevent default when Enter is pressed in TEXTAREA', () => {
        const textarea = document.createElement('textarea');
        Object.defineProperty(mockEvent, 'target', {
          value: textarea,
          writable: true,
        });

        handler(mockEvent as KeyboardEvent);

        expect(mockEvent.preventDefault).not.toHaveBeenCalled();
        expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
      });

      it('should NOT prevent default when Enter is pressed in Select tags component', () => {
        const input = document.createElement('input');
        const selector = document.createElement('div');
        selector.className = 'ant-select-selector';
        selector.appendChild(input);
        Object.defineProperty(mockEvent, 'target', {
          value: input,
          writable: true,
        });

        handler(mockEvent as KeyboardEvent);

        expect(mockEvent.preventDefault).not.toHaveBeenCalled();
        expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
      });

      it('should NOT prevent default for non-Enter keys', () => {
        const input = document.createElement('input');
        Object.defineProperty(mockEvent, 'target', {
          value: input,
          writable: true,
        });
        Object.defineProperty(mockEvent, 'key', {
          value: 'Tab',
          writable: true,
        });

        handler(mockEvent as KeyboardEvent);

        expect(mockEvent.preventDefault).not.toHaveBeenCalled();
        expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
      });

      it('should NOT prevent default for non-input elements', () => {
        const div = document.createElement('div');
        Object.defineProperty(mockEvent, 'target', {
          value: div,
          writable: true,
        });

        handler(mockEvent as KeyboardEvent);

        expect(mockEvent.preventDefault).not.toHaveBeenCalled();
        expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
      });

      it('should NOT prevent default for button elements', () => {
        const button = document.createElement('button');
        Object.defineProperty(mockEvent, 'target', {
          value: button,
          writable: true,
        });

        handler(mockEvent as KeyboardEvent);

        expect(mockEvent.preventDefault).not.toHaveBeenCalled();
        expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
      });
    });

    describe('edge cases', () => {
      it('should handle null target gracefully', () => {
        Object.defineProperty(mockEvent, 'target', {
          value: null,
          writable: true,
        });

        expect(() => handler(mockEvent as KeyboardEvent)).not.toThrow();
        expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      });

      it('should handle undefined target gracefully', () => {
        Object.defineProperty(mockEvent, 'target', {
          value: undefined,
          writable: true,
        });

        expect(() => handler(mockEvent as KeyboardEvent)).not.toThrow();
        expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      });

      it('should prevent default for nested input inside ant-input div', () => {
        const input = document.createElement('input');
        const antInputDiv = document.createElement('div');
        antInputDiv.className = 'ant-input';
        antInputDiv.appendChild(input);
        Object.defineProperty(mockEvent, 'target', {
          value: antInputDiv,
          writable: true,
        });

        handler(mockEvent as KeyboardEvent);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockEvent.stopPropagation).toHaveBeenCalled();
      });

      it('should prevent default for input with multiple classes including ant-input', () => {
        const div = document.createElement('div');
        div.className = 'custom-class ant-input another-class';
        Object.defineProperty(mockEvent, 'target', {
          value: div,
          writable: true,
        });

        handler(mockEvent as KeyboardEvent);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockEvent.stopPropagation).toHaveBeenCalled();
      });
    });
  });
});
