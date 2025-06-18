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

import { Button, Form, Input, Typography } from 'antd';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AlertBar from '../../components/AlertBar/AlertBar';
import { useBasicAuth } from '../../components/Auth/AuthProviders/BasicAuthProvider';
import BrandImage from '../../components/common/BrandImage/BrandImage';
import { CarouselLayout } from '../../components/Layout/CarouselLayout/CarouselLayout';
import { ROUTES, VALIDATION_MESSAGES } from '../../constants/constants';
import { passwordRegex } from '../../constants/regex.constants';
import { AuthProvider } from '../../generated/settings/settings';
import { useAlertStore } from '../../hooks/useAlertStore';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import brandClassBase from '../../utils/BrandData/BrandClassBase';
import './../LoginPage/login.style.less';

interface SignUpFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

const BasicSignUp = () => {
  const { t } = useTranslation();
  const { authConfig } = useApplicationStore();
  const { handleRegister } = useBasicAuth();
  const { alert, resetAlert } = useAlertStore();
  const navigate = useNavigate();

  const [form] = Form.useForm();
  const password = Form.useWatch('password', form);

  const brandName = brandClassBase.getPageTitle();

  const { isAuthProviderBasic } = useMemo(() => {
    return {
      isAuthProviderBasic:
        authConfig?.provider === AuthProvider.Basic ||
        authConfig?.provider === AuthProvider.LDAP,
    };
  }, [authConfig]);

  const handleSubmit = async (data: SignUpFormData) => {
    if (data.confirmPassword) {
      delete data['confirmPassword'];
    }

    const request = data;

    if (request) {
      handleRegister(request);
    }
  };

  const handleLogin = () => {
    navigate(ROUTES.SIGNIN);
    resetAlert();
  };

  return (
    <CarouselLayout
      carouselClassName="signup-page"
      pageTitle={t('label.sign-up')}>
      <div
        className="login-form-container signup-page"
        data-testid="signin-page">
        <div className="login-box">
          <BrandImage isMonoGram height="auto" width={50} />
          <Typography.Title className="header-text display-sm" level={3}>
            {t('label.welcome-to')} {brandName}
          </Typography.Title>

          {alert && (
            <div className="login-alert">
              <AlertBar
                defafultExpand
                message={alert?.message}
                type={alert?.type}
              />
            </div>
          )}

          {isAuthProviderBasic ? (
            <div className="login-form">
              <Form
                autoComplete="off"
                form={form}
                layout="vertical"
                validateMessages={VALIDATION_MESSAGES}
                onFinish={handleSubmit}>
                <Form.Item
                  label={t('label.entity-name', {
                    entity: t('label.first'),
                  })}
                  name="firstName"
                  rules={[{ whitespace: true, required: true }]}>
                  <Input
                    autoFocus
                    className="input-field"
                    placeholder={t('label.enter-entity-name', {
                      entity: t('label.first-lowercase'),
                    })}
                  />
                </Form.Item>
                <Form.Item
                  label={t('label.entity-name', {
                    entity: t('label.last'),
                  })}
                  name="lastName"
                  rules={[{ whitespace: true, required: true }]}>
                  <Input
                    className="input-field"
                    placeholder={t('label.enter-entity', {
                      entity: t('label.last-name-lowercase'),
                    })}
                  />
                </Form.Item>
                <Form.Item
                  label={t('label.email')}
                  name="email"
                  rules={[{ type: 'email', required: true }]}>
                  <Input
                    className="input-field"
                    placeholder={t('label.enter-entity', {
                      entity: t('label.email-lowercase'),
                    })}
                  />
                </Form.Item>
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
                    className="input-field"
                    placeholder={t('label.enter-entity', {
                      entity: t('label.password-lowercase'),
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
                        if (isEmpty(password)) {
                          return Promise.reject({
                            message: t('label.please-password-type-first'),
                          });
                        }
                        if (value !== password) {
                          return Promise.reject({
                            message: t('label.password-not-match'),
                          });
                        }

                        return Promise.resolve();
                      },
                    },
                  ]}>
                  <Input.Password
                    autoComplete="off"
                    className="input-field"
                    placeholder={t('label.confirm-password')}
                  />
                </Form.Item>

                <Button
                  block
                  className="login-btn"
                  htmlType="submit"
                  size="large"
                  type="primary">
                  {t('label.create-entity', {
                    entity: t('label.account'),
                  })}
                </Button>

                <div className="mt-4 d-flex flex-center signup-text">
                  <Typography.Text>
                    {t('message.already-a-user')}
                  </Typography.Text>
                  <Button
                    ghost
                    className="link-btn"
                    data-testid="login"
                    type="link"
                    onClick={handleLogin}>
                    {t('label.login')}
                  </Button>
                </div>
              </Form>
            </div>
          ) : null}
        </div>
      </div>
    </CarouselLayout>
  );
};

export default BasicSignUp;
