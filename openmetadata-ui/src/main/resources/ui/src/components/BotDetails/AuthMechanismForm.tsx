/*
 *  Copyright 2021 Collate
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

import { Button, Form, Input, Select, Space } from 'antd';
import React, { FC, useEffect, useState } from 'react';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { SsoServiceType } from '../../generated/entity/teams/authN/ssoAuth';
import {
  AuthenticationMechanism,
  AuthType,
  JWTTokenExpiry,
} from '../../generated/entity/teams/user';
import { Auth0SSOClientConfig } from '../../generated/security/client/auth0SSOClientConfig';
import { AzureSSOClientConfig } from '../../generated/security/client/azureSSOClientConfig';
import { CustomOidcSSOClientConfig } from '../../generated/security/client/customOidcSSOClientConfig';
import { GoogleSSOClientConfig } from '../../generated/security/client/googleSSOClientConfig';
import { OktaSSOClientConfig } from '../../generated/security/client/oktaSSOClientConfig';
import {
  getAuthMechanismTypeOptions,
  getJWTTokenExpiryOptions,
} from '../../utils/BotsUtils';
import { SSOClientConfig } from '../CreateUser/CreateUser.interface';
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
  const { authConfig } = useAuthContext();

  const [authMechanism, setAuthMechanism] = useState<AuthType>(
    authenticationMechanism.authType ?? AuthType.Jwt
  );
  const [tokenExpiry, setTokenExpiry] = useState<JWTTokenExpiry>(
    authenticationMechanism.config?.JWTTokenExpiry ?? JWTTokenExpiry.OneHour
  );

  const [ssoClientConfig, setSSOClientConfig] = useState<SSOClientConfig>(
    (authenticationMechanism.config?.authConfig as SSOClientConfig) ??
      ({} as SSOClientConfig)
  );

  useEffect(() => {
    const authType = authenticationMechanism.authType;
    const authConfig = authenticationMechanism.config?.authConfig;
    const JWTTokenExpiryValue = authenticationMechanism.config?.JWTTokenExpiry;
    setAuthMechanism(authType ?? AuthType.Jwt);
    setSSOClientConfig(
      (authConfig as SSOClientConfig) ?? ({} as SSOClientConfig)
    );
    setTokenExpiry(JWTTokenExpiryValue ?? JWTTokenExpiry.OneHour);
  }, [authenticationMechanism]);

  /**
   * Handle on change event
   * @param event
   */
  const handleOnChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    const eleName = event.target.name;

    switch (eleName) {
      case 'secretKey':
      case 'audience':
      case 'clientId':
      case 'domain':
      case 'clientSecret':
      case 'authority':
      case 'privateKey':
      case 'orgURL':
      case 'tokenEndpoint':
        setSSOClientConfig((previous) => ({
          ...previous,
          [eleName]: value,
        }));

        break;

      case 'scopes':
        setSSOClientConfig((previous) => ({
          ...previous,
          scopes: value ? value.split(',') : [],
        }));

        break;

      case 'oktaEmail':
        setSSOClientConfig((previous) => ({
          ...previous,
          email: value,
        }));

        break;

      default:
        break;
    }
  };

  const handleSave = () => {
    const updatedAuthMechanism: AuthenticationMechanism = {
      authType: authMechanism,
      config:
        authMechanism === AuthType.Jwt
          ? {
              JWTTokenExpiry: tokenExpiry,
            }
          : {
              ssoServiceType: authConfig?.provider as SsoServiceType,
              authConfig: {
                ...ssoClientConfig,
              },
            },
    };

    onSave(updatedAuthMechanism);
  };

  const getSSOConfig = () => {
    switch (authConfig?.provider) {
      case SsoServiceType.Google: {
        const googleConfig = ssoClientConfig as GoogleSSOClientConfig;

        return (
          <>
            <Form.Item
              label="SecretKey"
              name="secretKey"
              rules={[
                {
                  required: true,
                  message: 'SecretKey is required',
                },
              ]}>
              <Input.Password
                data-testid="secretKey"
                name="secretKey"
                placeholder="secretKey"
                value={googleConfig.secretKey}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item label="Audience" name="audience">
              <Input
                data-testid="audience"
                name="audience"
                placeholder="audience"
                value={googleConfig.audience}
                onChange={handleOnChange}
              />
            </Form.Item>
          </>
        );
      }

      case SsoServiceType.Auth0: {
        const auth0Config = ssoClientConfig as Auth0SSOClientConfig;

        return (
          <>
            <Form.Item
              label="SecretKey"
              name="secretKey"
              rules={[
                {
                  required: true,
                  message: 'SecretKey is required',
                },
              ]}>
              <Input.Password
                data-testid="secretKey"
                name="secretKey"
                placeholder="secretKey"
                value={auth0Config.secretKey}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label="ClientId"
              name="clientId"
              rules={[
                {
                  required: true,
                  message: 'ClientId is required',
                },
              ]}>
              <Input
                data-testid="clientId"
                name="clientId"
                placeholder="clientId"
                value={auth0Config.clientId}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label="Domain"
              name="domain"
              rules={[
                {
                  required: true,
                  message: 'Domain is required',
                },
              ]}>
              <Input
                data-testid="domain"
                name="domain"
                placeholder="domain"
                value={auth0Config.domain}
                onChange={handleOnChange}
              />
            </Form.Item>
          </>
        );
      }
      case SsoServiceType.Azure: {
        const azureConfig = ssoClientConfig as AzureSSOClientConfig;

        return (
          <>
            <Form.Item
              label="ClientSecret"
              name="clientSecret"
              rules={[
                {
                  required: true,
                  message: 'ClientSecret is required',
                },
              ]}>
              <Input.Password
                data-testid="clientSecret"
                name="clientSecret"
                placeholder="clientSecret"
                value={azureConfig.clientSecret}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label="ClientId"
              name="clientId"
              rules={[
                {
                  required: true,
                  message: 'ClientId is required',
                },
              ]}>
              <Input
                data-testid="clientId"
                name="clientId"
                placeholder="clientId"
                value={azureConfig.clientId}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label="Authority"
              name="authority"
              rules={[
                {
                  required: true,
                  message: 'Authority is required',
                },
              ]}>
              <Input
                data-testid="authority"
                name="authority"
                placeholder="authority"
                value={azureConfig.authority}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label="Scopes"
              name="scopes"
              rules={[
                {
                  required: true,
                  message: 'Scopes is required',
                },
              ]}>
              <Input
                data-testid="scopes"
                name="scopes"
                placeholder="Scopes value comma separated"
                value={azureConfig.scopes.join(',')}
                onChange={handleOnChange}
              />
            </Form.Item>
          </>
        );
      }
      case SsoServiceType.Okta: {
        const oktaConfig = ssoClientConfig as OktaSSOClientConfig;

        return (
          <>
            <Form.Item
              label="PrivateKey"
              name="privateKey"
              rules={[
                {
                  required: true,
                  message: 'PrivateKey is required',
                },
              ]}>
              <Input.Password
                data-testid="privateKey"
                name="privateKey"
                placeholder="privateKey"
                value={oktaConfig.privateKey}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label="ClientId"
              name="clientId"
              rules={[
                {
                  required: true,
                  message: 'ClientId is required',
                },
              ]}>
              <Input
                data-testid="clientId"
                name="clientId"
                placeholder="clientId"
                value={oktaConfig.clientId}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label="OrgURL"
              name="orgURL"
              rules={[
                {
                  required: true,
                  message: 'OrgURL is required',
                },
              ]}>
              <Input
                data-testid="orgURL"
                name="orgURL"
                placeholder="orgURL"
                value={oktaConfig.orgURL}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label="Email"
              name="oktaEmail"
              rules={[
                {
                  required: true,
                  type: 'email',
                  message: 'Service account Email is required',
                },
              ]}>
              <Input
                data-testid="oktaEmail"
                name="oktaEmail"
                placeholder="Okta Service account Email"
                value={oktaConfig.email}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item label="Scopes" name="scopes">
              <Input
                data-testid="scopes"
                name="scopes"
                placeholder="Scopes value comma separated"
                value={oktaConfig.scopes?.join('')}
                onChange={handleOnChange}
              />
            </Form.Item>
          </>
        );
      }
      case SsoServiceType.CustomOidc: {
        const customOidcConfig = ssoClientConfig as CustomOidcSSOClientConfig;

        return (
          <>
            <Form.Item
              label="SecretKey"
              name="secretKey"
              rules={[
                {
                  required: true,
                  message: 'SecretKey is required',
                },
              ]}>
              <Input.Password
                data-testid="secretKey"
                name="secretKey"
                placeholder="secretKey"
                value={customOidcConfig.secretKey}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label="ClientId"
              name="clientId"
              rules={[
                {
                  required: true,
                  message: 'ClientId is required',
                },
              ]}>
              <Input
                data-testid="clientId"
                name="clientId"
                placeholder="clientId"
                value={customOidcConfig.clientId}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label="TokenEndpoint"
              name="tokenEndpoint"
              rules={[
                {
                  required: true,
                  message: 'TokenEndpoint is required',
                },
              ]}>
              <Input
                data-testid="tokenEndpoint"
                name="tokenEndpoint"
                placeholder="tokenEndpoint"
                value={customOidcConfig.tokenEndpoint}
                onChange={handleOnChange}
              />
            </Form.Item>
          </>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Form
      id="update-auth-mechanism-form"
      layout="vertical"
      onFinish={handleSave}>
      <Form.Item
        label="Auth Mechanism"
        name="auth-mechanism"
        rules={[
          {
            required: true,
            validator: () => {
              if (!authMechanism) {
                return Promise.reject('Auth Mechanism is required');
              }

              return Promise.resolve();
            },
          },
        ]}>
        <Select
          className="w-full"
          data-testid="auth-mechanism"
          defaultValue={authMechanism}
          placeholder="Select Auth Mechanism"
          onChange={(value) => setAuthMechanism(value)}>
          {getAuthMechanismTypeOptions(authConfig).map((option) => (
            <Option key={option.value}>{option.label}</Option>
          ))}
        </Select>
      </Form.Item>

      {authMechanism === AuthType.Jwt && (
        <Form.Item
          label="Token Expiration"
          name="token-expiration"
          rules={[
            {
              required: true,
              validator: () => {
                if (!tokenExpiry) {
                  return Promise.reject('Token Expiration is required');
                }

                return Promise.resolve();
              },
            },
          ]}>
          <Select
            className="w-full"
            data-testid="token-expiry"
            defaultValue={tokenExpiry}
            placeholder="Select Token Expiration"
            onChange={(value) => setTokenExpiry(value)}>
            {getJWTTokenExpiryOptions().map((option) => (
              <Option key={option.value}>{option.label}</Option>
            ))}
          </Select>
        </Form.Item>
      )}
      {authMechanism === AuthType.Sso && <>{getSSOConfig()}</>}
      <Space className="w-full tw-justify-end" size={4}>
        <Button data-testid="cancel-edit" type="link" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          data-testid="save-edit"
          form="update-auth-mechanism-form"
          htmlType="submit"
          type="primary">
          {isUpdating ? <Loader size="small" /> : 'Save'}
        </Button>
      </Space>
    </Form>
  );
};

export default AuthMechanismForm;
