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

import {
  Button,
  Form,
  Input,
  Radio,
  RadioChangeEvent,
  Select,
  Space,
  Switch,
} from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, map, trim } from 'lodash';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { checkEmailInUse, generateRandomPwd } from 'rest/auth-API';
import { getEntityName } from 'utils/EntityUtils';
import { VALIDATION_MESSAGES } from '../../constants/constants';
import { EMAIL_REG_EX, passwordRegex } from '../../constants/regex.constants';
import { AuthTypes } from '../../enums/signin.enum';
import { CreatePasswordGenerator } from '../../enums/user.enum';
import {
  CreatePasswordType,
  CreateUser as CreateUserSchema,
} from '../../generated/api/teams/createUser';
import {
  AuthType,
  JWTTokenExpiry,
  SsoClientConfig,
  SsoServiceType,
} from '../../generated/entity/teams/user';
import { getJWTOption, getJWTTokenExpiryOptions } from '../../utils/BotsUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useAuthContext } from '../authentication/auth-provider/AuthProvider';
import CopyToClipboardButton from '../buttons/CopyToClipboardButton/CopyToClipboardButton';
import RichTextEditor from '../common/rich-text-editor/RichTextEditor';
import { EditorContentRef } from '../common/rich-text-editor/RichTextEditor.interface';
import Loader from '../Loader/Loader';
import TeamsSelectable from '../TeamsSelectable/TeamsSelectable';
import { CreateUserProps } from './CreateUser.interface';

const { Option } = Select;

