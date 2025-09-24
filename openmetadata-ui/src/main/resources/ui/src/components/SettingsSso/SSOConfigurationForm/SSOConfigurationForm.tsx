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

import Form, { IChangeEvent } from '@rjsf/core';
import { RegistryFieldsType, RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { Button, Card, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LdapIcon from '../../../assets/img/ic-ldap.svg';
import SamlIcon from '../../../assets/img/ic-saml.svg';
import Auth0Icon from '../../../assets/img/icon-auth0.png';
import CognitoIcon from '../../../assets/img/icon-aws-cognito.png';
import AzureIcon from '../../../assets/img/icon-azure.png';
import GoogleIcon from '../../../assets/img/icon-google.png';
import OktaIcon from '../../../assets/img/icon-okta.png';

import {
  AuthenticationConfiguration,
  AuthorizerConfiguration,
  COMMON_AUTHORIZER_FIELDS_TO_REMOVE,
  COMMON_AUTH_FIELDS_TO_REMOVE,
  DEFAULT_AUTHORIZER_CLASS_NAME,
  DEFAULT_CALLBACK_URL,
  DEFAULT_CONTAINER_REQUEST_FILTER,
  getSSOUISchema,
  GOOGLE_SSO_DEFAULTS,
  PROVIDERS_WITHOUT_BOT_PRINCIPALS,
  PROVIDER_FIELD_MAPPINGS,
  SAML_SSO_DEFAULTS,
  VALIDATION_STATUS,
} from '../../../constants/SSO.constant';
import { AuthProvider, ClientType } from '../../../generated/settings/settings';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import authenticationConfigSchema from '../../../jsons/configuration/authenticationConfiguration.json';
import authorizerConfigSchema from '../../../jsons/configuration/authorizerConfiguration.json';
import {
  fetchAuthenticationConfig,
  fetchAuthorizerConfig,
} from '../../../rest/miscAPI';
import {
  applySecurityConfiguration,
  getSecurityConfiguration,
  JsonPatchOperation,
  patchSecurityConfiguration,
  SecurityConfiguration,
  SecurityValidationResponse,
  validateSecurityConfiguration,
  ValidationResult,
} from '../../../rest/securityConfigAPI';
import { getAuthConfig } from '../../../utils/AuthProvider.util';
import { transformErrors } from '../../../utils/formUtils';
import { getProviderDisplayName } from '../../../utils/SSOUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useAuthProvider } from '../../Auth/AuthProviders/AuthProvider';
import DescriptionFieldTemplate from '../../common/Form/JSONSchema/JSONSchemaTemplate/DescriptionFieldTemplate';
import { FieldErrorTemplate } from '../../common/Form/JSONSchema/JSONSchemaTemplate/FieldErrorTemplate/FieldErrorTemplate';
import SelectWidget from '../../common/Form/JSONSchema/JsonSchemaWidgets/SelectWidget';
import Loader from '../../common/Loader/Loader';
import ResizablePanels from '../../common/ResizablePanels/ResizablePanels';
import { UnsavedChangesModal } from '../../Modals/UnsavedChangesModal/UnsavedChangesModal.component';
import ProviderSelector from '../ProviderSelector/ProviderSelector';
import SSODocPanel from '../SSODocPanel/SSODocPanel';
import { SSOGroupedFieldTemplate } from '../SSOGroupedFieldTemplate/SSOGroupedFieldTemplate';
import './sso-configuration-form.less';
import {
  FormData,
  SSOConfigurationFormProps,
  UISchemaObject,
} from './SSOConfigurationForm.interface';
import SsoConfigurationFormArrayFieldTemplate from './SsoConfigurationFormArrayFieldTemplate';

const widgets = {
  SelectWidget: SelectWidget,
};

const SSOConfigurationFormRJSF = ({
  forceEditMode = false,
  onChangeProvider,
  onProviderSelect,
  selectedProvider,
  hideBorder = false,
  securityConfig,
}: SSOConfigurationFormProps) => {
  const { t } = useTranslation();
  const { setAuthConfig, setAuthorizerConfig } = useApplicationStore();
  const { onLogoutHandler } = useAuthProvider();

  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [internalData, setInternalData] = useState<FormData | undefined>();
  const [savedData, setSavedData] = useState<FormData | undefined>();
  const [currentProvider, setCurrentProvider] = useState<string | undefined>();
  const [showProviderSelector, setShowProviderSelector] =
    useState<boolean>(false);
  const [hasExistingConfig, setHasExistingConfig] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [activeField, setActiveField] = useState<string>('');
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [modalSaveLoading, setModalSaveLoading] = useState<boolean>(false);
  const [isModalSave, setIsModalSave] = useState<boolean>(false);

  const getProviderIcon = (provider: string) => {
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
      default:
        return null;
    }
  };

  // Helper function to setup configuration state - extracted to avoid redundancy
  const setupConfigurationState = useCallback(
    (config: SecurityConfiguration) => {
      if (
        config?.authenticationConfiguration?.provider &&
        config.authenticationConfiguration.provider !== AuthProvider.Basic
      ) {
        setHasExistingConfig(true);
        setCurrentProvider(config.authenticationConfiguration.provider);
        const configData = {
          authenticationConfiguration: config.authenticationConfiguration,
          authorizerConfiguration: config.authorizerConfiguration,
        };

        // For SAML, ensure IDP authorityUrl and SP callback fields are populated from root level
        if (config.authenticationConfiguration.provider === AuthProvider.Saml) {
          const authConfig =
            configData.authenticationConfiguration as AuthenticationConfiguration & {
              samlConfiguration?: {
                idp?: { authorityUrl?: string };
                sp?: { callback?: string; acs?: string };
              };
            };
          if (authConfig.samlConfiguration) {
            // Copy root authority to IDP authorityUrl, or use default if both are empty
            if (authConfig.samlConfiguration.idp) {
              if (authConfig.authority) {
                authConfig.samlConfiguration.idp.authorityUrl =
                  authConfig.authority;
              } else if (!authConfig.samlConfiguration.idp.authorityUrl) {
                // If no authority exists anywhere, use the default
                authConfig.samlConfiguration.idp.authorityUrl =
                  SAML_SSO_DEFAULTS.idp.authorityUrl;
              }
            }
            // Copy root callbackUrl to SP callback if not set
            if (authConfig.callbackUrl && authConfig.samlConfiguration.sp) {
              authConfig.samlConfiguration.sp.callback = authConfig.callbackUrl;
              authConfig.samlConfiguration.sp.acs = authConfig.callbackUrl;
            }
          }
        }

        setSavedData(configData);
        setInternalData(configData);
        setShowForm(true);

        if (forceEditMode) {
          setIsEditMode(true);
          setShowForm(true);
        }
      } else {
        setShowProviderSelector(true);
      }
    },
    [forceEditMode]
  );

  // Fetch existing configuration on mount (only if no selectedProvider is passed and no securityConfig provided)
  useEffect(() => {
    const fetchExistingConfig = async () => {
      try {
        if (selectedProvider) {
          setIsInitializing(false);

          return;
        }

        // Only fetch if no securityConfig is provided
        if (!securityConfig) {
          const response = await getSecurityConfiguration();
          const config = response.data;
          setupConfigurationState(config);
        }
      } catch (error) {
        // No existing configuration, show provider selector
        setShowProviderSelector(true);
      } finally {
        setIsInitializing(false);
      }
    };

    // Only run if no securityConfig is provided by parent
    if (!securityConfig) {
      fetchExistingConfig();
    } else {
      setIsInitializing(false);
    }
  }, [selectedProvider, setupConfigurationState, securityConfig]);

  // Separate effect to handle securityConfig changes
  useEffect(() => {
    if (securityConfig && !selectedProvider) {
      setupConfigurationState(securityConfig);
    }
  }, [securityConfig, selectedProvider, setupConfigurationState]);

  // Handle selectedProvider prop - initialize fresh form when provider is selected
  useEffect(() => {
    if (selectedProvider) {
      // If provider is Basic, show provider selector instead
      if (selectedProvider === AuthProvider.Basic) {
        setShowProviderSelector(true);
        setShowForm(false);
        setIsEditMode(false);
        setIsInitializing(false);

        return;
      }

      // Clear all existing state first
      setHasExistingConfig(false);
      setSavedData(undefined);

      // Initialize fresh form data for the selected provider
      setCurrentProvider(selectedProvider);
      setIsEditMode(true);
      setShowForm(true);
      setShowProviderSelector(false);
      setIsInitializing(false);

      // Create fresh form data for the new provider with all required fields
      // SAML and LDAP are always public clients, OAuth providers default to confidential but can be changed
      const defaultClientType =
        selectedProvider === AuthProvider.Saml ||
        selectedProvider === AuthProvider.LDAP
          ? ClientType.Public
          : ClientType.Confidential;

      // Get provider-specific defaults
      const isGoogle = selectedProvider === AuthProvider.Google;
      const isSaml = selectedProvider === AuthProvider.Saml;

      const freshFormData = {
        authenticationConfiguration: {
          provider: selectedProvider as AuthProvider,
          providerName: selectedProvider,
          enableSelfSignup: true,
          clientType: defaultClientType,
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
                authority: SAML_SSO_DEFAULTS.authority, // Will be populated from IDP authority
                // callbackUrl is not included here - will be populated from SP callback on submit
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
                    authorityUrl: SAML_SSO_DEFAULTS.idp.authorityUrl, // Prepopulate with domain/api/auth/login
                    idpX509Certificate: '',
                    nameId:
                      'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
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
          // For confidential clients, fields go in oidcConfiguration
          // For public clients, use root level fields (but not for SAML which has its own config)
          ...(!isSaml && defaultClientType === ClientType.Confidential
            ? {
                oidcConfiguration: {
                  type: selectedProvider,
                  id: '',
                  secret: '',
                  scope: 'openid email profile',
                  discoveryUri: isGoogle
                    ? GOOGLE_SSO_DEFAULTS.discoveryUri
                    : '',
                  useNonce: false,
                  preferredJwsAlgorithm: 'RS256',
                  responseType: 'code',
                  disablePkce: false,
                  maxClockSkew: 0,
                  clientAuthenticationMethod: 'client_secret_post',
                  tokenValidity: isGoogle
                    ? GOOGLE_SSO_DEFAULTS.tokenValidity
                    : 0,
                  customParams: {},
                  tenant: '',
                  serverUrl: isGoogle ? GOOGLE_SSO_DEFAULTS.serverUrl : '',
                  callbackUrl: DEFAULT_CALLBACK_URL,
                  maxAge: 0,
                  prompt: '',
                  sessionExpiry: isGoogle
                    ? GOOGLE_SSO_DEFAULTS.sessionExpiry
                    : 0,
                },
              }
            : !isSaml
            ? {
                // For public clients, use root level fields (excluding SAML)
                authority: isGoogle ? GOOGLE_SSO_DEFAULTS.authority : '',
                clientId: '',
                callbackUrl: DEFAULT_CALLBACK_URL,
                publicKeyUrls: isGoogle
                  ? GOOGLE_SSO_DEFAULTS.publicKeyUrls
                  : [],
                tokenValidationAlgorithm: 'RS256',
                jwtPrincipalClaims: [],
                jwtPrincipalClaimsMapping: [],
              }
            : {}),
        } as AuthenticationConfiguration,
        authorizerConfiguration: {
          className: DEFAULT_AUTHORIZER_CLASS_NAME,
          containerRequestFilter: DEFAULT_CONTAINER_REQUEST_FILTER,
          enforcePrincipalDomain: false,
          enableSecureSocketConnection: false,
          adminPrincipals: [],
          principalDomain: '',
        } as AuthorizerConfiguration,
      };

      setInternalData(freshFormData);
    }
  }, [selectedProvider]);

  const handleValidationErrors = useCallback(
    (validationResult: SecurityValidationResponse) => {
      const failedResults = validationResult.results.filter(
        (result: ValidationResult) => result.status === VALIDATION_STATUS.FAILED
      );

      if (failedResults.length > 0) {
        const errorDetails = failedResults
          .map(
            (result: ValidationResult) =>
              `${result.component}: ${result.message}`
          )
          .join('\n');

        const errorMessage = `${validationResult?.message}\n\n${errorDetails}`;

        showErrorToast(errorMessage);
      } else {
        showErrorToast(validationResult.message);
      }
    },
    []
  );
  const toRecord = (obj: unknown): Record<string, unknown> => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return obj as unknown as Record<string, unknown>;
    }

    return {};
  };
  // Clean up provider-specific fields based on selected provider
  // Generate JSON Patch operations by comparing old and new data
  const generatePatches = (
    oldData: FormData | undefined,
    newData: FormData | undefined
  ): JsonPatchOperation[] => {
    const patches: JsonPatchOperation[] = [];

    if (!oldData || !newData) {
      return patches;
    }

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

  const cleanupProviderSpecificFields = (
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
          (field) =>
            delete authConfig[field as keyof AuthenticationConfiguration]
        );
        // Also remove secret from root level for public clients
        delete authConfig.secret;
      } else {
        // For confidential clients, keep oidcConfiguration but remove other provider configs
        const fieldsToActuallyRemove = fieldsToRemove.filter(
          (field) => field !== 'oidcConfiguration'
        );
        fieldsToActuallyRemove.forEach(
          (field) =>
            delete authConfig[field as keyof AuthenticationConfiguration]
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
        (field) =>
          delete authorizerConfig[field as keyof AuthorizerConfiguration]
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
      authorizerConfig.containerRequestFilter =
        DEFAULT_CONTAINER_REQUEST_FILTER;
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
        if (
          truststoreFormat === 'HostName' &&
          trustStoreConfig.hostNameConfig
        ) {
          cleanTrustStoreConfig.hostNameConfig =
            trustStoreConfig.hostNameConfig;
        }
        if (
          truststoreFormat === 'JVMDefault' &&
          trustStoreConfig.jvmDefaultConfig
        ) {
          cleanTrustStoreConfig.jvmDefaultConfig =
            trustStoreConfig.jvmDefaultConfig;
        }
        if (
          truststoreFormat === 'TrustAll' &&
          trustStoreConfig.trustAllConfig
        ) {
          cleanTrustStoreConfig.trustAllConfig =
            trustStoreConfig.trustAllConfig;
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
        if (
          spConfig.spPrivateKey &&
          typeof spConfig.spPrivateKey === 'string'
        ) {
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

  const getProviderSpecificSchema = (provider: string | undefined) => {
    const baseSchema = {
      properties: {
        authenticationConfiguration: authenticationConfigSchema,
        authorizerConfiguration: authorizerConfigSchema,
      },
    } as RJSFSchema;

    if (!provider) {
      return baseSchema;
    }

    // Deep clone the schema to avoid mutating the original
    const authSchema = JSON.parse(JSON.stringify(authenticationConfigSchema));

    // For SAML, remove callbackUrl from required fields and properties
    if (provider === AuthProvider.Saml) {
      // Remove callbackUrl from properties
      if (authSchema.properties && authSchema.properties.callbackUrl) {
        delete authSchema.properties.callbackUrl;
      }

      // Remove callbackUrl from required array
      if (authSchema.required && Array.isArray(authSchema.required)) {
        authSchema.required = authSchema.required.filter(
          (field: string) => field !== 'callbackUrl'
        );
      }

      return {
        properties: {
          authenticationConfiguration: authSchema,
          authorizerConfiguration: authorizerConfigSchema,
        },
      } as RJSFSchema;
    }

    // For Custom OIDC, remove LDAP and SAML configuration sections and clientType field
    if (provider === AuthProvider.CustomOidc) {
      // Remove ldapConfiguration, samlConfiguration, and clientType from properties
      if (authSchema.properties) {
        if (authSchema.properties.ldapConfiguration) {
          delete authSchema.properties.ldapConfiguration;
        }
        if (authSchema.properties.samlConfiguration) {
          delete authSchema.properties.samlConfiguration;
        }
        if (authSchema.properties.clientType) {
          delete authSchema.properties.clientType;
        }
      }

      // Remove from required array if present
      if (authSchema.required && Array.isArray(authSchema.required)) {
        authSchema.required = authSchema.required.filter(
          (field: string) =>
            field !== 'ldapConfiguration' &&
            field !== 'samlConfiguration' &&
            field !== 'clientType'
        );
      }

      return {
        properties: {
          authenticationConfiguration: authSchema,
          authorizerConfiguration: authorizerConfigSchema,
        },
      } as RJSFSchema;
    }

    return baseSchema;
  };

  const customFields: RegistryFieldsType = {
    ArrayField: SsoConfigurationFormArrayFieldTemplate,
  };

  const schema = useMemo(() => {
    return getProviderSpecificSchema(currentProvider);
  }, [currentProvider]);

  // Dynamic UI schema using the optimized constants
  const uiSchema = useMemo(() => {
    if (!currentProvider) {
      return {};
    }
    const baseSchema = getSSOUISchema(currentProvider, hasExistingConfig);

    const currentClientType =
      internalData?.authenticationConfiguration?.clientType;

    const authConfig = baseSchema.authenticationConfiguration as UISchemaObject;

    // Always hide provider field since we have separate provider selection screen
    authConfig.provider = {
      'ui:widget': 'hidden',
      'ui:hideError': true,
    };

    // Make clientType non-editable for existing SSO configurations
    if (hasExistingConfig && savedData) {
      authConfig.clientType = {
        'ui:widget': 'hidden',
        'ui:hideError': true,
      };
    } else if (
      currentProvider === AuthProvider.Saml ||
      currentProvider === AuthProvider.LDAP
    ) {
      // Hide clientType for SAML/LDAP since they're always public
      authConfig.clientType = {
        'ui:widget': 'hidden',
        'ui:hideError': true,
      };
    }

    // Show oidcConfiguration for confidential clients, hide for public clients
    if (currentClientType === ClientType.Public) {
      authConfig.oidcConfiguration = {
        'ui:widget': 'hidden',
        'ui:hideError': true,
      };
      // Ensure callback URL is visible for public clients
      authConfig.callbackUrl = {
        'ui:title': 'Callback URL',
        'ui:placeholder': 'e.g. https://myapp.com/auth/callback',
      } as UISchemaObject;
    } else if (currentClientType === ClientType.Confidential) {
      // The schema will be shown with OIDC prefixed labels from the constants
      if (!authConfig['oidcConfiguration']) {
        authConfig['oidcConfiguration'] = {
          'ui:title': 'OIDC Configuration',
        };
      }
      // Hide root-level clientId and callbackUrl for confidential clients since we have OIDC equivalents
      authConfig.clientId = {
        'ui:widget': 'hidden',
        'ui:hideError': true,
      };
      authConfig.callbackUrl = {
        'ui:widget': 'hidden',
        'ui:hideError': true,
      };

      // For Google, show authority and publicKeyUrls even in Confidential mode
      const isGoogle = currentProvider === AuthProvider.Google;
      if (isGoogle) {
        authConfig.authority = {
          'ui:title': 'Authority',
          'ui:placeholder': GOOGLE_SSO_DEFAULTS.authority,
        } as UISchemaObject;
        authConfig.publicKeyUrls = {
          'ui:title': 'Public Key URLs',
          'ui:placeholder': `Enter value (default: ${GOOGLE_SSO_DEFAULTS.publicKeyUrls[0]}) and press ENTER`,
        } as UISchemaObject;
      }
    }

    const finalSchema = {
      ...baseSchema,
      authenticationConfiguration: {
        ...baseSchema.authenticationConfiguration,
        ...authConfig,
        'ui:classNames': 'hide-section-title',
      },
      authorizerConfiguration: {
        ...baseSchema.authorizerConfiguration,
        'ui:classNames': 'hide-section-title',
      },
    };

    return finalSchema;
  }, [
    currentProvider,
    internalData?.authenticationConfiguration?.clientType,
    hasExistingConfig,
    savedData,
    hideBorder,
  ]);

  // Handle form data changes
  const handleOnChange = (e: IChangeEvent<FormData>) => {
    if (e.formData) {
      const newFormData = { ...e.formData };
      const authConfig = newFormData.authenticationConfiguration;

      // Check if client type changed
      const previousClientType =
        internalData?.authenticationConfiguration?.clientType;
      const newClientType = authConfig?.clientType;

      if (previousClientType !== newClientType && authConfig) {
        // If switching from Confidential to Public, move callback URL from OIDC to root
        if (
          newClientType === ClientType.Public &&
          previousClientType === ClientType.Confidential
        ) {
          const oidcConfig = authConfig.oidcConfiguration as
            | Record<string, unknown>
            | undefined;
          if (!authConfig.callbackUrl && oidcConfig?.callbackUrl) {
            authConfig.callbackUrl = oidcConfig.callbackUrl as string;
          } else if (!authConfig.callbackUrl) {
            // Set default callback URL if not present
            authConfig.callbackUrl = DEFAULT_CALLBACK_URL;
          }

          // For Google SSO, prepopulate Authority and Public Key URLs when switching to Public
          const isGoogle = authConfig.provider === AuthProvider.Google;
          if (isGoogle) {
            authConfig.authority = GOOGLE_SSO_DEFAULTS.authority;
            authConfig.publicKeyUrls = GOOGLE_SSO_DEFAULTS.publicKeyUrls;
          }
        }
        // If switching from Public to Confidential, move callback URL from root to OIDC
        else if (
          newClientType === ClientType.Confidential &&
          previousClientType === ClientType.Public
        ) {
          if (!authConfig.oidcConfiguration) {
            authConfig.oidcConfiguration = {};
          }
          const oidcConfig = authConfig.oidcConfiguration as Record<
            string,
            unknown
          >;
          if (!oidcConfig.callbackUrl && authConfig.callbackUrl) {
            oidcConfig.callbackUrl = authConfig.callbackUrl;
          } else if (!oidcConfig.callbackUrl) {
            // Set default callback URL if not present
            oidcConfig.callbackUrl = DEFAULT_CALLBACK_URL;
          }

          // For Google SSO, prepopulate OIDC fields when switching to Confidential
          const isGoogle = authConfig.provider === AuthProvider.Google;
          if (isGoogle) {
            oidcConfig.type = AuthProvider.Google;
            oidcConfig.discoveryUri = GOOGLE_SSO_DEFAULTS.discoveryUri;
            oidcConfig.tokenValidity = GOOGLE_SSO_DEFAULTS.tokenValidity;
            oidcConfig.sessionExpiry = GOOGLE_SSO_DEFAULTS.sessionExpiry;
            oidcConfig.serverUrl = GOOGLE_SSO_DEFAULTS.serverUrl;
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
        }
      }

      setInternalData(newFormData);

      // Check if provider changed
      const newProvider = newFormData?.authenticationConfiguration?.provider;
      if (newProvider && newProvider !== currentProvider) {
        setCurrentProvider(newProvider);
        // Notify parent component about provider change
        if (onProviderSelect) {
          onProviderSelect(newProvider as AuthProvider);
        }
      }
    }
  };

  // Add DOM event listeners for field focus tracking
  useEffect(() => {
    const extractFieldName = (fieldId: string): string => {
      // Extract meaningful field name from RJSF field ID
      // Examples:
      // "root/authenticationConfiguration/clientId" -> "clientId"
      // "root/authenticationConfiguration/authority" -> "authority"
      const parts = fieldId.split('/');
      const lastPart = parts[parts.length - 1];

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

    const handleDOMFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      // Look for the closest field container with an id
      let element = target;
      while (element && element !== document.body) {
        if (element.id && element.id.includes('root')) {
          const fieldName = extractFieldName(element.id);
          setActiveField(fieldName);

          break;
        }
        element = element.parentElement as HTMLElement;
      }
    };

    const handleDOMClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Look for the closest field container with an id
      let element = target;
      while (element && element !== document.body) {
        if (element.id && element.id.includes('root')) {
          const fieldName = extractFieldName(element.id);
          setActiveField(fieldName);

          break;
        }
        element = element.parentElement as HTMLElement;
      }
    };

    // Add event listeners when form is shown
    if (showForm) {
      document.addEventListener('focusin', handleDOMFocus);
      document.addEventListener('click', handleDOMClick);
    }

    return () => {
      document.removeEventListener('focusin', handleDOMFocus);
      document.removeEventListener('click', handleDOMClick);
    };
  }, [showForm]);

  const handleSave = async () => {
    // Only set main form loading if not saving through modal
    if (!isModalSave) {
      setIsLoading(true);
    }

    try {
      const currentFormData = internalData;

      // Clean up provider-specific fields before submission
      const cleanedFormData = cleanupProviderSpecificFields(
        currentFormData,
        currentFormData?.authenticationConfiguration?.provider as string
      );

      const payload: SecurityConfiguration = {
        authenticationConfiguration:
          cleanedFormData?.authenticationConfiguration as SecurityConfiguration['authenticationConfiguration'],
        authorizerConfiguration:
          cleanedFormData?.authorizerConfiguration as SecurityConfiguration['authorizerConfiguration'],
      };

      try {
        // Use PATCH for existing configurations, PUT for new ones
        if (hasExistingConfig && savedData) {
          // Generate patches for existing configuration
          const allPatches = generatePatches(savedData, cleanedFormData);

          // Apply security configuration patches using the new endpoint
          if (allPatches.length > 0) {
            await patchSecurityConfiguration(allPatches);
          }
        } else {
          // For new configurations, validate first then apply
          try {
            const validationResponse: { data: SecurityValidationResponse } =
              await validateSecurityConfiguration(payload);
            const validationResult = validationResponse.data;

            if (validationResult.status !== VALIDATION_STATUS.SUCCESS) {
              handleValidationErrors(validationResult);

              return;
            }
          } catch (error) {
            showErrorToast(error as AxiosError);

            return;
          }

          // Use full PUT for new configurations
          await applySecurityConfiguration(payload);
        }
      } catch (error) {
        showErrorToast(error as AxiosError);

        return;
      }

      // Only do logout process for new configurations, not existing ones
      if (!hasExistingConfig) {
        // Reload authentication configuration to get the updated SSO settings
        try {
          const [newAuthConfig, newAuthorizerConfig] = await Promise.all([
            fetchAuthenticationConfig(),
            fetchAuthorizerConfig(),
          ]);

          // Update the authentication configuration in the store
          const configWithScope = getAuthConfig(newAuthConfig);
          setAuthConfig(configWithScope);
          setAuthorizerConfig(newAuthorizerConfig);

          // Update saved data with the new configuration
          setSavedData(cleanedFormData);
          setHasExistingConfig(true);
        } catch (error) {
          showErrorToast(error as AxiosError);
        }

        // Only update main form loading state if not modal save
        if (!isModalSave) {
          setIsLoading(false);
          setIsEditMode(false);
        }

        try {
          await onLogoutHandler();
        } catch (logoutError) {
          // Clear client-side storage as fallback when server logout fails
          sessionStorage.clear();
          localStorage.clear();
        }

        // Force navigation to signin page to test new SSO configuration
        window.location.replace('/signin');
      } else {
        // For existing configs, just update the saved data and stay in edit mode
        setSavedData(cleanedFormData);

        // Only update main form loading state if not modal save
        if (!isModalSave) {
          setIsLoading(false);
        }

        // Keep edit mode enabled so user can continue editing
        // Show success toast for existing config save
        showSuccessToast(t('message.configuration-save-success'));
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('message.configuration-save-failed');
      showErrorToast(errorMessage);

      // Only update main form loading state if not modal save
      if (!isModalSave) {
        setIsLoading(false);
      }
    } finally {
      // Only update main form loading state if not modal save
      if (!isModalSave) {
        setIsLoading(false);
      }
    }
  };

  const handleCancelConfirm = () => {
    setShowCancelModal(false);

    // For existing/configured SSO, discard changes and stay on the same page
    if (hasExistingConfig && savedData) {
      setInternalData(savedData);

      return;
    }

    // For new SSO setup, reset to provider selection
    setShowProviderSelector(true);
    setShowForm(false);
    setIsEditMode(false);
    setCurrentProvider(undefined);
    setInternalData(undefined);
    setSavedData(undefined);
    setHasExistingConfig(false);

    // Notify parent component about change
    if (onChangeProvider) {
      onChangeProvider();
    }
  };

  const handleCancelModalClose = () => {
    setShowCancelModal(false);
  };

  // Handle cancel button click
  const handleCancelClick = () => {
    // Always show the modal - let the user decide what they want to do
    setShowCancelModal(true);
  };

  const handleSaveAndExit = async () => {
    setModalSaveLoading(true);
    setIsModalSave(true);

    try {
      if (internalData) {
        await handleSave();
      }

      setShowCancelModal(false);
      setModalSaveLoading(false);
      setIsModalSave(false);

      // If existing config is present, just save and do nothing (stay on form)
      if (hasExistingConfig) {
        // For existing config, just close modal and stay on form - no logout process
        return;
      }

      // If fresh/new form, proceed with logout process and redirect
      // This will trigger the logout and sign-in redirect process
      handleCancelConfirm();
    } catch (error) {
      setShowCancelModal(false);
      setModalSaveLoading(false);
      setIsModalSave(false);
    }
  };

  const handleProviderSelect = (provider: AuthProvider) => {
    // If selecting a new provider when one already exists, don't overwrite the saved data
    setCurrentProvider(provider);
    setShowProviderSelector(false);
    setShowForm(true);
    setIsEditMode(true);

    if (onProviderSelect) {
      onProviderSelect(provider);
    }

    // Initialize form data with selected provider for new configuration with all required fields
    // SAML and LDAP are always public clients, OAuth providers default to confidential but can be changed
    const defaultClientType =
      provider === AuthProvider.Saml || provider === AuthProvider.LDAP
        ? ClientType.Public
        : ClientType.Confidential;

    // Get Google-specific defaults if applicable
    const isGoogle = provider === AuthProvider.Google;

    setInternalData({
      authenticationConfiguration: {
        provider: provider,
        providerName: provider,
        enableSelfSignup: false,
        clientType: defaultClientType,
        // Always include authority and publicKeyUrls for Google (required by backend)
        ...(isGoogle
          ? {
              authority: GOOGLE_SSO_DEFAULTS.authority,
              publicKeyUrls: GOOGLE_SSO_DEFAULTS.publicKeyUrls,
            }
          : {}),
        // For confidential clients, fields go in oidcConfiguration
        // For public clients, use root level fields
        ...(defaultClientType === ClientType.Confidential
          ? {
              oidcConfiguration: {
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
              },
            }
          : {
              // For public clients, use root level fields
              authority: isGoogle ? GOOGLE_SSO_DEFAULTS.authority : '',
              clientId: '',
              callbackUrl: DEFAULT_CALLBACK_URL,
              publicKeyUrls: isGoogle ? GOOGLE_SSO_DEFAULTS.publicKeyUrls : [],
              tokenValidationAlgorithm: 'RS256',
              jwtPrincipalClaims: [],
              jwtPrincipalClaimsMapping: [],
            }),
      } as AuthenticationConfiguration,
      authorizerConfiguration: {
        className: DEFAULT_AUTHORIZER_CLASS_NAME,
        containerRequestFilter: DEFAULT_CONTAINER_REQUEST_FILTER,
        enforcePrincipalDomain: false,
        enableSecureSocketConnection: false,
        adminPrincipals: [],
        principalDomain: '',
      } as AuthorizerConfiguration,
    });
  };

  if (isInitializing) {
    return <Loader data-testid="loader" />;
  }

  // If we have an onChangeProvider callback, don't show internal provider selector
  // The parent component (SettingsSso) will handle provider selection
  if (showProviderSelector && !onChangeProvider) {
    return (
      <Card
        className="sso-provider-selection flex-col"
        data-testid="sso-configuration-form-card">
        <ProviderSelector
          selectedProvider={currentProvider as AuthProvider}
          onProviderSelect={handleProviderSelect}
        />
      </Card>
    );
  }

  const formContent = (
    <>
      {isEditMode && showForm && (
        <Form
          focusOnFirstError
          noHtml5Validate
          className="rjsf no-header"
          fields={customFields}
          formData={internalData}
          idSeparator="/"
          schema={schema}
          showErrorList={false}
          templates={{
            DescriptionFieldTemplate: DescriptionFieldTemplate,
            FieldErrorTemplate: FieldErrorTemplate,
            ObjectFieldTemplate: SSOGroupedFieldTemplate,
          }}
          transformErrors={transformErrors}
          uiSchema={{
            ...uiSchema,
            'ui:submitButtonOptions': {
              submitText: '',
              norender: true,
            },
          }}
          validator={validator}
          widgets={widgets}
          onChange={handleOnChange}
        />
      )}
    </>
  );

  // If hideBorder is true, render form with ResizablePanels but without Card wrapper and header
  if (hideBorder) {
    return (
      <>
        <UnsavedChangesModal
          discardText={t('label.discard')}
          loading={modalSaveLoading}
          open={showCancelModal}
          saveText={t('label.save-changes')}
          title={t('message.unsaved-changes')}
          onCancel={handleCancelModalClose}
          onDiscard={handleCancelConfirm}
          onSave={handleSaveAndExit}
        />

        <ResizablePanels
          className="content-height-with-resizable-panel sso-configured"
          data-testid="resizable-panels"
          firstPanel={{
            children: (
              <>
                {formContent}
                {isEditMode && (
                  <div className="form-actions-bottom">
                    <Button
                      className="cancel-sso-configuration text-md"
                      data-testid="cancel-sso-configuration"
                      type="link"
                      onClick={handleCancelClick}>
                      {t('label.cancel-lowercase')}
                    </Button>
                    <Button
                      className="save-sso-configuration text-md"
                      data-testid="save-sso-configuration"
                      disabled={isLoading}
                      loading={isLoading}
                      type="primary"
                      onClick={handleSave}>
                      {t('label.save')}
                    </Button>
                  </div>
                )}
              </>
            ),
            minWidth: 400,
            flex: 0.5,
            className: 'content-resizable-panel-container sso-configured m-t-2',
          }}
          secondPanel={{
            children: (
              <SSODocPanel
                activeField={activeField}
                serviceName={currentProvider || 'general'}
              />
            ),
            minWidth: 400,
            flex: 0.5,
            className: 'm-t-xs',
          }}
        />
      </>
    );
  }

  const wrappedFormContent = (
    <Card
      className="sso-configuration-form-card flex-col p-0"
      data-testid="sso-configuration-form-card">
      {/* SSO Provider Header */}
      {currentProvider && (
        <div className="sso-provider-form-header flex items-center justify-between">
          <div className="flex align-items-center gap-2 flex items-center">
            <div className="provider-icon-container">
              {getProviderIcon(currentProvider) && (
                <img
                  alt={getProviderDisplayName(currentProvider)}
                  height={22}
                  src={getProviderIcon(currentProvider) as string}
                  width={22}
                />
              )}
            </div>
            <Typography.Title className="m-0 text-md">
              {getProviderDisplayName(currentProvider)} {t('label.set-up')}
            </Typography.Title>
          </div>
          {hasExistingConfig && onChangeProvider && (
            <Button
              data-testid="change-provider-button"
              type="link"
              onClick={onChangeProvider}>
              {t('label.change-provider')}
            </Button>
          )}
        </div>
      )}
      {formContent}
    </Card>
  );

  return (
    <>
      <UnsavedChangesModal
        discardText={t('label.discard')}
        loading={modalSaveLoading}
        open={showCancelModal}
        saveText={t('label.save-changes')}
        title={t('message.unsaved-changes')}
        onCancel={handleCancelModalClose}
        onDiscard={handleCancelConfirm}
        onSave={handleSaveAndExit}
      />

      <ResizablePanels
        className="content-height-with-resizable-panel"
        data-testid="resizable-panels"
        firstPanel={{
          children: (
            <>
              {wrappedFormContent}
              {isEditMode && (
                <div className="form-actions-bottom">
                  <Button
                    className="cancel-sso-configuration text-md"
                    data-testid="cancel-sso-configuration"
                    type="link"
                    onClick={handleCancelClick}>
                    {t('label.cancel-lowercase')}
                  </Button>
                  <Button
                    className="save-sso-configuration text-md"
                    data-testid="save-sso-configuration"
                    disabled={isLoading}
                    loading={isLoading}
                    type="primary"
                    onClick={handleSave}>
                    {t('label.save')}
                  </Button>
                </div>
              )}
            </>
          ),
          minWidth: 700,
          flex: 0.7,
          className: 'content-resizable-panel-container',
        }}
        secondPanel={{
          children: (
            <SSODocPanel
              activeField={activeField}
              serviceName={currentProvider || 'general'}
            />
          ),
          minWidth: 400,
        }}
      />
    </>
  );
};

export default SSOConfigurationFormRJSF;
