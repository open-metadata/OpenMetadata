/*
 *  Copyright 2022 Collate.
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

import { Button, Form, FormProps, Select, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { FC, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { VALIDATION_MESSAGES } from '../../../../constants/constants';
import {
  PersonalAccessToken,
  TokenType,
} from '../../../../generated/auth/personalAccessToken';
import {
  AuthenticationMechanism,
  AuthType,
  JWTTokenExpiry,
} from '../../../../generated/entity/teams/user';
import { ScimConfiguration } from '../../../../generated/scim/scimConfiguration';
import { SettingType } from '../../../../generated/settings/settings';
import { updateSettingsConfig } from '../../../../rest/settingConfigAPI';
import { getJWTTokenExpiryOptions } from '../../../../utils/BotsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';

const { Option } = Select;

interface Props {
  isUpdating: boolean;
  authenticationMechanism: AuthenticationMechanism | PersonalAccessToken;
  onSave: (updatedAuthMechanism: AuthenticationMechanism) => void;
  onCancel?: () => void;
  isBot: boolean;
  isSCIMBot?: boolean;
}

const AuthMechanismForm: FC<Props> = ({
  isUpdating,
  onSave,
  onCancel,
  authenticationMechanism,
  isBot,
  isSCIMBot,
}) => {
  const { t } = useTranslation();
  const handleSave: FormProps['onFinish'] = (values) => {
    const updatedAuthMechanism: AuthenticationMechanism = {
      authType: values?.authType ?? AuthType.Jwt,
      config: {
        JWTTokenExpiry: values.tokenExpiry as JWTTokenExpiry,
      },
    };
    onSave(updatedAuthMechanism);
  };
  const authOptions = useMemo(() => {
    const botValue = {
      label: 'OpenMetadata JWT',
      value: 'JWT',
    };
    const accessTokenValue = {
      label: 'Personal Access Token',
      value: TokenType.PersonalAccessToken,
    };

    return isBot ? botValue : accessTokenValue;
  }, [isBot]);

  const { authType, tokenExpiry } = useMemo(() => {
    if (isBot) {
      const botData = authenticationMechanism as AuthenticationMechanism;

      return {
        authType: botData?.authType,
        tokenExpiry: JWTTokenExpiry.OneHour,
      };
    }

    const personalAccessData = authenticationMechanism as PersonalAccessToken;

    return {
      authType: personalAccessData?.tokenType ?? TokenType.PersonalAccessToken,
      tokenExpiry: JWTTokenExpiry.OneHour,
    };
  }, [isBot, authenticationMechanism]);

  const handleGenerateSCIMToken = useCallback(async () => {
    // Update SCIM configuration when generating token for SCIM bot
    if (isSCIMBot) {
      try {
        const scimConfig: ScimConfiguration = {
          enabled: true,
          identityProvider: 'default',
        };

        await updateSettingsConfig({
          config_type: SettingType.ScimConfiguration,
          config_value: scimConfig,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        showErrorToast(error as AxiosError);
      }
    }

    onSave({
      authType: AuthType.Jwt,
      config: {
        JWTTokenExpiry: JWTTokenExpiry.OneHour,
      },
    });
  }, [onSave, isSCIMBot]);

  return isSCIMBot ? (
    <div className="flex  justify-between items-center">
      <div className="flex flex-col gap-2">
        <Typography.Text className="card-title m-t-0 m-b-2 text-md">
          {t('message.automate-provisioning-with-scim')}
        </Typography.Text>
        <Typography.Paragraph className="m-b-0 card-description">
          {t(
            'message.scim-allows-automatic-user-and-group-management-directly-from-your-sso-provider'
          )}
        </Typography.Paragraph>
      </div>
      <Button
        className="text-sm generate-scim-token-btn"
        data-testid="generate-scim-token"
        size="small"
        type="primary"
        onClick={handleGenerateSCIMToken}>
        {t('label.generate-token')}
      </Button>
    </div>
  ) : (
    <Form
      id="update-auth-mechanism-form"
      initialValues={{ authType, tokenExpiry }}
      layout="vertical"
      validateMessages={VALIDATION_MESSAGES}
      onFinish={handleSave}>
      <Form.Item label={t('label.auth-mechanism')} name="authType">
        <Select
          disabled
          className="w-full"
          data-testid="auth-mechanism"
          placeholder={t('label.select-field', {
            field: t('label.auth-mechanism'),
          })}>
          <Option key={authOptions.value}>{authOptions.label}</Option>
        </Select>
      </Form.Item>

      <Form.Item
        label={t('label.token-expiration')}
        name="tokenExpiry"
        rules={[{ required: true }]}>
        <Select
          className="w-full"
          data-testid="token-expiry"
          placeholder={t('message.select-token-expiration')}>
          {getJWTTokenExpiryOptions(!isBot)}
        </Select>
      </Form.Item>

      <Space className="w-full justify-end" size={4}>
        {!isEmpty(authenticationMechanism) && (
          <Button data-testid="cancel-edit" type="link" onClick={onCancel}>
            {t('label.cancel')}
          </Button>
        )}
        <Button
          data-testid="save-edit"
          form="update-auth-mechanism-form"
          htmlType="submit"
          loading={isUpdating}
          type="primary">
          {t('label.generate')}
        </Button>
      </Space>
    </Form>
  );
};

export default AuthMechanismForm;
