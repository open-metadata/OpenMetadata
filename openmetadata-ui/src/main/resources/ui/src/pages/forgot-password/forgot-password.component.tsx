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

import { Button, Card, Col, Divider, Form, Input, Row, Typography } from 'antd';
import { useBasicAuth } from 'components/authentication/auth-provider/basic-auth.provider';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import './forgot-password.styles.less';

const ForgotPassword = () => {
  const { t } = useTranslation();
  const { handleForgotPassword } = useBasicAuth();
  const history = useHistory();

  const [showResetLinkSentAlert, setShowResetLinkSentAlert] = useState(false);

  const handleSubmit = async (data: { email: string }) => {
    try {
      handleForgotPassword && (await handleForgotPassword(data.email));
      setShowResetLinkSentAlert(true);
    } catch (error) {
      setShowResetLinkSentAlert(false);
    }
  };

  return (
    <div className="h-full py-24 forgot-password-container ">
      <Card
        bodyStyle={{ padding: '48px' }}
        className="m-auto"
        style={{ maxWidth: '430px' }}>
        <Row gutter={[16, 24]}>
          <Col className="text-center" span={24}>
            <SVGIcons alt="OpenMetadata Logo" icon={Icons.LOGO} width="152" />
          </Col>
          <Col className="flex-center text-center mt-8" span={24}>
            <Typography.Text className="text-xl font-medium text-grey-muted">
              {t('message.enter-your-registered-email')}
            </Typography.Text>
          </Col>

          <Form
            className="w-full"
            labelCol={{ span: 24 }}
            onFinish={handleSubmit}>
            <Col span={24}>
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  {
                    required: true,
                    type: 'email',
                    message: 'Email is invalid',
                  },
                ]}>
                <Input type="email" />
              </Form.Item>
            </Col>
            <Col className="m-t-md" span={24}>
              <Button className="w-full" htmlType="submit" type="primary">
                {t('label.submit')}
              </Button>
            </Col>
          </Form>

          {showResetLinkSentAlert && (
            <Col span={24}>
              <div
                className="flex flex-col"
                data-testid="success-screen-container">
                <div className="flex border-1 border-main rounded-4 p-sm success-alert">
                  <div className="m-r-xs">
                    <SVGIcons
                      alt="success"
                      className="w-5"
                      data-testid="success-icon"
                      icon={Icons.SUCCESS_BADGE}
                    />
                  </div>
                  <p data-testid="success-line">
                    <span>{t('message.reset-link-has-been-sent')}</span>
                  </p>
                </div>
              </div>
            </Col>
          )}
          <Divider className="w-min-0 mt-8 mb-12 justify-center align-start p-x-xs">
            <Typography.Text className="text-sm" type="secondary">
              {t('label.or-lowercase')}
            </Typography.Text>
          </Divider>
          <Col span={24}>
            <Button
              ghost
              className="w-full"
              type="primary"
              onClick={() => history.push(ROUTES.SIGNIN)}>
              {t('message.go-back-to-login-page')}
            </Button>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default ForgotPassword;
