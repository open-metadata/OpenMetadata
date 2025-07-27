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
import { IChangeEvent } from '@rjsf/core';
import { RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { Button, Card, Divider, Space, Typography } from 'antd';
import { cloneDeep } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ServiceCategory } from '../../enums/service.enum';
import FormBuilder from '../common/FormBuilder/FormBuilder';
import './SSOConfigurationFormRJSF.less';

// Import JSON schema files
import auth0Schema from '../../jsons/ssoSchemas/auth0.json';
import azureSchema from '../../jsons/ssoSchemas/azure.json';
import googleSchema from '../../jsons/ssoSchemas/google.json';
import oidcSchema from '../../jsons/ssoSchemas/oidc.json';
import oktaSchema from '../../jsons/ssoSchemas/okta.json';
import samlSchema from '../../jsons/ssoSchemas/saml.json';

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
  const [formData, setFormData] = useState(
    initialData || {
      provider: 'Google',
      enableSelfSignup: false,
      publicKeyUrls: [],
      scopes: [],
    }
  );

  const [formKey, setFormKey] = useState(0);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // SSO Provider JSON schemas mapping
  const SSO_PROVIDER_JSON_SCHEMAS: Record<string, any> = {
    Google: googleSchema,
    Auth0: auth0Schema,
    Azure: azureSchema,
    Okta: oktaSchema,
    Saml: samlSchema,
    CustomOidc: oidcSchema,
  };

  // Get SSO configuration schema from JSON file by provider
  const getSSOConfigurationSchemaFromJSON = (provider: string): RJSFSchema => {
    const schema = SSO_PROVIDER_JSON_SCHEMAS[provider];

    if (!schema) {
      throw new Error(`Unsupported SSO provider: ${provider}`);
    }

    return cloneDeep(schema);
  };

  // Get schema based on current provider
  const schema = useMemo(() => {
    try {
      const currentProvider = formData.provider || 'Google';
      const jsonSchema = getSSOConfigurationSchemaFromJSON(currentProvider);

      return jsonSchema;
    } catch (error) {
      // Fallback to empty schema
      return {
        type: 'object' as const,
        properties: {},
      } as RJSFSchema;
    }
  }, [formData.provider]);

  const handleFormChange = (e: IChangeEvent) => {
    const newFormData = e.formData;

    // Update form data when it changes
    setFormData(newFormData);
  };

  const handleSubmit = () => {
    setIsLoading(true);
    if (onSubmit) {
      onSubmit(formData);
    }
    setIsEditMode(false);
    setIsLoading(false);
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
            <Button loading={isLoading} type="primary" onClick={handleSubmit}>
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
          cancelText=""
          formData={formData}
          isLoading={isLoading}
          key={`sso-form-${formData.provider}-${formKey}`}
          okText=""
          readonly={readOnly}
          schema={schema}
          serviceCategory={ServiceCategory.METADATA_SERVICES}
          validator={validator}
          onCancel={handleCancelEdit}
          onChange={handleFormChange}
          onSubmit={handleSubmit}
        />
      )}
    </Card>
  );
};

export default SSOConfigurationFormRJSF;
