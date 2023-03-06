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

import {
  Button,
  Col,
  Divider,
  Form,
  Image,
  Input,
  Row,
  Typography,
} from 'antd';
import Logo from 'assets/svg/logo.svg';
import classNames from 'classnames';
import { useApplicationConfigProvider } from 'components/ApplicationConfigProvider/ApplicationConfigProvider';
import { useAuthContext } from 'components/authentication/auth-provider/AuthProvider';
import { useBasicAuth } from 'components/authentication/auth-provider/basic-auth.provider';
import Loader from 'components/Loader/Loader';
import LoginButton from 'components/LoginButton/LoginButton';
import jwtDecode, { JwtPayload } from 'jwt-decode';
import { observer } from 'mobx-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import loginBG from '../../assets/img/login-bg.png';
import { VALIDATION_MESSAGES } from '../../constants/auth.constants';
import { ROUTES } from '../../constants/constants';
import { AuthTypes } from '../../enums/signin.enum';
import localState from '../../utils/LocalStorageUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import './login.style.less';
import LoginCarousel from './LoginCarousel';

const SigninPage = () => {
  const { logoConfig } = useApplicationConfigProvider();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const history = useHistory();
  const {
    isAuthDisabled,
    authConfig,
    onLoginHandler,
    onLogoutHandler,
    isAuthenticated,
  } = useAuthContext();

  const { t } = useTranslation();

  const { isAuthProviderBasic } = useMemo(() => {
    return {
      isAuthProviderBasic:
        authConfig?.provider === AuthTypes.BASIC ||
        authConfig?.provider === AuthTypes.LDAP,
    };
  }, [authConfig]);

  const { isAuthProviderLDAP } = useMemo(() => {
    return {
      isAuthProviderLDAP: authConfig?.provider === AuthTypes.LDAP,
    };
  }, [authConfig]);

  const { handleLogin, loginError } = useBasicAuth();

  const isAlreadyLoggedIn = useMemo(() => {
    return isAuthDisabled || isAuthenticated;
  }, [isAuthDisabled, isAuthenticated]);

  const brandLogoUrl = useMemo(() => {
    return logoConfig?.customLogoUrlPath ?? Logo;
  }, [logoConfig]);

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
      default: {
        return (
          <div>
            {t('message.sso-provider-not-supported', {
              provider: authConfig?.provider,
            })}
          </div>
        );
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
    setLoading(true);
    await Promise.resolve(handleLogin(email, password));
    setLoading(false);
  };

  const onClickSignUp = () => history.push(ROUTES.REGISTER);

  const onClickForgotPassword = () => history.push(ROUTES.FORGOT_PASSWORD);

  return (
    <div className="d-flex flex-col h-full">
      <Row className="flex bg-body-main flex-grow" data-testid="signin-page">
        <Col span={10}>
          <div
            className={classNames('mt-24 text-center flex-center flex-col', {
              'sso-container': !isAuthProviderBasic,
            })}>
            <Image
              alt="OpenMetadata Logo"
              data-testid="brand-logo-image"
              fallback={Logo}
              preview={false}
              src={brandLogoUrl}
              width={152}
            />
            <Typography.Text className="mt-8 w-80 text-xl font-medium text-grey-muted">
              {t('message.om-description')}{' '}
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
                    label={
                      isAuthProviderLDAP
                        ? t('label.email')
                        : t('label.username-or-email')
                    }
                    name="email"
                    requiredMark={false}
                    rules={[{ required: true }]}>
                    <Input
                      placeholder={
                        isAuthProviderLDAP
                          ? t('label.email')
                          : t('label.username-or-email')
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    data-testid="password"
                    label={t('label.password')}
                    name="password"
                    requiredMark={false}
                    rules={[{ required: true }]}>
                    <Input.Password placeholder={t('label.password')} />
                  </Form.Item>

                  <Button
                    className="w-full"
                    data-testid="login"
                    disabled={loading}
                    htmlType="submit"
                    loading={loading}
                    type="primary">
                    {t('label.login')}
                  </Button>
                </Form>
                {loginError && (
                  <div
                    className="d-flex flex-col m-y-md"
                    data-testid="login-error-container">
                    <div className="flex global-border rounded-4 p-sm error-alert ">
                      <div className="m-r-xs">
                        <SVGIcons
                          alt="failed"
                          className="w-5"
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
                    {t('label.forgot-password')}
                  </Typography.Link>
                </div>

                {(authConfig?.enableSelfSignUp || isAuthProviderLDAP) && (
                  <>
                    <Divider className="w-min-0 mt-8 mb-12 justify-center">
                      <Typography.Text className="text-sm" type="secondary">
                        {t('label.or-lowercase')}
                      </Typography.Text>
                    </Divider>

                    <div className="mt-4 d-flex flex-center">
                      <Typography.Text className="mr-4">
                        {t('message.new-to-the-platform')}
                      </Typography.Text>
                      <Button
                        data-testid="signup"
                        type="link"
                        onClick={onClickSignUp}>
                        {t('label.create-entity', {
                          entity: t('label.account'),
                        })}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="">{getSignInButton()}</div>
            )}
          </div>
        </Col>
        <Col className="relative" span={14}>
          <div className="absolute inset-0">
            <img
              alt="bg-image"
              className="w-full h-full"
              data-testid="bg-image"
              src={loginBG}
            />
          </div>
          <div className="relative">
            <div className="flex justify-center mt-44 mb-10">
              <LoginCarousel />
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default observer(SigninPage);
