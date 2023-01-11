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

import { Button, Col, Divider, Form, Input, Row, Typography } from 'antd';
import { useAuthContext } from 'components/authentication/auth-provider/AuthProvider';
import { useBasicAuth } from 'components/authentication/auth-provider/basic-auth.provider';
import { isEmpty } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import loginBG from '../../assets/img/login-bg.png';
import { ROUTES } from '../../constants/constants';
import { passwordErrorMessage } from '../../constants/ErrorMessages.constant';
import { passwordRegex } from '../../constants/regex.constants';
import { AuthTypes } from '../../enums/signin.enum';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import LoginCarousel from '../login/LoginCarousel';
import './../login/login.style.less';

interface SignUpFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

const BasicSignUp = () => {
  const { t } = useTranslation();
  const { authConfig } = useAuthContext();
  const { handleRegister } = useBasicAuth();
  const history = useHistory();

  const [form] = Form.useForm();
  const password = Form.useWatch('password', form);

  const { isAuthProviderBasic } = useMemo(() => {
    return {
      isAuthProviderBasic:
        authConfig?.provider === AuthTypes.BASIC ||
        authConfig?.provider === AuthTypes.LDAP,
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

  const handleLogin = () => history.push(ROUTES.SIGNIN);

  const validationMessages = {
    required: '${label} is required',
    types: {
      email: '${label} is not valid',
    },
    whitespace: '${label} should not contain white space',
  };

  return (
    <div className="d-flex flex-col h-full">
      <div className="d-flex bg-body-main flex-grow" data-testid="signin-page">
        <div className="w-5/12">
          <div className="mt-4 text-center flex-center flex-col">
            <SVGIcons alt="OpenMetadata Logo" icon={Icons.LOGO} width="152" />
            <Typography.Text className="mt-8 w-80 text-xl font-medium text-grey-muted">
              {t('message.om-description')}
            </Typography.Text>

            {isAuthProviderBasic ? (
              <div style={{ width: '334px' }}>
                <Row>
                  <Col span={24}>
                    <>
                      <Form
                        autoComplete="off"
                        className="mt-20"
                        form={form}
                        layout="vertical"
                        validateMessages={validationMessages}
                        onFinish={handleSubmit}>
                        <Form.Item
                          label="First Name"
                          name="firstName"
                          rules={[{ whitespace: true, required: true }]}>
                          <Input placeholder="Enter first name" />
                        </Form.Item>
                        <Form.Item
                          label="Last Name"
                          name="lastName"
                          rules={[{ whitespace: true, required: true }]}>
                          <Input placeholder="Enter last name" />
                        </Form.Item>
                        <Form.Item
                          label="Email"
                          name="email"
                          rules={[{ type: 'email', required: true }]}>
                          <Input placeholder="Enter email" />
                        </Form.Item>
                        <Form.Item
                          label="Password"
                          name="password"
                          rules={[
                            {
                              required: true,
                            },
                            {
                              pattern: passwordRegex,
                              message: passwordErrorMessage,
                            },
                          ]}>
                          <Input.Password placeholder="Enter password" />
                        </Form.Item>
                        <Form.Item
                          label="Confirm Password"
                          name="confirmPassword"
                          rules={[
                            {
                              validator: (_, value) => {
                                if (isEmpty(password)) {
                                  return Promise.reject(
                                    'Please type password first'
                                  );
                                }
                                if (value !== password) {
                                  return Promise.reject(
                                    "Password doesn't match"
                                  );
                                }

                                return Promise.resolve();
                              },
                            },
                          ]}>
                          <Input.Password placeholder="Confirm your password" />
                        </Form.Item>

                        <Button
                          className="w-full"
                          htmlType="submit"
                          type="primary">
                          {t('label.create-entity', {
                            entity: t('label.account'),
                          })}
                        </Button>

                        <Divider className="w-min-0  mt-8 mb-12 justify-center">
                          <Typography.Text type="secondary">
                            {t('label.or-lowercase')}
                          </Typography.Text>
                        </Divider>

                        <div className="mt-4 d-flex flex-center">
                          <Typography.Text className="mr-4">
                            {t('message.already-a-user')}
                          </Typography.Text>
                          <Button
                            ghost
                            data-testid="login"
                            type="link"
                            onClick={handleLogin}>
                            {t('label.login')}
                          </Button>
                        </div>
                      </Form>
                    </>
                  </Col>
                </Row>
              </div>
            ) : null}
          </div>
        </div>
        <div className="w-7/12 relative">
          <div className="absolute inset-0">
            <img
              alt="bg-image"
              className="w-full h-full"
              data-testid="bg-image"
              src={loginBG}
            />
          </div>
          <div className="relative">
            <div className="d-flex justify-center mt-44 mb-10">
              <LoginCarousel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BasicSignUp;
