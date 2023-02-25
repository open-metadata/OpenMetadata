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

import { Alert, Button, Card, Col, Form, Input, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useBasicAuth } from 'components/authentication/auth-provider/basic-auth.provider';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { VALIDATION_MESSAGES } from '../../constants/auth.constants';
import { ROUTES } from '../../constants/constants';
import { passwordRegex } from '../../constants/regex.constants';
import { PasswordResetRequest } from '../../generated/auth/passwordResetRequest';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './reset-password.style.less';
import { getUserNameAndToken } from './reset-password.utils';

interface ResetFormData {
  password: string;
  confirmPassword: string;
}

const ResetPassword = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const location = useLocation();

  const { handleResetPassword } = useBasicAuth();
  const tokenValid = false;
  useEffect(() => {
    // check for token validity
  }, []);

  const history = useHistory();

  const params = useMemo(
    () => getUserNameAndToken(location.search),
    [location]
  );

  const password = Form.useWatch('password', form);

  const handleSubmit = async (data: ResetFormData) => {
    const ResetRequest = {
      token: params?.token,
      username: params?.userName,
      password: data.password,
      confirmPassword: data.confirmPassword,
    } as PasswordResetRequest;

    try {
      await handleResetPassword(ResetRequest);
      history.push(ROUTES.SIGNIN);
    } catch (err) {
      showErrorToast(err as AxiosError, t('server.unexpected-response'));
    }
  };

  const handleReVerify = () => history.push(ROUTES.FORGOT_PASSWORD);

  return (
    <div className="h-full p-y-36">
      {tokenValid ? (
        <Card
          bodyStyle={{ padding: '48px' }}
          className="m-auto p-x-lg"
          style={{ maxWidth: '450px' }}>
          <div className="mt-24">
            <Alert
              showIcon
              description="Please re-initiate email verification process"
              message={t('message.email-verification-token-expired')}
              type="error"
            />
          </div>

          <div className="mt-20 flex-center">
            <Typography.Link underline onClick={handleReVerify}>
              {t('label.re-verify')}
            </Typography.Link>
          </div>
        </Card>
      ) : (
        <Card
          bodyStyle={{ padding: '48px' }}
          className="m-auto p-x-lg"
          style={{ maxWidth: '450px' }}>
          <Row gutter={[16, 24]}>
            <Col className="text-center" span={24}>
              <SVGIcons alt="OpenMetadata Logo" icon={Icons.LOGO} width="152" />
            </Col>

            <Col className="mt-12 text-center" span={24}>
              <Typography.Text className="text-xl font-medium text-grey-muted">
                {t('label.reset-your-password')}
              </Typography.Text>
            </Col>

            <Col span={24}>
              <Form
                className="w-full"
                form={form}
                layout="vertical"
                validateMessages={VALIDATION_MESSAGES}
                onFinish={handleSubmit}>
                <Form.Item
                  label={t('label.new-password')}
                  name="password"
                  rules={[
                    {
                      required: true,
                      message: t('message.field-text-is-required', {
                        fieldText: t('label.password'),
                      }),
                    },
                    {
                      pattern: passwordRegex,
                      message: t('message.password-pattern-error'),
                    },
                  ]}>
                  <Input.Password
                    className="w-full"
                    placeholder={t('label.enter-entity', {
                      entity: t('label.new-password'),
                    })}
                  />
                </Form.Item>
                <Form.Item
                  label={t('label.confirm-new-password')}
                  name="confirmPassword"
                  rules={[
                    {
                      required: true,
                      message: t('message.field-text-is-required', {
                        fieldText: t('label.confirm-new-password'),
                      }),
                    },
                    {
                      validator: (_, value) => {
                        if (password === value) {
                          return Promise.resolve();
                        }

                        return Promise.reject(t('label.password-not-match'));
                      },
                    },
                  ]}>
                  <Input.Password
                    className="w-full"
                    placeholder={t('label.re-enter-new-password')}
                  />
                </Form.Item>

                <Button
                  className="w-full m-t-lg"
                  htmlType="submit"
                  type="primary">
                  {t('label.submit')}
                </Button>
              </Form>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
};

export default ResetPassword;
