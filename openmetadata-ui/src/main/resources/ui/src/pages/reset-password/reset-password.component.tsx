import { Alert, Button, Col, Form, Input, Row, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { useMemo } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useBasicAuth } from '../../authentication/auth-provider/basic-auth.provider';
import AuthCommonCard from '../../components/common/auth-common-card/auth-common-card.component';
import { ROUTES } from '../../constants/constants';
import { PasswordResetRequest } from '../../generated/auth/passwordResetRequest';
import './reset-password.style.less';
import { getUserNameAndToken } from './reset-password.utils';

interface ResetFormData {
  password: string;
  confirmPassword: string;
}

const ResetPassword = () => {
  const [form] = Form.useForm();
  const location = useLocation();

  const { handleResetPassword, isResetTokenExpired } = useBasicAuth();

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

  const validationMessages = {
    required: '${label} is required',
    types: {
      email: '${label} is not valid',
    },
    whitespace: '${label} should not contain white space',
  };

  const handleReVerify = () => history.push(ROUTES.FORGOT_PASSWORD);

  return isResetTokenExpired ? (
    <AuthCommonCard classNames="">
      <>
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
      </>
    </AuthCommonCard>
  ) : (
    <AuthCommonCard classNames="">
      <Row gutter={[16, 18]}>
        <Col className="mt-12 reset-password-text" span={24}>
          <Typography.Text strong>Reset Password</Typography.Text>
        </Col>

        <Col span={24}>
          <Form
            className="w-full"
            form={form}
            layout="vertical"
            validateMessages={validationMessages}
            onFinish={handleSubmit}>
            <Form.Item
              label="New Password"
              name="password"
              rules={[
                {
                  validator: (_, value) => {
                    if (value < 8) {
                      return Promise.reject(
                        'Password must be of minimum 8 and maximum 16 characters, with one special , one upper, one lower case character'
                      );
                    }

                    return Promise.resolve();
                  },
                },
              ]}>
              <Input
                className="w-full"
                placeholder="Enter new password"
                type="password"
              />
            </Form.Item>
            <Form.Item
              label="Confirm New Password"
              name="confirmPassword"
              rules={[
                {
                  validator: (_, value) => {
                    if (isEmpty(password)) {
                      return Promise.reject('Please type password first');
                    }
                    if (value !== password) {
                      return Promise.reject("Password doesn't match");
                    }

                    return Promise.resolve();
                  },
                },
              ]}>
              <Input
                className="w-full"
                placeholder="Re-enter New Password"
                type="password"
              />
            </Form.Item>

            <Button className="w-full" htmlType="submit" type="primary">
              Submit
            </Button>
          </Form>
        </Col>
      </Row>
    </AuthCommonCard>
  );
};

export default ResetPassword;
