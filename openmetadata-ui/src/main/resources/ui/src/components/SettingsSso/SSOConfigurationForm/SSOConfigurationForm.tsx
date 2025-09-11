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
  DEFAULT_CONTAINER_REQUEST_FILTER,
  getSSOUISchema,
  PROVIDERS_WITHOUT_BOT_PRINCIPALS,
  PROVIDER_FIELD_MAPPINGS,
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
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useAuthProvider } from '../../Auth/AuthProviders/AuthProvider';
import DescriptionFieldTemplate from '../../common/Form/JSONSchema/JSONSchemaTemplate/DescriptionFieldTemplate';
import { FieldErrorTemplate } from '../../common/Form/JSONSchema/JSONSchemaTemplate/FieldErrorTemplate/FieldErrorTemplate';
import SelectWidget from '../../common/Form/JSONSchema/JsonSchemaWidgets/SelectWidget';
import Loader from '../../common/Loader/Loader';
import ResizablePanels from '../../common/ResizablePanels/ResizablePanels';
import { UnsavedChangesModal } from '../../Modals/UnsavedChangesModal/UnsavedChangesModal';
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

  const getProviderDisplayName = (provider: string) => {
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
      default:
        return provider?.charAt(0).toUpperCase() + provider?.slice(1);
    }
  };

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
  }, [selectedProvider, forceEditMode]);

  // Separate effect to handle securityConfig changes
  useEffect(() => {
    if (securityConfig && !selectedProvider) {
      if (
        securityConfig.authenticationConfiguration?.provider &&
        securityConfig.authenticationConfiguration.provider !==
          AuthProvider.Basic
      ) {
        setHasExistingConfig(true);
        setCurrentProvider(securityConfig.authenticationConfiguration.provider);
        const configData = {
          authenticationConfiguration:
            securityConfig.authenticationConfiguration,
          authorizerConfiguration: securityConfig.authorizerConfiguration,
        };
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
    }
  }, [securityConfig, forceEditMode]);

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
      const isConfidentialClient = !(
        selectedProvider === AuthProvider.Saml ||
        selectedProvider === AuthProvider.LDAP
      );

      const freshFormData = {
        authenticationConfiguration: {
          provider: selectedProvider as AuthProvider,
          providerName: selectedProvider,
          enableSelfSignup: true,
          clientType: isConfidentialClient
            ? ClientType.Confidential
            : ClientType.Public,
          // For confidential clients (OAuth providers), fields go in oidcConfiguration
          ...(isConfidentialClient
            ? {
                oidcConfiguration: {
                  type: selectedProvider,
                  id: '',
                  secret: '',
                  scope: 'openid email profile',
                  discoveryUri: '',
                  useNonce: false,
                  preferredJwsAlgorithm: 'RS256',
                  responseType: 'id_token',
                  disablePkce: false,
                  maxClockSkew: 0,
                  clientAuthenticationMethod: 'client_secret_basic',
                  tokenValidity: 0,
                  customParams: {},
                  tenant: '',
                  serverUrl: '',
                  callbackUrl: '',
                  maxAge: 0,
                  prompt: '',
                  sessionExpiry: 0,
                },
              }
            : {
                // For public clients (SAML/LDAP), use root level fields
                authority: '',
                clientId: '',
                callbackUrl: '',
                publicKeyUrls: [],
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

      // SAML-specific boolean fields
      if (samlConfig.debugMode === undefined) {
        samlConfig.debugMode = false;
      }

      // Process certificates to fix escaping issues
      if (samlConfig.idp && typeof samlConfig.idp === 'object') {
        const idpConfig = samlConfig.idp as Record<string, unknown>;
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

  const customFields: RegistryFieldsType = {
    ArrayField: SsoConfigurationFormArrayFieldTemplate,
  };

  const schema = {
    properties: {
      authenticationConfiguration: authenticationConfigSchema,
      authorizerConfiguration: authorizerConfigSchema,
    },
  } as RJSFSchema;

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
    }

    // Show oidcConfiguration for confidential clients, hide for public clients
    if (currentClientType === ClientType.Public) {
      authConfig.oidcConfiguration = {
        'ui:widget': 'hidden',
        'ui:hideError': true,
      };
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
    }

    return {
      ...baseSchema,
      authenticationConfiguration: {
        ...baseSchema.authenticationConfiguration,
        'ui:classNames': 'hide-section-title',
      },
      authorizerConfiguration: {
        ...baseSchema.authorizerConfiguration,
        'ui:classNames': 'hide-section-title',
      },
    };
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
      setInternalData(e.formData);

      // Check if provider changed
      const newProvider = e.formData?.authenticationConfiguration?.provider;
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

      // First validate the configuration
      try {
        const validationResponse = await validateSecurityConfiguration(payload);
        const validationResult = validationResponse.data;

        if (validationResult.status !== VALIDATION_STATUS.SUCCESS) {
          handleValidationErrors(validationResult);

          return;
        }
      } catch (error) {
        showErrorToast(error as AxiosError);

        return;
      }

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
    const isConfidentialClient = !(
      provider === AuthProvider.Saml || provider === AuthProvider.LDAP
    );

    setInternalData({
      authenticationConfiguration: {
        provider: provider,
        providerName: provider,
        enableSelfSignup: false,
        clientType: isConfidentialClient
          ? ClientType.Confidential
          : ClientType.Public,
        // For confidential clients (OAuth providers), fields go in oidcConfiguration
        ...(isConfidentialClient
          ? {
              oidcConfiguration: {
                type: provider,
                id: '',
                secret: '',
                scope: 'openid email profile',
                discoveryUri: '',
                useNonce: false,
                preferredJwsAlgorithm: 'RS256',
                responseType: 'id_token',
                disablePkce: false,
                maxClockSkew: 0,
                clientAuthenticationMethod: 'client_secret_basic',
                tokenValidity: 0,
                customParams: {},
                tenant: '',
                serverUrl: '',
                callbackUrl: '',
                maxAge: 0,
                prompt: '',
                sessionExpiry: 0,
              },
            }
          : {
              // For public clients (SAML/LDAP), use root level fields
              authority: '',
              clientId: '',
              callbackUrl: '',
              publicKeyUrls: [],
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
    return <Loader />;
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
          saveText={t('label.save')}
          title={t('message.unsaved-changes')}
          onCancel={handleCancelModalClose}
          onDiscard={handleCancelConfirm}
          onSave={handleSaveAndExit}
        />

        <ResizablePanels
          className="content-height-with-resizable-panel sso-configured"
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
        saveText={t('label.save')}
        title={t('message.unsaved-changes')}
        onCancel={handleCancelModalClose}
        onDiscard={handleCancelConfirm}
        onSave={handleSaveAndExit}
      />

      <ResizablePanels
        className="content-height-with-resizable-panel"
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
