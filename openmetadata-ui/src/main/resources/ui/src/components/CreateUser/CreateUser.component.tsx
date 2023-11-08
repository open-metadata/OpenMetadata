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
  FormProps,
  Input,
  Radio,
  Select,
  Space,
  Switch,
} from 'antd';
import { AxiosError } from 'axios';
import { compact, isEmpty, map, trim } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VALIDATION_MESSAGES } from '../../constants/constants';
import { EMAIL_REG_EX, passwordRegex } from '../../constants/regex.constants';
import { CreatePasswordGenerator } from '../../enums/user.enum';
import {
  AuthType,
  CreatePasswordType,
  CreateUser as CreateUserSchema,
} from '../../generated/api/teams/createUser';
import { EntityReference } from '../../generated/entity/type';
import { AuthProvider } from '../../generated/settings/settings';
import { checkEmailInUse, generateRandomPwd } from '../../rest/auth-API';
import { getJWTTokenExpiryOptions } from '../../utils/BotsUtils';
import { handleSearchFilterOption } from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useAuthContext } from '../authentication/auth-provider/AuthProvider';
import CopyToClipboardButton from '../buttons/CopyToClipboardButton/CopyToClipboardButton';
import RichTextEditor from '../common/rich-text-editor/RichTextEditor';
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBot, setIsBot] = useState(forceBot);
  const [selectedTeams, setSelectedTeams] = useState<
    Array<EntityReference | undefined>
  >([]);
  const [isPasswordGenerating, setIsPasswordGenerating] = useState(false);

  const isAuthProviderBasic = useMemo(
    () =>
      authConfig?.provider === AuthProvider.Basic ||
      authConfig?.provider === AuthProvider.LDAP,
    [authConfig]
  );

  const selectedRoles = Form.useWatch('roles', form);

  const roleOptions = useMemo(() => {
    return map(roles, (role) => ({
      label: getEntityName(role),
      value: role.id,
    }));
  }, [roles]);

  const generatedPassword = Form.useWatch('generatedPassword', form);
  const passwordGenerator = Form.useWatch('passwordGenerator', form);
  const password = Form.useWatch('password', form);

  const generateRandomPassword = async () => {
    setIsPasswordGenerating(true);
    try {
      const password = await generateRandomPwd();
      setTimeout(() => {
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
  const handleSave: FormProps['onFinish'] = (values) => {
    const isPasswordGenerated =
      passwordGenerator === CreatePasswordGenerator.AutomaticGenerate;
    const validTeam = compact(selectedTeams).map((team) => team.id);

    const { email, displayName, tokenExpiry, confirmPassword, description } =
      values;

    const userProfile: CreateUserSchema = {
      description,
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
              authType: AuthType.Jwt,
              config: {
                JWTTokenExpiry: tokenExpiry,
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

  useEffect(() => {
    generateRandomPassword();
  }, []);

  return (
    <Form
      form={form}
      id="create-user-bot-form"
      initialValues={{
        passwordGenerator: CreatePasswordGenerator.AutomaticGenerate,
      }}
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
        />
      </Form.Item>
      <Form.Item label={t('label.display-name')} name="displayName">
        <Input
          data-testid="displayName"
          name="displayName"
          placeholder={t('label.display-name')}
        />
      </Form.Item>
      {forceBot && (
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
      )}
      <Form.Item
        label={t('label.description')}
        name="description"
        trigger="onTextChange"
        valuePropName="initialValue">
        <RichTextEditor />
      </Form.Item>

      {!forceBot && (
        <>
          {isAuthProviderBasic && (
            <>
              <Form.Item name="passwordGenerator">
                <Radio.Group>
                  <Radio value={CreatePasswordGenerator.AutomaticGenerate}>
                    {t('label.automatically-generate')}
                  </Radio>
                  <Radio value={CreatePasswordGenerator.CreatePassword}>
                    {t('label.password-type', {
                      type: t('label.create'),
                    })}
                  </Radio>
                </Radio.Group>
              </Form.Item>

              {passwordGenerator === CreatePasswordGenerator.CreatePassword ? (
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
              filterOption={handleSearchFilterOption}
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

      <Space className="w-full justify-end" size={4}>
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
  );
};

export default CreateUser;
