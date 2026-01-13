/*
 *  Copyright 2024 Collate.
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
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import bgImg from '../../assets/img/forgot-password.png';
import AlertBar from '../../components/AlertBar/AlertBar';
import { useBasicAuth } from '../../components/Auth/AuthProviders/BasicAuthProvider';
import BrandImage from '../../components/common/BrandImage/BrandImage';
import DocumentTitle from '../../components/common/DocumentTitle/DocumentTitle';
import { HTTP_STATUS_CODE } from '../../constants/Auth.constants';
import { ROUTES } from '../../constants/constants';
import { useAlertStore } from '../../hooks/useAlertStore';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './forgot-password.styles.less';

const ForgotPassword = () => {
  const { t } = useTranslation();
  const { handleForgotPassword } = useBasicAuth();
  const { alert, resetAlert } = useAlertStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (data: { email: string }) => {
      try {
        setLoading(true);
        await handleForgotPassword?.(data.email);
        showSuccessToast(t('message.reset-link-has-been-sent'));
      } catch (error) {
        showErrorToast(
          (error as AxiosError).response?.status ===
            HTTP_STATUS_CODE.FAILED_DEPENDENCY
            ? t('server.forgot-password-email-error')
            : t('server.email-not-found')
        );
      } finally {
        setLoading(false);
      }
    },
    [handleForgotPassword]
  );

  const handleLogin = () => {
    navigate(ROUTES.SIGNIN);
    resetAlert();
  };

  return (
    <div
      className="h-full py-24 forgot-password-container "
      data-testid="forgot-password-container">
      <div className="absolute inset-0">
        <img
          alt="bg-image"
          className="w-full h-full"
          data-testid="bg-image"
          src={bgImg}
        />
      </div>
      <DocumentTitle title={t('label.forgot-password')} />
      <Card
        bodyStyle={{ padding: '48px' }}
        className="m-auto"
        style={{ maxWidth: '512px' }}>
        <Row gutter={[16, 24]}>
          <Col className="text-center" span={24}>
            <BrandImage
              isMonoGram
              className="m-auto"
              height="auto"
              width={50}
            />
          </Col>
          <Col className="text-center mt-4" span={24}>
            <Typography.Title level={3}>
              {t('label.forgot-your-password')}
            </Typography.Title>
            <Typography.Text className="text-md text-grey-muted">
              {t('message.enter-your-registered-email')}
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

          <Form
            className="w-full"
            labelCol={{ span: 24 }}
            onFinish={handleSubmit}>
            <Col span={24}>
              <Form.Item
                label={t('label.email')}
                name="email"
                rules={[
                  {
                    required: true,
                    type: 'email',
                    message: t('label.field-invalid', {
                      field: t('label.email'),
                    }),
                  },
                ]}>
                <Input
                  className="input-field"
                  placeholder={t('label.email')}
                  type="email"
                />
              </Form.Item>
            </Col>
            <Col className="m-t-md" span={24}>
              <Button
                block
                htmlType="submit"
                loading={loading}
                size="large"
                type="primary">
                {t('label.send-login-link')}
              </Button>
            </Col>
          </Form>
          <Col className="d-flex flex-center" span={24}>
            <Button
              className="p-0"
              data-testid="go-back-button"
              type="link"
              onClick={handleLogin}>
              {t('message.go-back-to-login-page')}
            </Button>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default ForgotPassword;
