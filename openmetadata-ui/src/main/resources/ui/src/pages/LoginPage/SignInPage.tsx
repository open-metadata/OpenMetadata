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

import { Button, Form, Input, Typography } from 'antd';
import classNames from 'classnames';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import IconAuth0 from '../../assets/img/icon-auth0.png';
import IconCognito from '../../assets/img/icon-aws-cognito.png';
import IconAzure from '../../assets/img/icon-azure.png';
import IconGoogle from '../../assets/img/icon-google.png';
import IconOkta from '../../assets/img/icon-okta.png';
import AlertBar from '../../components/AlertBar/AlertBar';
import { useAuthProvider } from '../../components/Auth/AuthProviders/AuthProvider';
import { useBasicAuth } from '../../components/Auth/AuthProviders/BasicAuthProvider';
import BrandImage from '../../components/common/BrandImage/BrandImage';
import Loader from '../../components/common/Loader/Loader';
import LoginButton from '../../components/common/LoginButton/LoginButton';
import { CarouselLayout } from '../../components/Layout/CarouselLayout/CarouselLayout';
import { ROUTES, VALIDATION_MESSAGES } from '../../constants/constants';
import { EMAIL_REG_EX } from '../../constants/regex.constants';
import { AuthProvider } from '../../generated/settings/settings';
import { useAlertStore } from '../../hooks/useAlertStore';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import brandClassBase from '../../utils/BrandData/BrandClassBase';
import './login.style.less';

const SignInPage = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const navigate = useNavigate();
  const { authConfig, isAuthenticated } = useApplicationStore();
  const { onLoginHandler } = useAuthProvider();
  const { alert, resetAlert } = useAlertStore();

  const { t } = useTranslation();

  const brandName = brandClassBase.getPageTitle();

  const { isAuthProviderBasic, isAuthProviderLDAP } = useMemo(() => {
    return {
      isAuthProviderBasic:
        authConfig?.provider === AuthProvider.Basic ||
        authConfig?.provider === AuthProvider.LDAP,
      isAuthProviderLDAP: authConfig?.provider === AuthProvider.LDAP,
    };
  }, [authConfig]);

  const { handleLogin } = useBasicAuth();

  const handleSignIn = () => {
    onLoginHandler && onLoginHandler();
  };

  const signInButton = useMemo(() => {
    let ssoBrandLogo;
    let ssoBrandName;
    switch (authConfig?.provider) {
      case AuthProvider.Google: {
        ssoBrandLogo = IconGoogle;
        ssoBrandName = 'Google';

        break;
      }
      case AuthProvider.CustomOidc: {
        ssoBrandName = authConfig?.providerName
          ? authConfig?.providerName
          : 'SSO';

        break;
      }
      case AuthProvider.Saml: {
        ssoBrandName = authConfig?.providerName
          ? authConfig?.providerName
          : 'SAML SSO';

        break;
      }
      case AuthProvider.Okta: {
        ssoBrandLogo = IconOkta;
        ssoBrandName = 'Okta';

        break;
      }
      case AuthProvider.AwsCognito: {
        ssoBrandLogo = IconCognito;
        ssoBrandName = 'AWS Cognito';

        break;
      }
      case AuthProvider.Azure: {
        ssoBrandLogo = IconAzure;
        ssoBrandName = 'Azure';

        break;
      }
      case AuthProvider.Auth0: {
        ssoBrandLogo = IconAuth0;
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
  }, [authConfig?.provider, handleSignIn]);

  useEffect(() => {
    // If the user is already logged in or if security is disabled
    // redirect the user to the home page.
    if (isAuthenticated) {
      navigate(ROUTES.HOME);
    }
  }, [isAuthenticated]);

  if (isAuthenticated) {
    return <Loader fullScreen />;
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

  const onClickSignUp = () => {
    navigate(ROUTES.REGISTER);
    resetAlert();
  };

  const onClickForgotPassword = () => {
    navigate(ROUTES.FORGOT_PASSWORD);
    resetAlert();
  };

  return (
    <CarouselLayout pageTitle={t('label.sign-in')}>
      <div className="login-form-container" data-testid="login-form-container">
        <div
          className={classNames('login-box', {
            'sso-container': !isAuthProviderBasic,
          })}>
          <BrandImage isMonoGram height="auto" width={50} />
          <Typography.Title className="header-text display-sm" level={3}>
            {t('label.welcome-to')} {brandName}
          </Typography.Title>
          {alert && (
            <div className="login-alert">
              <AlertBar
                defafultExpand
                message={alert?.message}
                type={alert?.type}
              />
            </div>
          )}

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
                  label={t('label.email')}
                  name="email"
                  rules={[
                    { required: true },
                    {
                      pattern: EMAIL_REG_EX,
                      type: 'email',
                      message: t('message.field-text-is-invalid', {
                        fieldText: t('label.email'),
                      }),
                    },
                  ]}>
                  <Input
                    autoFocus
                    className="input-field"
                    placeholder={t('label.email')}
                  />
                </Form.Item>
                <Form.Item
                  data-testid="password"
                  label={
                    <>
                      <Typography.Text className="mr-1">
                        {t('label.password')}
                      </Typography.Text>
                      <Typography.Link
                        className="forgot-password-link"
                        data-testid="forgot-password"
                        onClick={onClickForgotPassword}>
                        {t('label.forgot-password')}
                      </Typography.Link>
                    </>
                  }
                  name="password"
                  rules={[{ required: true }]}>
                  <Input.Password
                    autoComplete="off"
                    className="input-field"
                    placeholder={t('label.password')}
                  />
                </Form.Item>

                <Button
                  block
                  className="login-btn"
                  data-testid="login"
                  disabled={loading}
                  htmlType="submit"
                  loading={loading}
                  size="large"
                  type="primary">
                  {t('label.sign-in')}
                </Button>
              </Form>
              {!isAuthProviderLDAP && (
                <>
                  {authConfig?.enableSelfSignup && (
                    <div className="mt-4 d-flex flex-center signup-text">
                      <Typography.Text>
                        {t('message.new-to-the-platform')}
                      </Typography.Text>
                      <Button
                        className="link-btn"
                        data-testid="signup"
                        type="link"
                        onClick={onClickSignUp}>
                        {t('label.create-entity', {
                          entity: t('label.account'),
                        })}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className=" login-form">
              <Typography.Text className="text-xl text-grey-muted m-t-lg">
                {t('message.om-description')}
              </Typography.Text>
              <div className="sso-signup">{signInButton}</div>
            </div>
          )}
        </div>
      </div>
    </CarouselLayout>
  );
};

export default SignInPage;
