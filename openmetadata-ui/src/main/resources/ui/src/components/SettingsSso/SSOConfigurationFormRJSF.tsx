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

import { EditOutlined } from '@ant-design/icons';
import Form, { IChangeEvent } from '@rjsf/core';
import { RegistryFieldsType, RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { Button, Card, Divider, Space, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import {
  fetchAuthenticationConfig,
  fetchAuthorizerConfig,
} from '../../rest/miscAPI';
import {
  applySecurityConfiguration,
  SecurityConfiguration,
  validateSecurityConfiguration,
} from '../../rest/securityConfigAPI';
import { getAuthConfig } from '../../utils/AuthProvider.util';
import { transformErrors } from '../../utils/formUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import DescriptionFieldTemplate from '../common/Form/JSONSchema/JSONSchemaTemplate/DescriptionFieldTemplate';
import { FieldErrorTemplate } from '../common/Form/JSONSchema/JSONSchemaTemplate/FieldErrorTemplate/FieldErrorTemplate';
import { ObjectFieldTemplate } from '../common/Form/JSONSchema/JSONSchemaTemplate/ObjectFieldTemplate';
import SsoConfigurationFormArrayFieldTemplate from './SsoConfigurationFormArrayFieldTemplate';
import './SSOConfigurationFormRJSF.less';

// Import only the main authentication configuration schema
import { useNavigate } from 'react-router-dom';
import {
  COMMON_AUTHORIZER_FIELDS_TO_REMOVE,
  COMMON_AUTH_FIELDS_TO_REMOVE,
  DEFAULT_AUTHORIZER_CLASS_NAME,
  DEFAULT_CONTAINER_REQUEST_FILTER,
  getSSOUISchema,
  PROVIDERS_WITHOUT_BOT_PRINCIPALS,
  PROVIDER_FIELD_MAPPINGS,
} from '../../constants/SSO.constant';
import { AuthProvider, ClientType } from '../../generated/settings/settings';
import authenticationConfigSchema from '../../jsons/configuration/authenticationConfiguration.json';
import authorizerConfigSchema from '../../jsons/configuration/authorizerConfiguration.json';
import SelectWidget from '../common/Form/JSONSchema/JsonSchemaWidgets/SelectWidget';

const widgets = {
  SelectWidget: SelectWidget,
};
// Type definitions for form data
interface AuthenticationConfiguration {
  provider: string;
  providerName: string;
  authority: string;
  clientId: string;
  callbackUrl: string;
  publicKeyUrls: string[];
  tokenValidationAlgorithm: string;
  jwtPrincipalClaims: string[];
  enableSelfSignup: boolean;
  clientType?: ClientType;
  secret?: string;
  ldapConfiguration?: Record<string, unknown>;
  samlConfiguration?: Record<string, unknown>;
  oidcConfiguration?: Record<string, unknown>;
}

interface AuthorizerConfiguration {
  className: string;
  containerRequestFilter: string;
  adminPrincipals: string[];
  principalDomain: string;
  enforcePrincipalDomain: boolean;
  enableSecureSocketConnection: boolean;
  botPrincipals?: string[];
}

// UI Schema type definitions
interface UISchemaField {
  'ui:title'?: string;
  'ui:widget'?: string;
  'ui:hideError'?: boolean;
  'ui:options'?: Record<string, unknown>;
}

interface UISchemaObject {
  [key: string]: UISchemaField | UISchemaObject;
}

interface FormData {
  authenticationConfiguration: AuthenticationConfiguration;
  authorizerConfiguration: AuthorizerConfiguration;
}

const SSOConfigurationFormRJSF = () => {
  const { t } = useTranslation();
  const { setIsAuthenticated, setAuthConfig, setAuthorizerConfig } =
    useApplicationStore();

  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [internalData, setInternalData] = useState<FormData | undefined>();
  const [currentProvider, setCurrentProvider] = useState<string>(
    AuthProvider.Google
  );

  const navigate = useNavigate();

  // Clean up provider-specific fields based on selected provider
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

      // Remove bot principals for specific providers
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
    const baseSchema = getSSOUISchema(currentProvider);

    // Get current client type from form data
    const currentClientType =
      internalData?.authenticationConfiguration?.clientType;

    // Hide oidcConfiguration for public clients
    if (currentClientType === ClientType.Public) {
      (
        baseSchema.authenticationConfiguration as UISchemaObject
      ).oidcConfiguration = {
        'ui:widget': 'hidden',
        'ui:hideError': true,
      };
    }

    return baseSchema;
  }, [currentProvider, internalData?.authenticationConfiguration?.clientType]);

  // Handle form data changes
  const handleOnChange = (e: IChangeEvent<FormData>) => {
    if (e.formData) {
      setInternalData(e.formData);

      // Check if provider changed
      const newProvider = e.formData?.authenticationConfiguration?.provider;
      if (newProvider && newProvider !== currentProvider) {
        setCurrentProvider(newProvider);
      }
    }
  };

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const currentFormData = internalData;

      // Clean up provider-specific fields before submission
      const cleanedFormData = cleanupProviderSpecificFields(
        currentFormData,
        currentFormData?.authenticationConfiguration?.provider || 'google'
      );

      const payload: SecurityConfiguration = {
        authenticationConfiguration:
          cleanedFormData?.authenticationConfiguration,
        authorizerConfiguration: cleanedFormData?.authorizerConfiguration,
      };

      // First validate the configuration
      try {
        const validationResponse = await validateSecurityConfiguration(payload);
        const validationResult = validationResponse.data;

        if (validationResult.status !== 'success') {
          showErrorToast(validationResult.message);

          return;
        }
      } catch (validationError) {
        const errorMessage =
          validationError instanceof Error
            ? validationError.message
            : 'Validation failed';
        showErrorToast(t('message.validation-failed'), errorMessage);

        return;
      }

      // If validation passes, apply the configuration
      const response = await applySecurityConfiguration(payload);

      // Check if the response is successful
      if (response.status !== 200) {
        showErrorToast(t('message.configuration-save-failed'));

        return;
      }

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
      } catch (error) {
        // Show error if authentication config reload failed
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to reload authentication configuration';
        showErrorToast(errorMessage);
      }

      // Clear authentication state properly
      localStorage.removeItem('om-session');
      setIsAuthenticated(false);

      // Navigate to signin page
      navigate('/signin');
      setIsEditMode(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Configuration save failed';
      showErrorToast(t('message.configuration-save-failed'), errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  return (
    <Card className="sso-configuration-form-card flex-col">
      <div className="flex justify-between">
        <div className="flex flex-col gap-2">
          <Typography.Text className="card-title m-t-0 m-b-2 text-md">
            {t('label.sso-configuration')}
          </Typography.Text>
          <Typography.Paragraph className="card-description m-b-0 m-t-4">
            {t('message.sso-configuration-directly-from-the-ui')}
          </Typography.Paragraph>
        </div>
        {!isEditMode ? (
          <Button
            icon={<EditOutlined />}
            type="primary"
            onClick={handleEditClick}>
            {t('label.edit')}
          </Button>
        ) : (
          <Space>
            <Button
              disabled={isLoading}
              loading={isLoading}
              type="primary"
              onClick={handleSave}>
              {t('label.save')}
            </Button>
            <Button type="default" onClick={handleCancelEdit}>
              {t('label.cancel')}
            </Button>
          </Space>
        )}
      </div>
      {isEditMode && <Divider />}
      {isEditMode && (
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
            ObjectFieldTemplate: ObjectFieldTemplate,
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
    </Card>
  );
};

export default SSOConfigurationFormRJSF;
