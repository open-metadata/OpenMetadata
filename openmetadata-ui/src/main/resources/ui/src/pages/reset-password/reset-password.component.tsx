import { Alert, Button, Card, Col, Form, Input, Row, Typography } from 'antd';
import React, { useEffect, useMemo } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useBasicAuth } from '../../authentication/auth-provider/basic-auth.provider';
import { VALIDATION_MESSAGES } from '../../constants/auth.constants';
import { ROUTES } from '../../constants/constants';
import { passwordRegex } from '../../constants/regex.constants';
import { PasswordResetRequest } from '../../generated/auth/passwordResetRequest';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import './reset-password.style.less';
import { getUserNameAndToken } from './reset-password.utils';

interface ResetFormData {
  password: string;
  confirmPassword: string;
}

const ResetPassword = () => {
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

  const handleSubmit = (data: ResetFormData) => {
    const ResetRequest = {
      token: params?.token,
      username: params?.userName,
      password: data.password,
      confirmPassword: data.confirmPassword,
    } as PasswordResetRequest;

    handleResetPassword(ResetRequest);
  };

  const handleReVerify = () => history.push(ROUTES.FORGOT_PASSWORD);

  return (
    <div className="h-full tw-py-36">
      {tokenValid ? (
        <Card
          bodyStyle={{ padding: '48px' }}
          className="m-auto p-x-lg"
          style={{ maxWidth: '450px' }}>
          <div className="mt-24">
            <Alert
              showIcon
              description="Please re-initiate email verification process"
              message="Email Verification Token Expired"
              type="error"
            />
          </div>

          <div className="mt-20 flex-center">
            <Typography.Link underline onClick={handleReVerify}>
              Re verify
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
              <Typography.Title level={5}>Reset your Password</Typography.Title>
            </Col>

            <Col span={24}>
              <Form
                className="w-full"
                form={form}
                layout="vertical"
                validateMessages={VALIDATION_MESSAGES}
                onFinish={handleSubmit}>
                <Form.Item
                  label="New Password"
                  name="password"
                  rules={[
                    {
                      required: true,
                      message: 'Password is required',
                    },
                    {
                      pattern: passwordRegex,
                      message:
                        'Password must be of minimum 8 and maximum 16 characters, with one special , one upper, one lower case character',
                    },
                  ]}>
                  <Input.Password
                    className="w-full"
                    placeholder="Enter new password"
                  />
                </Form.Item>
                <Form.Item
                  label="Confirm New Password"
                  name="confirmPassword"
                  rules={[
                    {
                      required: true,
                      message: 'Confirm password is required',
                    },
                    {
                      validator: (_, value) => {
                        if (password === value) {
                          return Promise.resolve();
                        }

                        return Promise.reject("Password doesn't match");
                      },
                    },
                  ]}>
                  <Input.Password
                    className="w-full"
                    placeholder="Re-enter New Password"
                  />
                </Form.Item>

                <Button
                  className="w-full m-t-lg"
                  htmlType="submit"
                  type="primary">
                  Submit
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
