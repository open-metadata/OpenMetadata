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

import { Button, Divider, Form, Input, Typography } from 'antd';
import classNames from 'classnames';
import jwtDecode, { JwtPayload } from 'jwt-decode';
import { observer } from 'mobx-react';
import React, { useEffect, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import loginBG from '../../assets/img/login-bg.png';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { useBasicAuth } from '../../authentication/auth-provider/basic-auth.provider';
import Loader from '../../components/Loader/Loader';
import LoginButton from '../../components/LoginButton/LoginButton';
import { VALIDATION_MESSAGES } from '../../constants/auth.constants';
import { ROUTES } from '../../constants/constants';
import { AuthTypes } from '../../enums/signin.enum';
import localState from '../../utils/LocalStorageUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import './login.style.less';
import LoginCarousel from './LoginCarousel';

const SigninPage = () => {
  const [form] = Form.useForm();

  const history = useHistory();
  const {
    isAuthDisabled,
    authConfig,
    onLoginHandler,
    onLogoutHandler,
    isAuthenticated,
  } = useAuthContext();

  const { isAuthProviderBasic } = useMemo(() => {
    return {
      isAuthProviderBasic: authConfig?.provider === AuthTypes.BASIC,
    };
  }, [authConfig]);

  const { handleLogin, loginError } = useBasicAuth();

  const isAlreadyLoggedIn = useMemo(() => {
    return isAuthDisabled || isAuthenticated;
  }, [isAuthDisabled, isAuthenticated]);

  const isTokenExpired = () => {
    const token = localState.getOidcToken();
    if (token) {
      try {
        const { exp } = jwtDecode<JwtPayload>(token);
        if (exp) {
          if (Date.now() < exp * 1000) {
            // Token is valid
            return false;
          }
        }
      } catch (error) {
        // ignore error
      }
    }

    return true;
  };

  const handleSignIn = () => {
    onLoginHandler && onLoginHandler();
  };

  const getSignInButton = (): JSX.Element => {
    let ssoBrandLogo;
    let ssoBrandName;
    switch (authConfig?.provider) {
      case AuthTypes.GOOGLE: {
        ssoBrandLogo = Icons.GOOGLE_ICON;
        ssoBrandName = 'Google';

        break;
      }
      case AuthTypes.CUSTOM_OIDC: {
        ssoBrandName = authConfig?.providerName
          ? authConfig?.providerName
          : 'SSO';

        break;
      }
      case AuthTypes.OKTA: {
        ssoBrandLogo = Icons.OKTA_ICON;
        ssoBrandName = 'Okta';

        break;
      }
      case AuthTypes.AWS_COGNITO: {
        ssoBrandLogo = Icons.COGNITO_ICON;
        ssoBrandName = 'AWS Cognito';

        break;
      }
      case AuthTypes.AZURE: {
        ssoBrandLogo = Icons.AZURE_ICON;
        ssoBrandName = 'Azure';

        break;
      }
      case AuthTypes.AUTH0: {
        ssoBrandLogo = Icons.AUTH0_ICON;
        ssoBrandName = 'Auth0';

        break;
      }
      // TODO: Add "case AuthTypes.GITHUB after adding support for these SSO
      default: {
        return <div>SSO Provider {authConfig?.provider} is not supported.</div>;
      }
    }

    return (
      <LoginButton
        ssoBrandLogo={ssoBrandLogo}
        ssoBrandName={ssoBrandName}
        onClick={handleSignIn}
      />
    );
  };

  // If user is neither logged in or nor security is disabled
  // invoke logout handler to clean-up any slug storage
  useEffect(() => {
    if (!isAlreadyLoggedIn && isTokenExpired()) {
      onLogoutHandler();
    }
  }, []);

  useEffect(() => {
    // If the user is already logged in or if security is disabled
    // redirect the user to the home page.
    if (isAlreadyLoggedIn) {
      history.push(ROUTES.HOME);
    }
  }, [isAlreadyLoggedIn]);

  if (isAlreadyLoggedIn) {
    return <Loader />;
  }

  const handleSubmit = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    handleLogin(email, password);
  };

  const onClickSignUp = () => history.push(ROUTES.REGISTER);

  const onClickForgotPassword = () => history.push(ROUTES.FORGOT_PASSWORD);

  return (
    <div className="tw-flex tw-flex-col tw-h-full">
      <div
        className="tw-flex tw-bg-body-main tw-flex-grow"
        data-testid="signin-page">
        <div className="tw-w-5/12">
          <div
            className={classNames('mt-24 tw-text-center flex-center flex-col', {
              'sso-container': !isAuthProviderBasic,
            })}>
            <SVGIcons alt="OpenMetadata Logo" icon={Icons.LOGO} width="152" />
            <Typography.Text className="mt-8 w-80 tw-text-xl text-semi-bold tw-text-grey-muted">
              Centralized Metadata Store, Discover, Collaborate and get your
              Data Right
            </Typography.Text>

            {isAuthProviderBasic ? (
              <div className="login-form ">
                <Form
                  className="w-full"
                  form={form}
                  layout="vertical"
                  validateMessages={VALIDATION_MESSAGES}
                  onFinish={handleSubmit}>
                  <Form.Item
                    data-testid="email"
                    label="Username or Email"
                    name="email"
                    requiredMark={false}
                    rules={[{ required: true }]}>
                    <Input placeholder="Email or Username" />
                  </Form.Item>
                  <Form.Item
                    data-testid="password"
                    label="Password"
                    name="password"
                    requiredMark={false}
                    rules={[{ required: true }]}>
                    <Input.Password placeholder="Password" />
                  </Form.Item>

                  <Button
                    className="w-full"
                    data-testid="login"
                    htmlType="submit"
                    type="primary">
                    Login
                  </Button>
                </Form>
                {loginError && (
                  <div
                    className="tw-flex tw-flex-col m-y-md"
                    data-testid="login-error-container">
                    <div className="tw-flex tw-border tw-border-main tw-rounded tw-p-3 error-alert ">
                      <div className="tw-mr-2">
                        <SVGIcons
                          alt="failed"
                          className="tw-w-5"
                          data-testid="failed-icon"
                          icon={Icons.FAIL_BADGE}
                        />
                      </div>
                      <p data-testid="success-line">
                        <span>{loginError}</span>
                      </p>
                    </div>
                  </div>
                )}
                <div className="mt-8" onClick={onClickForgotPassword}>
                  <Typography.Link underline data-testid="forgot-password">
                    Forgot Password
                  </Typography.Link>
                </div>

                {authConfig?.enableSelfSignUp && (
                  <>
                    <Divider className="w-min-0 mt-8 mb-12 justify-center">
                      <Typography.Text className="text-sm" type="secondary">
                        or
                      </Typography.Text>
                    </Divider>

                    <div className="mt-4 flex flex-center">
                      <Typography.Text className="mr-4">
                        New to the platform?
                      </Typography.Text>
                      <Button
                        ghost
                        data-testid="signup"
                        type="link"
                        onClick={onClickSignUp}>
                        Create Account
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="">{getSignInButton()}</div>
            )}
          </div>
        </div>
        <div className="tw-w-7/12 tw-relative">
          <div className="tw-absolute tw-inset-0">
            <img
              alt="bg-image"
              className="tw-w-full tw-h-full"
              data-testid="bg-image"
              src={loginBG}
            />
          </div>
          <div className="tw-relative">
            <div className="tw-flex tw-justify-center tw-mt-44 tw-mb-10">
              <LoginCarousel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default observer(SigninPage);
