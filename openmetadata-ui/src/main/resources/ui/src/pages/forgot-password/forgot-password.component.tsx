import { Button, Card, Col, Form, Input, Row, Typography } from 'antd';
import React, { useState } from 'react';
import { useBasicAuth } from '../../authentication/auth-provider/basic-auth.provider';
import { ROUTES } from '../../constants/constants';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import './forgot-password.styles.less';

const ForgotPassword = () => {
  const { isPasswordResetLinkSent, handleForgotPassword } = useBasicAuth();
  const [hasError, setHasError] = useState(false);
  const handleSubmit = (data: { email: string }) => {
    handleForgotPassword && handleForgotPassword(data.email);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onError = (errors: any) => {
    setHasError(errors.email);
  };

  return (
    <div className="h-full tw-py-36">
      <Card
        bodyStyle={{ padding: '48px' }}
        className=" m-y-lg m-auto p-x-lg"
        style={{ maxWidth: '450px' }}>
        <Row gutter={[16, 24]}>
          <Col className="text-center" span={24}>
            <SVGIcons alt="OpenMetadata Logo" icon={Icons.LOGO} width="152" />
          </Col>
          <Col className="flex-center text-center mt-8" span={24}>
            <Typography.Text strong className="text-reset-info">
              Enter your registered email to receive password reset link
            </Typography.Text>
          </Col>

          <Form
            className="w-full"
            labelCol={{ span: 24 }}
            onFinish={handleSubmit}
            onFinishFailed={onError}>
            <Col span={24}>
              <Form.Item
                hasFeedback={hasError}
                label="Email"
                name="email"
                rules={[
                  {
                    required: true,
                    message: 'Email is required!',
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

          {isPasswordResetLinkSent && (
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
              href={ROUTES.SIGNIN}
              type="primary">
              Go back to Login page
            </Button>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default ForgotPassword;
