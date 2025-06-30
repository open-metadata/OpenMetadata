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

import { Button, Card, Col, Form, Input, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import QueryString from 'qs';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AlertBar from '../../components/AlertBar/AlertBar';
import { useBasicAuth } from '../../components/Auth/AuthProviders/BasicAuthProvider';
import BrandImage from '../../components/common/BrandImage/BrandImage';
import DocumentTitle from '../../components/common/DocumentTitle/DocumentTitle';
import { ROUTES, VALIDATION_MESSAGES } from '../../constants/constants';
import { passwordRegex } from '../../constants/regex.constants';
import { PasswordResetRequest } from '../../generated/auth/passwordResetRequest';
import { useAlertStore } from '../../hooks/useAlertStore';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { showErrorToast } from '../../utils/ToastUtils';
import './reset-password.style.less';

interface ResetFormData {
  password: string;
  confirmPassword: string;
}

const ResetPassword = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const location = useCustomLocation();
  const { alert } = useAlertStore();

  const { handleResetPassword } = useBasicAuth();

  const navigate = useNavigate();

  const params = useMemo(() => {
    const search = location.search;
    const data = QueryString.parse(
      search.startsWith('?') ? search.substring(1) : search
    );

    return data as { token: string; user: string };
  }, [location]);

  const password = Form.useWatch('password', form);

  const handleSubmit = async (data: ResetFormData) => {
    const ResetRequest = {
      token: params?.token,
      username: params?.user,
      password: data.password,
      confirmPassword: data.confirmPassword,
    } as PasswordResetRequest;

    try {
      await handleResetPassword(ResetRequest);
      navigate(ROUTES.SIGNIN);
    } catch (err) {
      showErrorToast(err as AxiosError, t('server.unexpected-response'));
    }
  };

  return (
    <div className="h-full p-y-36" data-testid="reset-password-container">
      <DocumentTitle title={t('label.reset-your-password')} />
      <Card
        bodyStyle={{ padding: '48px' }}
        className="m-auto p-x-lg"
        style={{ maxWidth: '450px' }}>
        <Row gutter={[16, 24]}>
          <Col className="text-center" data-testid="brand-image" span={24}>
            <BrandImage className="m-auto" height="auto" width={200} />
          </Col>

          <Col className="mt-12 text-center" span={24}>
            <Typography.Text className="text-xl font-medium text-grey-muted">
              {t('label.reset-your-password')}
            </Typography.Text>
          </Col>

          {alert && (
            <Col className="m-b-lg" span={24}>
              <AlertBar
                defafultExpand
                message={alert?.message}
                type={alert?.type}
              />
            </Col>
          )}

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
                  autoComplete="off"
                  className="w-full"
                  data-testid="password"
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
                  autoComplete="off"
                  className="w-full"
                  data-testid="confirm-password"
                  placeholder={t('label.re-enter-new-password')}
                />
              </Form.Item>

              <Button
                className="w-full m-t-lg"
                data-testid="submit-button"
                htmlType="submit"
                type="primary">
                {t('label.submit')}
              </Button>
            </Form>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default ResetPassword;