const CreateUser = ({
  roles,
  isLoading,
  onCancel,
  onSave,
  forceBot,
}: CreateUserProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { authConfig } = useAuthContext();
  const markdownRef = useRef<EditorContentRef>();
  const [description] = useState<string>('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBot, setIsBot] = useState(forceBot);
  const [selectedTeams, setSelectedTeams] = useState<Array<string | undefined>>(
    []
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordGenerator, setPasswordGenerator] = useState(
    CreatePasswordGenerator.AutomaticGenerate
  );
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [isPasswordGenerating, setIsPasswordGenerating] = useState(false);
  const [authMechanism, setAuthMechanism] = useState<AuthType>(AuthType.Jwt);
  const [tokenExpiry, setTokenExpiry] = useState<JWTTokenExpiry>(
    JWTTokenExpiry.OneHour
  );

  const [ssoClientConfig, setSSOClientConfig] = useState<SsoClientConfig>();

  const isAuthProviderBasic = useMemo(
    () =>
      authConfig?.provider === AuthTypes.BASIC ||
      authConfig?.provider === AuthTypes.LDAP,
    [authConfig]
  );

  const jwtOption = getJWTOption();

  const selectedRoles = Form.useWatch('roles', form);

  const roleOptions = useMemo(() => {
    return map(roles, (role) => ({
      label: getEntityName(role),
      value: role.id,
    }));
  }, [roles]);

  /**
   * Handle on change event
   * @param event
   */
  const handleOnChange = (
    event:
      | React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
      | RadioChangeEvent
  ) => {
    const value = event.target.value;
    const eleName = event.target.name;

    switch (eleName) {
      case 'email':
        setEmail(value);

        break;

      case 'displayName':
        setDisplayName(value);

        break;
      case 'secretKey':
        setSSOClientConfig((previous) => ({
          ...previous,
          secretKey: value,
        }));

        break;
      case 'audience':
        setSSOClientConfig((previous) => ({
          ...previous,
          audience: value,
        }));

        break;
      case 'clientId':
        setSSOClientConfig((previous) => ({
          ...previous,
          clientId: value,
        }));

        break;
      case 'domain':
        setSSOClientConfig((previous) => ({
          ...previous,
          domain: value,
        }));

        break;
      case 'clientSecret':
        setSSOClientConfig((previous) => ({
          ...previous,
          clientSecret: value,
        }));

        break;
      case 'authority':
        setSSOClientConfig((previous) => ({
          ...previous,
          authority: value,
        }));

        break;
      case 'scopes':
        setSSOClientConfig((previous) => ({
          ...previous,
          scopes: value ? value.split(',') : [],
        }));

        break;
      case 'privateKey':
        setSSOClientConfig((previous) => ({
          ...previous,
          privateKey: value,
        }));

        break;
      case 'orgURL':
        setSSOClientConfig((previous) => ({
          ...previous,
          orgURL: value,
        }));

        break;
      case 'oktaEmail':
        setSSOClientConfig((previous) => ({
          ...previous,
          email: value,
        }));

        break;
      case 'tokenEndpoint':
        setSSOClientConfig((previous) => ({
          ...previous,
          tokenEndpoint: value,
        }));

        break;

      case 'password':
        setPassword(value);

        break;

      case 'confirmPassword':
        setConfirmPassword(value);

        break;

      case 'passwordGenerator':
        setPasswordGenerator(value);

        break;

      default:
        break;
    }
  };

  const generateRandomPassword = async () => {
    setIsPasswordGenerating(true);
    try {
      const password = await generateRandomPwd();
      setTimeout(() => {
        setGeneratedPassword(password);
        form.setFieldsValue({ generatedPassword: password });
      }, 500);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsPasswordGenerating(false);
    }
  };

  /**
   * Form submit handler
   */
  const handleSave = () => {
    const isPasswordGenerated =
      passwordGenerator === CreatePasswordGenerator.AutomaticGenerate;
    const validTeam = selectedTeams.filter(
      (id) => !isUndefined(id)
    ) as string[];

    const userProfile: CreateUserSchema = {
      description: markdownRef.current?.getEditorContent() || undefined,
      name: email.split('@')[0],
      displayName: trim(displayName),
      roles: selectedRoles,
      teams: validTeam.length ? validTeam : undefined,
      email: email,
      isAdmin: isAdmin,
      isBot: isBot,
      ...(forceBot
        ? {
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
          }
        : {
            password: isPasswordGenerated ? generatedPassword : password,
            confirmPassword: isPasswordGenerated
              ? generatedPassword
              : confirmPassword,
            createPasswordType: CreatePasswordType.AdminCreate,
          }),
    };
    onSave(userProfile);
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
                  message: t('label.field-required', {
                    field: t('label.secret-key'),
                  }),
                },
              ]}>
              <Input.Password
                autoComplete="off"
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
                  message: t('label.field-required', {
                    field: t('label.secret-key'),
                  }),
                },
              ]}>
              <Input.Password
                autoComplete="off"
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
                  message: t('label.field-required', {
                    field: t('label.client-id'),
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
                  message: t('label.field-required', {
                    field: t('label.domain'),
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
                  message: t('label.field-required', {
                    field: t('label.client-secret'),
                  }),
                },
              ]}>
              <Input.Password
                autoComplete="off"
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
                  message: t('label.field-required', {
                    field: t('label.client-id'),
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
                  message: t('label.field-required', {
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
                  message: t('message.scopes-comma-separated'),
                },
              ]}>
              <Input
                data-testid="scopes"
                name="scopes"
                placeholder={t('message.scopes-comma-separated')}
                value={ssoClientConfig?.scopes}
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
              label={t('label.private-key')}
              name="privateKey"
              rules={[
                {
                  required: true,
                  message: t('label.field-required', {
                    field: t('label.private-key'),
                  }),
                },
              ]}>
              <Input.Password
                autoComplete="off"
                data-testid="privateKey"
                name="privateKey"
                placeholder={t('label.private-key')}
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
                  message: t('label.field-required', {
                    field: t('label.client-id'),
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
                  message: t('label.field-required', {
                    field: t('label.org-url'),
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
                  message: t('label.field-required', {
                    field: t('label.service-account-email'),
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
                value={ssoClientConfig?.scopes}
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
                  message: t('label.field-required', {
                    field: t('label.secret-key'),
                  }),
                },
              ]}>
              <Input.Password
                autoComplete="off"
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
                  message: t('label.field-required', {
                    field: t('label.client-id'),
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
                  message: t('label.field-required', {
                    field: t('label.token-end-point'),
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

  useEffect(() => {
    generateRandomPassword();
  }, []);

  return (
    <>
      <h6 className="tw-heading tw-text-base">
        {t('label.create-entity', {
          entity: forceBot ? t('label.bot') : t('label.user'),
        })}
      </h6>
      <Form
        form={form}
        id="create-user-bot-form"
        layout="vertical"
        validateMessages={VALIDATION_MESSAGES}
        onFinish={handleSave}>
        <Form.Item
          label={t('label.email')}
          name="email"
          rules={[
            {
              pattern: EMAIL_REG_EX,
              required: true,
              type: 'email',
              message: t('message.field-text-is-invalid', {
                fieldText: t('label.email'),
              }),
            },
            {
              type: 'email',
              required: true,
              validator: async (_, value) => {
                if (EMAIL_REG_EX.test(value) && !forceBot) {
                  const isEmailAlreadyExists = await checkEmailInUse(value);
                  if (isEmailAlreadyExists) {
                    return Promise.reject(
                      t('message.entity-already-exists', {
                        entity: value,
                      })
                    );
                  }

                  return Promise.resolve();
                }
              },
            },
          ]}>
          <Input
            data-testid="email"
            name="email"
            placeholder={t('label.email')}
            value={email}
            onChange={handleOnChange}
          />
        </Form.Item>
        <Form.Item label={t('label.display-name')} name="displayName">
          <Input
            data-testid="displayName"
            name="displayName"
            placeholder={t('label.display-name')}
            value={displayName}
            onChange={handleOnChange}
          />
        </Form.Item>
        {forceBot && (
          <>
            <Form.Item
              label={t('label.auth-mechanism')}
              name="auth-mechanism"
              rules={[
                {
                  required: true,
                  validator: () => {
                    if (!authMechanism) {
                      return Promise.reject(
                        t('label.field-required', {
                          field: t('label.auth-mechanism'),
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
                <Option key={jwtOption.value}>{jwtOption.label}</Option>
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
                          t('label.field-required', {
                            field: t('label.token-expiration'),
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
            {authMechanism === AuthType.Sso && <>{getSSOConfig()}</>}
          </>
        )}
        <Form.Item label={t('label.description')} name="description">
          <RichTextEditor initialValue={description} ref={markdownRef} />
        </Form.Item>

        {!forceBot && (
          <>
            {isAuthProviderBasic && (
              <>
                <Radio.Group
                  name="passwordGenerator"
                  value={passwordGenerator}
                  onChange={handleOnChange}>
                  <Radio value={CreatePasswordGenerator.AutomaticGenerate}>
                    {t('label.automatically-generate')}
                  </Radio>
                  <Radio value={CreatePasswordGenerator.CreatePassword}>
                    {t('label.password-type', {
                      type: t('label.create'),
                    })}
                  </Radio>
                </Radio.Group>

                {passwordGenerator ===
                CreatePasswordGenerator.CreatePassword ? (
                  <div className="m-t-sm">
                    <Form.Item
                      label={t('label.password')}
                      name="password"
                      rules={[
                        {
                          required: true,
                        },
                        {
                          pattern: passwordRegex,
                          message: t('message.password-error-message'),
                        },
                      ]}>
                      <Input.Password
                        autoComplete="off"
                        name="password"
                        placeholder={t('label.password-type', {
                          type: t('label.enter'),
                        })}
                        value={password}
                        onChange={handleOnChange}
                      />
                    </Form.Item>

                    <Form.Item
                      label={t('label.password-type', {
                        type: t('label.confirm'),
                      })}
                      name="confirmPassword"
                      rules={[
                        {
                          validator: (_, value) => {
                            if (value !== password) {
                              return Promise.reject(
                                t('label.password-not-match')
                              );
                            }

                            return Promise.resolve();
                          },
                        },
                      ]}>
                      <Input.Password
                        autoComplete="off"
                        name="confirmPassword"
                        placeholder={t('label.password-type', {
                          type: t('label.confirm'),
                        })}
                        value={confirmPassword}
                        onChange={handleOnChange}
                      />
                    </Form.Item>
                  </div>
                ) : (
                  <div className="m-t-sm">
                    <Form.Item
                      label={t('label.password-type', {
                        type: t('label.generate'),
                      })}
                      name="generatedPassword"
                      rules={[
                        {
                          required: true,
                        },
                      ]}>
                      <Input.Password
                        readOnly
                        addonAfter={
                          <div className="flex-center w-16">
                            <div
                              className="w-8 h-7 flex-center cursor-pointer"
                              data-testid="password-generator"
                              onClick={generateRandomPassword}>
                              {isPasswordGenerating ? (
                                <Loader size="small" type="default" />
                              ) : (
                                <SVGIcons
                                  alt={t('label.generate')}
                                  icon={Icons.SYNC}
                                  width="16"
                                />
                              )}
                            </div>

                            <div className="w-8 h-7 flex-center">
                              <CopyToClipboardButton
                                copyText={generatedPassword}
                              />
                            </div>
                          </div>
                        }
                        autoComplete="off"
                        name="generatedPassword"
                        value={generatedPassword}
                      />
                    </Form.Item>
                  </div>
                )}
              </>
            )}
            <Form.Item label={t('label.team-plural')} name="teams">
              <TeamsSelectable onSelectionChange={setSelectedTeams} />
            </Form.Item>
            <Form.Item label={t('label.role-plural')} name="roles">
              <Select
                data-testid="roles-dropdown"
                disabled={isEmpty(roles)}
                filterOption={(input, option) =>
                  (option?.label ?? '').includes(input)
                }
                mode="multiple"
                options={roleOptions}
                placeholder={t('label.please-select-entity', {
                  entity: t('label.role-plural'),
                })}
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <span> {t('label.admin')}</span>
                <Switch
                  checked={isAdmin}
                  data-testid="admin"
                  onChange={() => {
                    setIsAdmin((prev) => !prev);
                    setIsBot(false);
                  }}
                />
              </Space>
            </Form.Item>
          </>
        )}

        <Space className="w-full tw-justify-end" size={4}>
          <Button data-testid="cancel-user" type="link" onClick={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            data-testid="save-user"
            form="create-user-bot-form"
            htmlType="submit"
            loading={isLoading}
            type="primary">
            {t('label.create')}
          </Button>
        </Space>
      </Form>
    </>
  );
};

export default CreateUser;
