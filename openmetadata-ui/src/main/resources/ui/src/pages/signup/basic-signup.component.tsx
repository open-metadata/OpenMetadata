import { Button, Divider, Form, Input, Space, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { useBasicAuth } from '../../authentication/auth-provider/basic-auth.provider';
import AuthCommonCard from '../../components/common/auth-common-card/auth-common-card.component';
import { ROUTES } from '../../constants/constants';
import { AuthTypes } from '../../enums/signin.enum';

interface SignUpFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

const BasicSignUp = () => {
  const { authConfig } = useAuthContext();
  const { handleRegister } = useBasicAuth();
  const history = useHistory();

  const [form] = Form.useForm();
  const password = Form.useWatch('password', form);

  const { isAuthProviderBasic } = useMemo(() => {
    return {
      isAuthProviderBasic: authConfig?.provider === AuthTypes.BASIC,
    };
  }, [authConfig]);

  const handleSubmit = async (data: SignUpFormData) => {
    if (data.confirmPassword) delete data['confirmPassword'];

    const request = data;

    if (request) handleRegister(request);
  };

  const handleLogin = () => history.push(ROUTES.SIGNIN);

  const validationMessages = {
    required: '${label} is required',
    types: {
      email: '${label} is not valid',
    },
    whitespace: '${label} should not contain white space',
  };

  return isAuthProviderBasic ? (
    <AuthCommonCard>
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
              { required: true },
              {
                validator: (_, value) => {
                  if (value < 8 && value > 16) {
                    return Promise.reject(
                      'Password must be of minimum 8 and maximum 16 characters, with one special , one upper, one lower case character'
                    );
                  }

                  return Promise.resolve();
                },
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
                    return Promise.reject('Please type password first');
                  }
                  if (value !== password) {
                    return Promise.reject("Password doesn't match");
                  }

                  return Promise.resolve();
                },
              },
            ]}>
            <Input.Password placeholder="Confirm your password" />
          </Form.Item>

          <Button className="w-full" htmlType="submit" type="primary">
            Create Account
          </Button>

          <Divider className="w-min-0 w-max-200 mt-8 mb-12 justify-center">
            <Typography.Text type="secondary">or</Typography.Text>
          </Divider>

          <Space
            className="w-full flex-center text-center"
            direction="vertical">
            <Typography.Text strong>Already have an account?</Typography.Text>
            <Button className="w-full" type="primary" onClick={handleLogin}>
              Login
            </Button>
          </Space>
        </Form>
      </>
    </AuthCommonCard>
  ) : null;
};

export default BasicSignUp;
