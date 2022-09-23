/*
 *  Copyright 2021 Collate
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
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useBasicAuth } from '../../authentication/auth-provider/basic-auth.provider';
import { ROUTES } from '../../constants/constants';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import './forgot-password.styles.less';

const ForgotPassword = () => {
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
    <div className="h-full tw-py-36">
      <Card
        bodyStyle={{ padding: '48px' }}
        className="m-auto p-x-lg"
        style={{ maxWidth: '450px' }}>
        <Row gutter={[16, 24]}>
          <Col className="text-center" span={24}>
            <SVGIcons alt="OpenMetadata Logo" icon={Icons.LOGO} width="152" />
          </Col>
          <Col className="flex-center text-center mt-8" span={24}>
            <Typography.Text strong>
              Enter your registered email to receive password reset link
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
                Submit
              </Button>
            </Col>
          </Form>

          {showResetLinkSentAlert && (
            <Col span={24}>
              <div
                className="tw-flex tw-flex-col tw-px-1"
                data-testid="success-screen-container">
                <div className="tw-flex tw-border tw-border-main tw-rounded tw-shadow tw-p-3">
                  <div className="tw-mr-2">
                    <SVGIcons
                      alt="success"
                      className="tw-w-5"
                      data-testid="success-icon"
                      icon={Icons.SUCCESS_BADGE}
                    />
                  </div>
                  <p data-testid="success-line">
                    <span>
                      <span>Reset link has been sent to your email</span>
                    </span>
                  </p>
                </div>
              </div>
            </Col>
          )}
          <Col className="m-t-md" span={24}>
            <Button
              ghost
              className="w-full"
              type="primary"
              onClick={() => history.push(ROUTES.SIGNIN)}>
              Go back to Login page
            </Button>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default ForgotPassword;
