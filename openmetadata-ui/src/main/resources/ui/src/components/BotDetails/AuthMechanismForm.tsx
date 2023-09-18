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

import { Button, Form, FormProps, Select, Space } from 'antd';
import { isEmpty } from 'lodash';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AuthenticationMechanism,
  AuthType,
  JWTTokenExpiry,
} from '../../generated/entity/teams/user';
import { getJWTOption, getJWTTokenExpiryOptions } from '../../utils/BotsUtils';
import Loader from '../Loader/Loader';

const { Option } = Select;

interface Props {
  isUpdating: boolean;
  authenticationMechanism: AuthenticationMechanism;
  onSave: (updatedAuthMechanism: AuthenticationMechanism) => void;
  onCancel: () => void;
}

const AuthMechanismForm: FC<Props> = ({
  isUpdating,
  onSave,
  onCancel,
  authenticationMechanism,
}) => {
  const { t } = useTranslation();

  const jwtOption = getJWTOption();

  const handleSave: FormProps['onFinish'] = (values) => {
    const updatedAuthMechanism: AuthenticationMechanism = {
      authType: values?.authType ?? AuthType.Jwt,
      config: {
        JWTTokenExpiry: values.tokenExpiry as JWTTokenExpiry,
      },
    };

    onSave(updatedAuthMechanism);
  };

  return (
    <>
      <Form
        id="update-auth-mechanism-form"
        initialValues={{
          authType: authenticationMechanism.authType ?? AuthType.Jwt,
          tokenExpiry:
            authenticationMechanism.config?.JWTTokenExpiry ??
            JWTTokenExpiry.OneHour,
        }}
        layout="vertical"
        onFinish={handleSave}>
        <Form.Item label={t('label.auth-mechanism')} name="authType">
          <Select
            disabled
            className="w-full"
            data-testid="auth-mechanism"
            placeholder={t('label.select-field', {
              field: t('label.auth-mechanism'),
            })}>
            <Option key={jwtOption.value}>{jwtOption.label}</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label={t('label.token-expiration')}
          name="tokenExpiry"
          rules={[
            {
              required: true,
            },
          ]}>
          <Select
            className="w-full"
            data-testid="token-expiry"
            placeholder={t('message.select-token-expiration')}>
            {getJWTTokenExpiryOptions().map((option) => (
              <Option key={option.value}>{option.label}</Option>
            ))}
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
            type="primary">
            {isUpdating ? <Loader size="small" /> : t('label.save')}
          </Button>
        </Space>
      </Form>
    </>
  );
};

export default AuthMechanismForm;
