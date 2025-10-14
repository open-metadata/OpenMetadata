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
  cleanupProviderSpecificFields,
  clearFieldError,
  findChangedFields,
  FormData,
  generatePatches,
  getDefaultsForProvider,
  getProviderDisplayName,
  getProviderIcon,
  isValidUrl,
  parseValidationErrors,
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
  GOOGLE_SSO_DEFAULTS: {
    authority: 'https://accounts.google.com',
    publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
    discoveryUri:
      'https://accounts.google.com/.well-known/openid-configuration',
    tokenValidity: 3600,
    sessionExpiry: 604800,
    serverUrl: 'http://localhost:8585',
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
   * Test suite for generatePatches function
   * Tests generation of JSON Patch operations for configuration changes
   */
  describe('generatePatches', () => {
    it('should return empty array for no changes', () => {
      const oldData: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          authority: 'https://accounts.google.com',
          clientId: 'test-id',
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

      const patches = generatePatches(oldData, oldData);

      expect(patches).toEqual([]);
    });

    it('should generate patches for authentication config changes', () => {
      const oldData: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          authority: 'https://accounts.google.com',
          clientId: 'old-id',
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

      const newData: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          authority: 'https://accounts.google.com',
          clientId: 'new-id',
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

      const patches = generatePatches(oldData, newData);

      expect(patches).toHaveLength(1);
      expect(patches[0]).toEqual({
        op: 'replace',
        path: '/authenticationConfiguration/clientId',
        value: 'new-id',
      });
    });

    it('should generate patches for authorizer config changes', () => {
      const oldData: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          authority: 'https://accounts.google.com',
          clientId: 'test-id',
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

      const newData: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          authority: 'https://accounts.google.com',
          clientId: 'test-id',
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
          principalDomain: '',
          enforcePrincipalDomain: true,
          enableSecureSocketConnection: false,
        },
      };

      const patches = generatePatches(oldData, newData);

      expect(patches).toHaveLength(2);
      expect(patches).toContainEqual({
        op: 'replace',
        path: '/authorizerConfiguration/adminPrincipals',
        value: ['admin@example.com'],
      });
      expect(patches).toContainEqual({
        op: 'replace',
        path: '/authorizerConfiguration/enforcePrincipalDomain',
        value: true,
      });
    });

    it('should generate patches for nested OIDC configuration changes', () => {
      const oldData: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          authority: 'https://accounts.google.com',
          clientId: 'test-id',
          callbackUrl: 'http://localhost:8585/callback',
          publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
          tokenValidationAlgorithm: 'RS256',
          jwtPrincipalClaims: ['email'],
          jwtPrincipalClaimsMapping: [],
          enableSelfSignup: true,
          oidcConfiguration: {
            id: 'old-id',
            secret: 'old-secret',
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

      const newData: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          authority: 'https://accounts.google.com',
          clientId: 'test-id',
          callbackUrl: 'http://localhost:8585/callback',
          publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
          tokenValidationAlgorithm: 'RS256',
          jwtPrincipalClaims: ['email'],
          jwtPrincipalClaimsMapping: [],
          enableSelfSignup: true,
          oidcConfiguration: {
            id: 'new-id',
            secret: 'new-secret',
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

      const patches = generatePatches(oldData, newData);

      expect(patches).toHaveLength(2);
      expect(patches).toContainEqual({
        op: 'replace',
        path: '/authenticationConfiguration/oidcConfiguration/id',
        value: 'new-id',
      });
      expect(patches).toContainEqual({
        op: 'replace',
        path: '/authenticationConfiguration/oidcConfiguration/secret',
        value: 'new-secret',
      });
    });

    it('should generate patches for multiple field changes in one object', () => {
      const oldData: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          authority: 'https://old-authority.com',
          clientId: 'old-id',
          callbackUrl: 'http://old-callback.com',
          publicKeyUrls: ['https://old-url.com'],
          tokenValidationAlgorithm: 'RS256',
          jwtPrincipalClaims: ['email'],
          jwtPrincipalClaimsMapping: [],
          enableSelfSignup: false,
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

      const newData: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          authority: 'https://new-authority.com',
          clientId: 'new-id',
          callbackUrl: 'http://new-callback.com',
          publicKeyUrls: ['https://new-url.com'],
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

      const patches = generatePatches(oldData, newData);

      expect(patches.length).toBeGreaterThan(3);
      expect(patches).toContainEqual({
        op: 'replace',
        path: '/authenticationConfiguration/authority',
        value: 'https://new-authority.com',
      });
      expect(patches).toContainEqual({
        op: 'replace',
        path: '/authenticationConfiguration/clientId',
        value: 'new-id',
      });
      expect(patches).toContainEqual({
        op: 'replace',
        path: '/authenticationConfiguration/enableSelfSignup',
        value: true,
      });
    });

    it('should generate add operation for new nested configuration', () => {
      const oldData: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          authority: 'https://accounts.google.com',
          clientId: 'test-id',
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

      const newData: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          authority: 'https://accounts.google.com',
          clientId: 'test-id',
          callbackUrl: 'http://localhost:8585/callback',
          publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
          tokenValidationAlgorithm: 'RS256',
          jwtPrincipalClaims: ['email'],
          jwtPrincipalClaimsMapping: [],
          enableSelfSignup: true,
          oidcConfiguration: {
            id: 'new-id',
            secret: 'new-secret',
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

      const patches = generatePatches(oldData, newData);

      expect(patches).toHaveLength(1);
      expect(patches[0].op).toBe('add');
      expect(patches[0].path).toBe(
        '/authenticationConfiguration/oidcConfiguration'
      );
    });

    it('should return empty array if oldData is undefined', () => {
      const newData: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          authority: 'https://accounts.google.com',
          clientId: 'test-id',
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

      const patches = generatePatches(undefined, newData);

      expect(patches).toEqual([]);
    });

    it('should return empty array if newData is undefined', () => {
      const oldData: FormData = {
        authenticationConfiguration: {
          provider: 'google',
          providerName: 'Google',
          authority: 'https://accounts.google.com',
          clientId: 'test-id',
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

      const patches = generatePatches(oldData, undefined);

      expect(patches).toEqual([]);
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
   * Test suite for generatePatches edge cases
   * Tests additional uncovered scenarios
   */
  describe('generatePatches - additional coverage', () => {
    it('should handle empty objects in toSimpleObject helper', () => {
      const oldData: FormData = {
        authenticationConfiguration: {
          provider: 'google',
        } as unknown,
        authorizerConfiguration: {} as unknown,
      } as FormData;

      const newData: FormData = {
        authenticationConfiguration: {
          provider: 'google',
        } as unknown,
        authorizerConfiguration: {} as unknown,
      } as FormData;

      const patches = generatePatches(oldData, newData);

      // Should generate no patches for identical empty objects
      expect(patches).toHaveLength(0);
    });
  });
});
