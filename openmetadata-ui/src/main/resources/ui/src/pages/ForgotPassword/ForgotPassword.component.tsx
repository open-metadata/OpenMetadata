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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Card, Col, Divider, Form, Input, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as IconSuccessBadge } from '../../assets/svg/success-badge.svg';
import AlertUnauthenticated from '../../components/AlertBar/AlertUnauthenticated';
import { useBasicAuth } from '../../components/Auth/AuthProviders/BasicAuthProvider';
import BrandImage from '../../components/common/BrandImage/BrandImage';
import { HTTP_STATUS_CODE } from '../../constants/Auth.constants';
import { ROUTES } from '../../constants/constants';
import { useAlertStore } from '../../hooks/useAlertStore';
import { showErrorToast } from '../../utils/ToastUtils';
import './forgot-password.styles.less';

const ForgotPassword = () => {
  const { t } = useTranslation();
  const { handleForgotPassword } = useBasicAuth();
  const { alert, resetAlert } = useAlertStore();
  const history = useHistory();
  const [loading, setLoading] = useState(false);

  const [showResetLinkSentAlert, setShowResetLinkSentAlert] = useState(false);

  const handleSubmit = useCallback(
    async (data: { email: string }) => {
      try {
        setLoading(true);
        await handleForgotPassword?.(data.email);
        setShowResetLinkSentAlert(true);
      } catch (error) {
        showErrorToast(
          (error as AxiosError).response?.status ===
            HTTP_STATUS_CODE.FAILED_DEPENDENCY
            ? t('server.forgot-password-email-error')
            : t('server.email-not-found')
        );

        setShowResetLinkSentAlert(false);
      } finally {
        setLoading(false);
      }
    },
    [setShowResetLinkSentAlert, handleForgotPassword]
  );

  const handleLogin = () => {
    history.push(ROUTES.SIGNIN);
    resetAlert();
  };

  return (
    <div
      className="h-full py-24 forgot-password-container "
      data-testid="forgot-password-container">
      <Card
        bodyStyle={{ padding: '48px' }}
        className="m-auto"
        style={{ maxWidth: '430px' }}>
        <Row gutter={[16, 24]}>
          <Col className="text-center" span={24}>
            <BrandImage className="m-auto" height="auto" width={200} />
          </Col>
          <Col className="flex-center text-center mt-8" span={24}>
            <Typography.Text className="text-xl font-medium text-grey-muted">
              {t('message.enter-your-registered-email')}
            </Typography.Text>
          </Col>

          {alert && <AlertUnauthenticated />}

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
                <Input type="email" />
              </Form.Item>
            </Col>
            <Col className="m-t-md" span={24}>
              <Button block htmlType="submit" loading={loading} type="primary">
                {t('label.submit')}
              </Button>
            </Col>
          </Form>

          {showResetLinkSentAlert && (
            <Col span={24}>
              <div
                className="flex flex-col"
                data-testid="success-screen-container">
                <div className="flex global-border rounded-4 p-sm success-alert">
                  <div className="m-r-xs">
                    <Icon
                      className="align-middle"
                      component={IconSuccessBadge}
                      data-testid="success-icon"
                      style={{ fontSize: '20px' }}
                    />
                  </div>
                  <p data-testid="success-line">
                    <span>{t('message.reset-link-has-been-sent')}</span>
                  </p>
                </div>
              </div>
            </Col>
          )}
          <Divider className="w-min-0 mt-8 mb-12 justify-center items-start p-x-xs">
            <Typography.Text className="text-sm" type="secondary">
              {t('label.or-lowercase')}
            </Typography.Text>
          </Divider>
          <Col span={24}>
            <Button
              ghost
              className="w-full"
              data-testid="go-back-button"
              type="primary"
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
