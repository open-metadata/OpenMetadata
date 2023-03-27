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

import { Button, Form, Input, Modal, Select, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import _, { isEmpty } from 'lodash';
import React, { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { checkEmailInUse } from 'rest/auth-API';
import { createBotWithPut } from 'rest/botsAPI';
import { createUserWithPut, getUserByName } from 'rest/userAPI';
import { validEmailRegEx } from '../../constants/regex.constants';
import { SsoServiceType } from '../../generated/auth/ssoAuth';
import { Bot } from '../../generated/entity/bot';
import {
  AuthenticationMechanism,
  AuthType,
  JWTTokenExpiry,
  SsoClientConfig,
  User,
} from '../../generated/entity/teams/user';
import { getNameFromEmail } from '../../utils/AuthProvider.util';
import {
  getAuthMechanismFormInitialValues,
  getAuthMechanismTypeOptions,
  getJWTTokenExpiryOptions,
} from '../../utils/BotsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useAuthContext } from '../authentication/auth-provider/AuthProvider';
import Loader from '../Loader/Loader';

const { Option } = Select;

interface Props {
  botUser: User;
  botData: Bot;
  isUpdating: boolean;
  authenticationMechanism: AuthenticationMechanism;
  onSave: (updatedAuthMechanism: AuthenticationMechanism) => void;
  onCancel: () => void;
  onEmailChange: () => void;
}

const AuthMechanismForm: FC<Props> = ({
  isUpdating,
  onSave,
  onCancel,
  authenticationMechanism,
  botUser,
  botData,
  onEmailChange,
}) => {
  const { t } = useTranslation();
  const { authConfig } = useAuthContext();

  const [authMechanism, setAuthMechanism] = useState<AuthType>(
    authenticationMechanism.authType ?? AuthType.Jwt
  );
  const [tokenExpiry, setTokenExpiry] = useState<JWTTokenExpiry>(
    authenticationMechanism.config?.JWTTokenExpiry ?? JWTTokenExpiry.OneHour
  );

  const [ssoClientConfig, setSSOClientConfig] = useState<
    SsoClientConfig | undefined
  >(authenticationMechanism.config?.authConfig);

  const [accountEmail, setAccountEmail] = useState<string>(botUser.email);

  const [isConfirmationModalOpen, setIsConfirmationModalOpen] =
    useState<boolean>(false);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const authType = authenticationMechanism.authType;
    const authConfig = authenticationMechanism.config?.authConfig;
    const JWTTokenExpiryValue = authenticationMechanism.config?.JWTTokenExpiry;
    setAuthMechanism(authType ?? AuthType.Jwt);
    setSSOClientConfig(authConfig);
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
      case 'email':
        setAccountEmail(value);

        break;

      default:
        break;
    }
  };

  const handleSave = () => {
    if (accountEmail !== botUser.email) {
      setIsConfirmationModalOpen(true);
    } else {
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
    }
  };

  const handleBotUpdate = async (response: User) => {
    try {
      await createBotWithPut({
        name: botData.name,
        description: botData.description,
        displayName: botData.displayName,
        botUser: _.toString(response.fullyQualifiedName),
      });
      setIsConfirmationModalOpen(false);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      onEmailChange();
      setIsLoading(false);
    }
  };

  const handleAccountEmailChange = async () => {
    try {
      setIsLoading(true);
      const isUserExists = await checkEmailInUse(accountEmail);
      if (isUserExists) {
        const userResponse = await getUserByName(
          getNameFromEmail(accountEmail)
        );
        handleBotUpdate(userResponse);
      } else {
        const userResponse = await createUserWithPut({
          email: accountEmail,
          name: getNameFromEmail(accountEmail),
          botName: botData.name,
          isBot: true,
          authenticationMechanism: {
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
          },
        });
        handleBotUpdate(userResponse);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const getSSOConfig = () => {
    switch (authConfig?.provider) {
      case SsoServiceType.Google: {
        return (
          <>
            <Form.Item
              label={t('label.secret-key')}
              name="secretKey"
              rules={[
                {
                  required: true,
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.secret-key'),
                  }),
                },
              ]}>
              <Input.Password
                data-testid="secretKey"
                name="secretKey"
                placeholder={t('label.secret-key')}
                value={ssoClientConfig?.secretKey}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item label={t('label.audience')} name="audience">
              <Input
                data-testid="audience"
                name="audience"
                placeholder={t('label.audience')}
                value={ssoClientConfig?.audience}
                onChange={handleOnChange}
              />
            </Form.Item>
          </>
        );
      }

      case SsoServiceType.Auth0: {
        return (
          <>
            <Form.Item
              label={t('label.secret-key')}
              name="secretKey"
              rules={[
                {
                  required: true,
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.secret-key'),
                  }),
                },
              ]}>
              <Input.Password
                data-testid="secretKey"
                name="secretKey"
                placeholder={t('label.secret-key')}
                value={ssoClientConfig?.secretKey}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label={t('label.client-id')}
              name="clientId"
              rules={[
                {
                  required: true,
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.client-id'),
                  }),
                },
              ]}>
              <Input
                data-testid="clientId"
                name="clientId"
                placeholder={t('label.client-id')}
                value={ssoClientConfig?.clientId}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label={t('label.domain')}
              name="domain"
              rules={[
                {
                  required: true,
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.domain'),
                  }),
                },
              ]}>
              <Input
                data-testid="domain"
                name="domain"
                placeholder={t('label.domain')}
                value={ssoClientConfig?.domain}
                onChange={handleOnChange}
              />
            </Form.Item>
          </>
        );
      }
      case SsoServiceType.Azure: {
        return (
          <>
            <Form.Item
              label={t('label.client-secret')}
              name="clientSecret"
              rules={[
                {
                  required: true,
                  message: t('message.clientSecret-required'),
                },
              ]}>
              <Input.Password
                data-testid="clientSecret"
                name="clientSecret"
                placeholder={t('label.client-secret')}
                value={ssoClientConfig?.clientSecret}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label={t('label.client-id')}
              name="clientId"
              rules={[
                {
                  required: true,
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.client-id'),
                  }),
                },
              ]}>
              <Input
                data-testid="clientId"
                name="clientId"
                placeholder={t('label.client-id')}
                value={ssoClientConfig?.clientId}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label={t('label.authority')}
              name="authority"
              rules={[
                {
                  required: true,
                  message: t('message.field-is-require', {
                    field: t('label.authority'),
                  }),
                },
              ]}>
              <Input
                data-testid="authority"
                name="authority"
                placeholder={t('label.authority')}
                value={ssoClientConfig?.authority}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label={t('label.scope-plural')}
              name="scopes"
              rules={[
                {
                  required: true,
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.scope-plural'),
                  }),
                },
              ]}>
              <Input
                data-testid="scopes"
                name="scopes"
                placeholder={t('message.scopes-comma-separated')}
                value={ssoClientConfig?.scopes?.join(',')}
                onChange={handleOnChange}
              />
            </Form.Item>
          </>
        );
      }
      case SsoServiceType.Okta: {
        return (
          <>
            <Form.Item
              label={t('label.privateKey')}
              name="privateKey"
              rules={[
                {
                  required: true,
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.private-key'),
                  }),
                },
              ]}>
              <Input.Password
                data-testid="privateKey"
                name="privateKey"
                placeholder={t('label.privateKey')}
                value={ssoClientConfig?.privateKey}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label={t('label.client-id')}
              name="clientId"
              rules={[
                {
                  required: true,
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.client-id'),
                  }),
                },
              ]}>
              <Input
                data-testid="clientId"
                name="clientId"
                placeholder={t('label.client-id')}
                value={ssoClientConfig?.clientId}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label={t('label.org-url')}
              name="orgURL"
              rules={[
                {
                  required: true,
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.org-url'),
                  }),
                },
              ]}>
              <Input
                data-testid="orgURL"
                name="orgURL"
                placeholder={t('label.org-url')}
                value={ssoClientConfig?.orgURL}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label={t('label.email')}
              name="oktaEmail"
              rules={[
                {
                  required: true,
                  type: 'email',
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.service-account-email'),
                  }),
                },
              ]}>
              <Input
                data-testid="oktaEmail"
                name="oktaEmail"
                placeholder={t('label.okta-service-account-email')}
                value={ssoClientConfig?.email}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item label={t('label.scope-plural')} name="scopes">
              <Input
                data-testid="scopes"
                name="scopes"
                placeholder={t('message.scopes-comma-separated')}
                value={ssoClientConfig?.scopes?.join('')}
                onChange={handleOnChange}
              />
            </Form.Item>
          </>
        );
      }
      case SsoServiceType.CustomOidc: {
        return (
          <>
            <Form.Item
              label={t('label.secret-key')}
              name="secretKey"
              rules={[
                {
                  required: true,
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.secret-key'),
                  }),
                },
              ]}>
              <Input.Password
                data-testid="secretKey"
                name="secretKey"
                placeholder={t('label.secret-key')}
                value={ssoClientConfig?.secretKey}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label={t('label.client-id')}
              name="clientId"
              rules={[
                {
                  required: true,
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.client-id'),
                  }),
                },
              ]}>
              <Input
                data-testid="clientId"
                name="clientId"
                placeholder={t('label.client-id')}
                value={ssoClientConfig?.clientId}
                onChange={handleOnChange}
              />
            </Form.Item>
            <Form.Item
              label={t('label.token-end-point')}
              name="tokenEndpoint"
              rules={[
                {
                  required: true,
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.token-end-point'),
                  }),
                },
              ]}>
              <Input
                data-testid="tokenEndpoint"
                name="tokenEndpoint"
                placeholder={t('label.token-end-point')}
                value={ssoClientConfig?.tokenEndpoint}
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
    <>
      <Form
        id="update-auth-mechanism-form"
        initialValues={getAuthMechanismFormInitialValues(
          authenticationMechanism,
          botUser
        )}
        layout="vertical"
        onFinish={handleSave}>
        <Form.Item
          label={t('label.auth-mechanism')}
          name="auth-mechanism"
          rules={[
            {
              required: true,
              validator: () => {
                if (!authMechanism) {
                  return Promise.reject(
                    t('message.field-text-is-required', {
                      fieldText: t('label.auth-mechanism'),
                    })
                  );
                }

                return Promise.resolve();
              },
            },
          ]}>
          <Select
            className="w-full"
            data-testid="auth-mechanism"
            defaultValue={authMechanism}
            placeholder={t('label.select-field', {
              field: t('label.auth-mechanism'),
            })}
            onChange={(value) => setAuthMechanism(value)}>
            {getAuthMechanismTypeOptions(authConfig).map((option) => (
              <Option key={option.value}>{option.label}</Option>
            ))}
          </Select>
        </Form.Item>

        {authMechanism === AuthType.Jwt && (
          <Form.Item
            label={t('label.token-expiration')}
            name="token-expiration"
            rules={[
              {
                required: true,
                validator: () => {
                  if (!tokenExpiry) {
                    return Promise.reject(
                      t('message.field-text-is-required', {
                        fieldText: t('label.token-expiration'),
                      })
                    );
                  }

                  return Promise.resolve();
                },
              },
            ]}>
            <Select
              className="w-full"
              data-testid="token-expiry"
              defaultValue={tokenExpiry}
              placeholder={t('message.select-token-expiration')}
              onChange={(value) => setTokenExpiry(value)}>
              {getJWTTokenExpiryOptions().map((option) => (
                <Option key={option.value}>{option.label}</Option>
              ))}
            </Select>
          </Form.Item>
        )}
        {authMechanism === AuthType.Sso && (
          <>
            <Form.Item
              label={t('label.email')}
              name="email"
              rules={[
                {
                  pattern: validEmailRegEx,
                  required: true,
                  type: 'email',
                  message: t('message.email-is-invalid'),
                },
              ]}>
              <Input
                data-testid="email"
                name="email"
                placeholder={t('label.email')}
                value={accountEmail}
                onChange={handleOnChange}
              />
            </Form.Item>
            {getSSOConfig()}
          </>
        )}
        <Space className="w-full tw-justify-end" size={4}>
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
      {isConfirmationModalOpen && (
        <Modal
          centered
          destroyOnClose
          closable={false}
          confirmLoading={isLoading}
          maskClosable={false}
          okText={t('label.confirm')}
          title={t('message.are-you-sure')}
          visible={isConfirmationModalOpen}
          onCancel={() => setIsConfirmationModalOpen(false)}
          onOk={handleAccountEmailChange}>
          <Typography.Text>
            {t('message.bot-email-confirmation', {
              email: t('message.create-or-update-email-account-for-bot'),
              botName: botData.name,
            })}
          </Typography.Text>
        </Modal>
      )}
    </>
  );
};

export default AuthMechanismForm;
