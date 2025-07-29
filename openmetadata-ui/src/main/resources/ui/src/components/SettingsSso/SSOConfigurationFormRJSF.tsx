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
import { RegistryFieldsType, RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { Button, Card, Divider, Space, Typography } from 'antd';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ServiceCategory } from '../../enums/service.enum';
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
import {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
} from '../../utils/ToastUtils';
import WorkflowArrayFieldTemplate from '../common/Form/JSONSchema/JSONSchemaTemplate/WorkflowArrayFieldTemplate';
import FormBuilder from '../common/FormBuilder/FormBuilder';
import './SSOConfigurationFormRJSF.less';

// Import only the main authentication configuration schema
import { useNavigate } from 'react-router-dom';
import authenticationConfigSchema from '../../jsons/configuration/authenticationConfiguration.json';
import authorizerConfigSchema from '../../jsons/configuration/authorizerConfiguration.json';

interface SSOConfigurationFormRJSFProps {
  initialData?: any;
  onSubmit?: (data: any) => void;
  readOnly?: boolean;
}

const SSOConfigurationFormRJSF: React.FC<SSOConfigurationFormRJSFProps> = ({
  initialData,
  onSubmit,
  readOnly = false,
}) => {
  const { t } = useTranslation();
  const {
    setIsAuthenticated,
    setCurrentUser,
    setAuthConfig,
    setAuthorizerConfig,
  } = useApplicationStore();

  // Use ref to access form data from FormBuilder
  const formRef = useRef<any>(null);

  // Initialize form data
  const initialFormData = {
    authenticationConfiguration: {
      provider: '',
      providerName: '',
      clientType: '',
      authority: '',
      clientId: '',
      callbackUrl: '',
      publicKeyUrls: [],
      tokenValidationAlgorithm: '',
      jwtPrincipalClaims: [],
      enableSelfSignup: true,
      ...initialData?.authenticationConfiguration,
    },
    authorizerConfiguration: {
      className: '',
      containerRequestFilter: '',
      adminPrincipals: [],
      principalDomain: '',
      enforcePrincipalDomain: false,
      enableSecureSocketConnection: false,
      ...initialData?.authorizerConfiguration,
    },
  };

  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidated, setIsValidated] = useState<boolean>(false);

  const navigate = useNavigate();
  const customFields: RegistryFieldsType = {
    ArrayField: WorkflowArrayFieldTemplate,
  };

  const schema = {
    properties: {
      authenticationConfiguration: authenticationConfigSchema,
      authorizerConfiguration: authorizerConfigSchema,
    },
  } as RJSFSchema;

  const getUiSchema = () => {
    const uiSchema: any = {
      authenticationConfiguration: {
        responseType: {
          'ui:widget': 'hidden',
        },
        jwtPrincipalClaimsMapping: {
          'ui:widget': 'hidden',
        },
        ldapConfiguration: {
          'ui:widget': 'hidden',
        },
        samlConfiguration: {
          'ui:widget': 'hidden',
        },
        oidcConfiguration: {
          'ui:widget': 'hidden',
        },
        // Add titles for better labels
        provider: {
          'ui:title': 'Provider',
          'ui:options': {
            inputType: 'text',
            spellCheck: false,
            autoComplete: 'off',
          },
        },
        providerName: {
          'ui:title': 'Provider Name',
          'ui:options': {
            inputType: 'text',
            spellCheck: false,
            autoComplete: 'off',
          },
        },
        authority: {
          'ui:title': 'Authority',
          'ui:options': {
            inputType: 'text',
            spellCheck: false,
            autoComplete: 'off',
          },
        },
        clientId: {
          'ui:title': 'Client ID',
          'ui:options': {
            inputType: 'text',
            spellCheck: false,
            autoComplete: 'off',
          },
        },
        callbackUrl: {
          'ui:title': 'Callback URL',
          'ui:options': {
            inputType: 'text',
            spellCheck: false,
            autoComplete: 'off',
          },
        },
        publicKeyUrls: {
          'ui:title': 'Public Key URLs',
        },
        tokenValidationAlgorithm: {
          'ui:title': 'Token Validation Algorithm',
          'ui:options': {
            inputType: 'text',
            spellCheck: false,
            autoComplete: 'off',
          },
        },
        jwtPrincipalClaims: {
          'ui:title': 'JWT Principal Claims',
        },
        enableSelfSignup: {
          'ui:title': 'Enable Self Signup',
        },
      },
      authorizerConfiguration: {
        // Hide unwanted fields in authorizer configuration
        botPrincipals: {
          'ui:widget': 'hidden',
        },
        testPrincipals: {
          'ui:widget': 'hidden',
        },
        allowedEmailRegistrationDomains: {
          'ui:widget': 'hidden',
        },
        allowedDomains: {
          'ui:widget': 'hidden',
        },
        useRolesFromProvider: {
          'ui:widget': 'hidden',
        },
        // Add titles for better labels
        className: {
          'ui:title': 'Class Name',
          'ui:options': {
            inputType: 'text',
            spellCheck: false,
            autoComplete: 'off',
          },
        },
        // containerRequestFilter: {
        //   'ui:options': {
        //     inputType: 'text',
        //     spellCheck: false,
        //     autoComplete: 'off',
        //   },
        // },
        adminPrincipals: {
          'ui:title': 'Admin Principals',
          'ui:options': {
            inputType: 'text',
            spellCheck: false,
            autoComplete: 'off',
          },
        },
        principalDomain: {
          'ui:title': 'Principal Domain',
          'ui:options': {
            inputType: 'text',
            spellCheck: false,
            autoComplete: 'off',
          },
        },
        enforcePrincipalDomain: {
          'ui:title': 'Enforce Principal Domain',
        },
        enableSecureSocketConnection: {
          'ui:title': 'Enable Secure Socket Connection',
        },
      },
    };

    return uiSchema;
  };

  // Clean up provider-specific fields based on selected provider
  const cleanupProviderSpecificFields = (data: any, provider: string) => {
    const cleanedData = { ...data };

    if (cleanedData.authenticationConfiguration) {
      // Remove unwanted fields from authentication configuration
      const authConfig = cleanedData.authenticationConfiguration;
      delete authConfig.responseType;
      delete authConfig.jwtPrincipalClaimsMapping;
      delete authConfig.ldapConfiguration;
      delete authConfig.samlConfiguration;
      delete authConfig.oidcConfiguration;
    }

    if (cleanedData.authorizerConfiguration) {
      // Remove unwanted fields from authorizer configuration
      const authorizerConfig = cleanedData.authorizerConfiguration;
      delete authorizerConfig.botPrincipals;
      delete authorizerConfig.testPrincipals;
      delete authorizerConfig.allowedEmailRegistrationDomains;
      delete authorizerConfig.allowedDomains;
      delete authorizerConfig.useRolesFromProvider;
    }

    return cleanedData;
  };

  const handleValidate = async () => {
    setIsValidating(true);
    setValidationResult(null);
    setIsValidated(false);

    try {
      // Get the actual form data from FormBuilder
      const currentFormData =
        formRef.current?.state?.formData || initialFormData;

      const cleanedFormData = cleanupProviderSpecificFields(
        currentFormData,
        currentFormData.authenticationConfiguration?.provider || 'google'
      );

      const payload: SecurityConfiguration = {
        authenticationConfiguration:
          cleanedFormData.authenticationConfiguration,
        authorizerConfiguration: cleanedFormData.authorizerConfiguration,
      };

      const response = await validateSecurityConfiguration(payload);
      const result = response.data;
      setValidationResult(result);

      if (result.status === 'success') {
        showSuccessToast(t('message.configuration-valid'));
        setIsValidated(true);
      } else {
        showErrorToast(result.message || t('message.validation-failed'));
        setIsValidated(false);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Validation failed';
      setValidationResult({ error: true, message: errorMessage });
      showErrorToast(errorMessage);
      setIsValidated(false);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);

    try {
      // Get the form data from FormBuilder
      const currentFormData =
        formRef.current?.state?.formData || initialFormData;

      const cleanedFormData = cleanupProviderSpecificFields(
        currentFormData,
        currentFormData.authenticationConfiguration?.provider || 'google'
      );

      const payload: SecurityConfiguration = {
        authenticationConfiguration:
          cleanedFormData.authenticationConfiguration,
        authorizerConfiguration: cleanedFormData.authorizerConfiguration,
      };

      // First validate the configuration
      try {
        const validationResponse = await validateSecurityConfiguration(payload);
        const validationResult = validationResponse.data;

        if (validationResult.status !== 'success') {
          showErrorToast(
            t('message.validation-failed'),
            validationResult.message || t('message.validation-failed')
          );

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
      const result = response.data;

      // Check if the response is successful
      if (response.status !== 200) {
        showErrorToast(
          t('message.configuration-save-failed'),
          'Failed to apply security configuration'
        );

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
        // Silent fail - authentication config reload failed
      }

      // Clear authentication state properly
      localStorage.removeItem('om-session');
      setIsAuthenticated(false);
      setCurrentUser({} as any);

      // Navigate to signin page
      navigate('/signin');
      setIsEditMode(false);
      setIsValidated(false);
      // showSuccessToast(t('message.configuration-saved'));
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
    setValidationResult(null);
    setIsValidated(false);
    showInfoToast(t('message.edit-cancelled'));
  };

  return (
    <Card className="sso-configuration-form-card flex-col">
      <div className="flex justify-between">
        <div className="flex flex-col gap-2">
          <Typography.Text className="card-title m-t-0 m-b-2 text-md">
            {t('label.sso-configuration')}
          </Typography.Text>
          <Typography.Paragraph className="card-description m-b-0 m-t-4">
            {t(
              'message.scim-allows-automatic-user-and-group-management-directly-from-your-sso-provider'
            )}
            <Typography.Link
              // href="https://docs.open-metadata.org/connectors/sso/scim"
              className="read-docs-link m-l-2"
              target="_blank">
              {t('message.read-setup-docs')}
            </Typography.Link>
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
        <FormBuilder
          liveValidate
          cancelText=""
          fields={customFields}
          formData={initialFormData}
          isLoading={isLoading}
          key="sso-config-form"
          noValidate={false}
          okText=""
          readonly={false}
          ref={formRef}
          schema={schema}
          serviceCategory={ServiceCategory.METADATA_SERVICES}
          showErrorList={false}
          uiSchema={getUiSchema()}
          validator={validator}
          onCancel={handleCancelEdit}
          onSubmit={handleSave}
        />
      )}
    </Card>
  );
};

export default SSOConfigurationFormRJSF;
