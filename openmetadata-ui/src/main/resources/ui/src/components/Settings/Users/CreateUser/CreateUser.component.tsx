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

import { PlusOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons/lib/components/Icon';
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
import { compact, isEmpty, isUndefined, map, trim } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { ReactComponent as IconSync } from '../../../../assets/svg/ic-sync.svg';
import { VALIDATION_MESSAGES } from '../../../../constants/constants';
import {
  EMAIL_REG_EX,
  passwordRegex,
} from '../../../../constants/regex.constants';
import { EntityType } from '../../../../enums/entity.enum';
import { CreatePasswordGenerator } from '../../../../enums/user.enum';
import {
  AuthType,
  CreatePasswordType,
  CreateUser as CreateUserSchema,
} from '../../../../generated/api/teams/createUser';
import { EntityReference } from '../../../../generated/entity/type';
import { AuthProvider } from '../../../../generated/settings/settings';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useDomainStore } from '../../../../hooks/useDomainStore';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../../interface/FormUtils.interface';
import { generateRandomPwd } from '../../../../rest/auth-API';
import { getJWTTokenExpiryOptions } from '../../../../utils/BotsUtils';
import { handleSearchFilterOption } from '../../../../utils/CommonUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import { getField } from '../../../../utils/formUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import CopyToClipboardButton from '../../../common/CopyToClipboardButton/CopyToClipboardButton';
import { DomainLabel } from '../../../common/DomainLabel/DomainLabel.component';
import InlineAlert from '../../../common/InlineAlert/InlineAlert';
import Loader from '../../../common/Loader/Loader';
import TeamsSelectable from '../../Team/TeamsSelectable/TeamsSelectable';
import { CreateUserProps } from './CreateUser.interface';

const { Option } = Select;

const CreateUser = ({
  roles,
  isLoading,
  onCancel,
  onSave,
  forceBot,
}: CreateUserProps) => {
  const {
    state,
  }: {
    state?: { isAdminPage: boolean };
  } = useLocation();
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const isAdminPage = Boolean(state?.isAdminPage);
  const { authConfig, inlineAlertDetails } = useApplicationStore();
  const [isAdmin, setIsAdmin] = useState(isAdminPage);
  const [isBot, setIsBot] = useState(forceBot);
  const [selectedTeams, setSelectedTeams] = useState<
    Array<EntityReference | undefined>
  >([]);
  const [isPasswordGenerating, setIsPasswordGenerating] = useState(false);
  const { activeDomainEntityRef } = useDomainStore();
  const selectedDomain =
    Form.useWatch<EntityReference[]>('domains', form) ?? [];

  const domainsField: FieldProp = {
    name: 'domains',
    id: 'root/domains',
    required: false,
    label: t('label.domain'),
    type: FieldTypes.DOMAIN_SELECT,
    props: {
      selectedDomain: activeDomainEntityRef
        ? [activeDomainEntityRef]
        : undefined,
      multiple: true,
      children: (
        <Button
          data-testid="add-domain"
          icon={<PlusOutlined style={{ color: 'white', fontSize: '12px' }} />}
          size="small"
          type="primary"
        />
      ),
    },
    formItemLayout: FormItemLayout.HORIZONTAL,
    formItemProps: {
      valuePropName: 'selectedDomain',
      trigger: 'onUpdate',
      initialValue: activeDomainEntityRef ? [activeDomainEntityRef] : undefined,
    },
  };

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
      domains: selectedDomain.map((domain) => domain.fullyQualifiedName ?? ''),
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

  const descriptionField: FieldProp = useMemo(
    () => ({
      name: 'description',
      required: false,
      label: t('label.description'),
      id: 'root/description',
      type: FieldTypes.DESCRIPTION,
      props: {
        'data-testid': 'description',
        initialValue: '',
      },
    }),
    []
  );

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

      {getField(descriptionField)}

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
                              <Icon
                                className="align-middle"
                                component={IconSync}
                                style={{ fontSize: '16px' }}
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
          {!isAdminPage && (
            <>
              <Form.Item label={t('label.team-plural')} name="teams">
                <TeamsSelectable onSelectionChange={setSelectedTeams} />
              </Form.Item>
              <Form.Item label={t('label.role-plural')} name="roles">
                <Select
                  data-testid="roles-dropdown"
                  disabled={isEmpty(roles)}
                  filterOption={handleSearchFilterOption}
                  getPopupContainer={(triggerNode) => triggerNode.parentElement}
                  mode="multiple"
                  options={roleOptions}
                  placeholder={t('label.please-select-entity', {
                    entity: t('label.role-plural'),
                  })}
                />
              </Form.Item>
            </>
          )}

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

      {!isBot && (
        <div className="m-t-xs">
          {getField(domainsField)}
          {selectedDomain && selectedDomain.length > 0 && (
            <DomainLabel
              multiple
              domain={selectedDomain}
              entityFqn=""
              entityId=""
              entityType={EntityType.USER}
              hasPermission={false}
            />
          )}
        </div>
      )}
      {!isUndefined(inlineAlertDetails) && (
        <InlineAlert alertClassName="m-b-xs" {...inlineAlertDetails} />
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
